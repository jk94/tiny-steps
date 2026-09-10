import { Injectable } from '@nestjs/common';
import type { Child } from '@prisma/client';
import { EventService } from '../../event/event.service';
import { GrowthService, type GrowthReferenceResponse } from '../../growth/growth.service';
import { HealthRecordService } from '../../health-record/health-record.service';
import { MilestoneService } from '../../milestone/milestone.service';
import {
  REPORT_GROWTH_MEASURES,
  REPORT_GROWTH_MEASURE_DEFINITIONS,
  type ReportGrowthMeasure,
} from './chart/growth-chart-svg';
import type {
  ReportBlock,
  ReportDocument,
  ReportLocale,
  ReportSection,
} from './report-document.types';
import { getReportStrings, type ReportStrings } from './report-i18n/report-i18n';
import { buildCoreSection } from './sections/core.section';
import { buildGrowthSection } from './sections/growth.section';
import { buildMedicalSection } from './sections/medical.section';
import { buildMilestonesSection } from './sections/milestones.section';
import { buildTrackingSection } from './sections/tracking.section';

export interface BuildReportDocumentInput {
  householdId: string;
  child: Child;
  /** Inclusive start of the reporting period. */
  from: Date;
  /** Exclusive end of the reporting period. */
  to: Date;
  sections: ReportSection[];
  locale: ReportLocale;
  /** Injected so the header's "created on" is deterministic in tests. */
  createdAt?: Date;
}

/** Render order. Fixed, not derived from the request's `sections` order. */
const SECTION_ORDER: Exclude<ReportSection, 'CORE'>[] = [
  'GROWTH',
  'MILESTONES',
  'MEDICAL',
  'TRACKING',
];

const SECTION_HEADING_KEYS = {
  GROWTH: 'section.growth',
  MILESTONES: 'section.milestones',
  MEDICAL: 'section.medical',
  TRACKING: 'section.tracking',
} as const;

/**
 * Turns the requested period and section selection into a `ReportDocument` —
 * the renderer-neutral intermediate representation described in
 * `report-document.types.ts` and ADR-0015.
 *
 * This class is where **all** report logic lives: which data to fetch, how to
 * window it, how to order it, and how to localize and format every value. A
 * renderer only draws the resulting blocks. Nothing here may import
 * `@react-pdf/renderer` or any other renderer, which is what keeps a second
 * renderer a purely additive change.
 */
@Injectable()
export class ReportDocumentBuilder {
  constructor(
    private readonly growthService: GrowthService,
    private readonly milestoneService: MilestoneService,
    private readonly healthRecordService: HealthRecordService,
    private readonly eventService: EventService,
  ) {}

  async build(input: BuildReportDocumentInput): Promise<ReportDocument> {
    const strings = getReportStrings(input.locale);
    const blocks: ReportBlock[] = [];

    // CORE is not in SECTION_ORDER: it produces the document header rather
    // than a heading-plus-content section, and it always comes first.
    if (input.sections.includes('CORE')) {
      blocks.push(
        buildCoreSection({
          child: input.child,
          from: input.from,
          to: input.to,
          createdAt: input.createdAt ?? new Date(),
          strings,
        }),
      );
    }

    for (const section of SECTION_ORDER) {
      if (!input.sections.includes(section)) {
        continue;
      }

      const sectionBlocks = await this.buildSection(section, input, strings);

      blocks.push({ kind: 'sectionHeading', text: strings.t(SECTION_HEADING_KEYS[section]) });
      blocks.push(
        // A selected-but-empty section gets an explicit note, never silence: a
        // reader must be able to tell "nothing was recorded" apart from "this
        // section was not requested".
        ...(sectionBlocks.length > 0
          ? sectionBlocks
          : [{ kind: 'emptySectionNote' as const, text: strings.t('common.emptySection') }]),
      );
    }

    return {
      locale: strings.locale,
      title: strings.t('document.title', { childName: input.child.name }),
      blocks,
    };
  }

  private async buildSection(
    section: Exclude<ReportSection, 'CORE'>,
    input: BuildReportDocumentInput,
    strings: ReportStrings,
  ): Promise<ReportBlock[]> {
    const { householdId, child, from, to } = input;
    const range = { from: from.toISOString(), to: to.toISOString() };

    switch (section) {
      case 'GROWTH': {
        const measurements = await this.growthService.list(householdId, child.id, range);
        return buildGrowthSection({
          birthDate: child.birthDate,
          measurements,
          references: await this.loadGrowthReferences(householdId, child, measurements.length > 0),
          strings,
        });
      }

      case 'MILESTONES': {
        const milestones = await this.milestoneService.list(householdId, child.id, range);
        return buildMilestonesSection({ birthDate: child.birthDate, milestones, strings });
      }

      case 'MEDICAL': {
        // Two queries with deliberately different windowing — see
        // `buildMedicalSection`'s doc comment for why the planned side ignores
        // the period entirely.
        const [done, planned] = await Promise.all([
          this.healthRecordService.list(householdId, child.id, { status: 'done' }),
          this.healthRecordService.list(householdId, child.id, { status: 'planned' }),
        ]);

        // The service has no date filter for `administeredAt`, so the period
        // is applied here. Cheap: this table holds a handful of rows per child,
        // not one per feed (the same reasoning `ExportService` records).
        const administered = done.filter(
          (record) =>
            record.administeredAt !== null &&
            record.administeredAt >= range.from &&
            record.administeredAt < range.to,
        );

        return buildMedicalSection({ administered, planned, strings });
      }

      case 'TRACKING': {
        const summary = await this.eventService.getPeriodTrackingSummary(
          householdId,
          child.id,
          from,
          to,
        );
        return buildTrackingSection({ summary, strings });
      }
    }
  }

  /**
   * The WHO bands for every measure, or an empty map when there is nothing to
   * plot them behind.
   *
   * Skipped entirely without measurements: each reference is 5 curves × 262
   * sampled points, and computing three of them to draw no chart is pure waste.
   */
  private async loadGrowthReferences(
    householdId: string,
    child: Child,
    hasMeasurements: boolean,
  ): Promise<Partial<Record<ReportGrowthMeasure, GrowthReferenceResponse>>> {
    if (!hasMeasurements) {
      return {};
    }

    const entries = await Promise.all(
      REPORT_GROWTH_MEASURES.map(
        async (measure) =>
          [
            measure,
            await this.growthService.getReference(
              householdId,
              child.id,
              REPORT_GROWTH_MEASURE_DEFINITIONS[measure].indicator,
            ),
          ] as const,
      ),
    );

    return Object.fromEntries(entries);
  }
}

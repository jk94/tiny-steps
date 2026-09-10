/**
 * EXP-15 measurement: how long does generating a report take, and how much heap
 * does it need, as the reporting period grows?
 *
 * Deliberately **not** a `.spec.ts`. It is a benchmark, not an assertion: the
 * numbers depend on the machine, so a threshold would either be meaningless or
 * flaky. Its output is transcribed into ADR-0015's "Measured" section, the same
 * way ADR-0014's bundle sizes were, and it is re-run when the report's shape
 * changes materially.
 *
 * Run from `apps/backend`:
 *
 *     bun run report:bench
 *
 * It touches no database: the section builders are driven by in-memory
 * synthetic data through the same `ReportDocumentBuilder` the endpoint uses, so
 * what is measured is document assembly + chart rendering + PDF layout — the
 * parts that actually scale with the period — and not SQLite's page cache.
 */
import type { Child } from '@prisma/client';
import { ChildSex } from '../../../child/child-sex.enum';
import { LengthMeasurementPosition } from '../../../growth/length-measurement-position.enum';
import type { EventService, PeriodTrackingSummary } from '../../../event/event.service';
import type {
  GrowthMeasurementSummary,
  GrowthReferenceResponse,
  GrowthService,
} from '../../../growth/growth.service';
import type { HealthRecordService } from '../../../health-record/health-record.service';
import type { MilestoneService } from '../../../milestone/milestone.service';
import { REPORT_SECTIONS } from '../report-document.types';
import { ReportDocumentBuilder } from '../report-document.builder';
import { ReactPdfRenderer } from '../renderers/react-pdf/react-pdf.renderer';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375;

/** Roughly what a real household records, per the phase 2/3 tracking model. */
const FEEDINGS_PER_DAY = 7;
const DIAPERS_PER_DAY = 6;
const SLEEP_HOURS_PER_DAY = 13;

const MEASUREMENTS_PER_MONTH = 1;
const MILESTONES_TOTAL = 10;
const HEALTH_RECORDS_TOTAL = 20;

const RUNS_PER_PERIOD = 5;
const PERIODS_IN_MONTHS = [1, 3, 12, 24];

const BIRTH_DATE = new Date('2024-01-01T00:00:00.000Z');
const REPORT_DATE = new Date('2026-01-01T00:00:00.000Z');

const CHILD: Child = {
  id: 'bench-child',
  householdId: 'bench-household',
  name: 'Benchmark Kind',
  birthDate: BIRTH_DATE,
  photoPath: null,
  photoMimeType: null,
  sex: 'FEMALE',
  createdAt: BIRTH_DATE,
};

function syntheticMeasurements(months: number): GrowthMeasurementSummary[] {
  const count = Math.max(1, Math.round(months * MEASUREMENTS_PER_MONTH));
  return Array.from({ length: count }, (_unused, index) => {
    const measuredAt = new Date(
      REPORT_DATE.getTime() - (count - index) * DAYS_PER_MONTH * MS_PER_DAY,
    );
    const ageInDays = Math.floor((measuredAt.getTime() - BIRTH_DATE.getTime()) / MS_PER_DAY);
    return {
      id: `measurement-${index}`,
      childId: CHILD.id,
      userId: 'bench-user',
      measuredAt,
      ageInDaysAtMeasurement: ageInDays,
      weightGrams: 3300 + ageInDays * 8,
      lengthMillimeters: 500 + ageInDays * 0.6,
      headCircumferenceMillimeters: 350 + ageInDays * 0.2,
      lengthMeasurementPosition: null,
      effectiveLengthMeasurementPosition: LengthMeasurementPosition.LYING,
      lengthOrHeightReferenceUsed: 'LENGTH',
      note: null,
      createdAt: measuredAt,
      updatedAt: measuredAt,
      percentiles: {
        weight: { status: 'COMPUTED', zScore: 0.2, percentile: 57.9 },
        length: { status: 'COMPUTED', zScore: -0.1, percentile: 46.0 },
        headCircumference: { status: 'COMPUTED', zScore: 0.4, percentile: 65.5 },
      },
    } satisfies GrowthMeasurementSummary;
  });
}

/** The real band shape: 5 curves sampled weekly over the WHO 0–5y range. */
function syntheticReference(): GrowthReferenceResponse {
  const stepDays = 7;
  const sampleCount = Math.floor(1826 / stepDays) + 1;
  return {
    indicator: 'WEIGHT_FOR_AGE',
    sex: ChildSex.FEMALE,
    available: true,
    xUnit: 'DAYS',
    unit: 'GRAMS',
    ageRangeDays: [0, 1826],
    stepDays,
    lengthToHeightBoundaryDays: 731,
    curves: ([3, 15, 50, 85, 97] as const).map((percentile) => ({
      percentile,
      zScore: 0,
      points: Array.from({ length: sampleCount }, (_unused, index) => ({
        ageInDays: index * stepDays,
        value: 3200 + index * 40 + (percentile - 50) * 18,
      })),
    })),
  };
}

function syntheticMilestones(months: number) {
  return Array.from({ length: MILESTONES_TOTAL }, (_unused, index) => {
    const achievedAt = new Date(
      REPORT_DATE.getTime() -
        ((index + 1) / MILESTONES_TOTAL) * months * DAYS_PER_MONTH * MS_PER_DAY,
    ).toISOString();
    return {
      id: `milestone-${index}`,
      childId: CHILD.id,
      userId: 'bench-user',
      templateKey: null,
      title: `Meilenstein ${index + 1}`,
      category: 'MOTOR' as const,
      achievedAt,
      ageInDaysAtMilestone: 300 + index * 10,
      ageInMonthsAtMilestone: 10 + index,
      note: null,
      createdAt: achievedAt,
      updatedAt: achievedAt,
      photos: [],
    };
  });
}

function syntheticHealthRecords(months: number, status: 'done' | 'planned') {
  const count = status === 'done' ? HEALTH_RECORDS_TOTAL : Math.round(HEALTH_RECORDS_TOTAL / 4);
  return Array.from({ length: count }, (_unused, index) => {
    const at = new Date(
      REPORT_DATE.getTime() - ((index + 1) / count) * months * DAYS_PER_MONTH * MS_PER_DAY,
    ).toISOString();
    return {
      id: `health-${status}-${index}`,
      childId: CHILD.id,
      userId: 'bench-user',
      kind: 'VACCINATION' as const,
      name: `Impfung ${index + 1}`,
      administeredAt: status === 'done' ? at : null,
      dueAt: status === 'planned' ? at : null,
      doseAmount: null,
      doseUnit: null,
      vaccineBatch: `CHARGE-${index}`,
      note: null,
      reminderEnabled: false,
      createdAt: at,
      updatedAt: at,
    };
  });
}

function syntheticTracking(days: number): PeriodTrackingSummary {
  return {
    days,
    feedingCount: days * FEEDINGS_PER_DAY,
    diaperCount: days * DIAPERS_PER_DAY,
    sleepHours: days * SLEEP_HOURS_PER_DAY,
    feedingsPerDay: FEEDINGS_PER_DAY,
    diapersPerDay: DIAPERS_PER_DAY,
    sleepHoursPerDay: SLEEP_HOURS_PER_DAY,
  };
}

function buildFor(months: number): ReportDocumentBuilder {
  const measurements = syntheticMeasurements(months);
  const reference = syntheticReference();
  const milestones = syntheticMilestones(months);
  const days = Math.round(months * DAYS_PER_MONTH);

  return new ReportDocumentBuilder(
    {
      list: () => Promise.resolve(measurements),
      getReference: () => Promise.resolve(reference),
    } as unknown as GrowthService,
    { list: () => Promise.resolve(milestones) } as unknown as MilestoneService,
    {
      list: (_household: string, _child: string, query?: { status?: 'done' | 'planned' }) =>
        Promise.resolve(syntheticHealthRecords(months, query?.status ?? 'done')),
    } as unknown as HealthRecordService,
    {
      getPeriodTrackingSummary: () => Promise.resolve(syntheticTracking(days)),
    } as unknown as EventService,
  );
}

function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function main(): Promise<void> {
  const renderer = new ReactPdfRenderer();
  const rows: string[][] = [];

  for (const months of PERIODS_IN_MONTHS) {
    const builder = buildFor(months);
    const from = new Date(REPORT_DATE.getTime() - months * DAYS_PER_MONTH * MS_PER_DAY);

    const timings: number[] = [];
    let bytes = 0;
    let peakHeap = 0;

    for (let run = 0; run < RUNS_PER_PERIOD; run += 1) {
      const heapBefore = process.memoryUsage().heapUsed;
      const started = performance.now();

      const document = await builder.build({
        householdId: CHILD.householdId,
        child: CHILD,
        from,
        to: REPORT_DATE,
        sections: [...REPORT_SECTIONS],
        locale: 'de',
        createdAt: REPORT_DATE,
      });
      const buffer = await renderer.render(document);

      timings.push(performance.now() - started);
      bytes = buffer.length;
      peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed - heapBefore);
    }

    timings.sort((a, b) => a - b);
    rows.push([
      `${months} month(s)`,
      timings[0].toFixed(0),
      timings[Math.floor(timings.length / 2)].toFixed(0),
      timings.at(-1)!.toFixed(0),
      formatMegabytes(peakHeap),
      `${Math.round(bytes / 1024)} kB`,
    ]);
  }

  const header = ['Period', 'min ms', 'median ms', 'max ms', 'peak heap MB', 'PDF size'];
  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    console.log(`| ${row.join(' | ')} |`);
  }
  console.log(`\n${RUNS_PER_PERIOD} runs per period, Node ${process.version}.`);
}

void main();

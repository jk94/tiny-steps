import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Child } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { validateReportPeriod, type ReportQueryDto } from '../dto/report-query.dto';
import { ReportDocumentBuilder } from './report-document.builder';
import type { ReportDocument } from './report-document.types';
import { REPORT_RENDERER, type ReportRenderer } from './renderers/report-renderer.interface';

/**
 * Structured code the frontend distinguishes: the request was valid, the
 * period and sections simply contained nothing to print.
 */
export const REPORT_EMPTY_PERIOD = 'REPORT_EMPTY_PERIOD';

/**
 * The PDF report endpoint's service layer (roadmap Phase 7.4).
 *
 * Deliberately separate from `ExportService`, which stays untouched: that one
 * produces a faithful raw dump for archival and re-processing, this one
 * produces a curated document for a human to read. They answer different
 * questions and share nothing but the child lookup.
 *
 * The renderer arrives through an injection token rather than as a concrete
 * class (EXP-10), so adding the deferred external HTML renderer later means
 * changing one provider, not this file.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: ReportDocumentBuilder,
    @Inject(REPORT_RENDERER) private readonly renderer: ReportRenderer,
  ) {}

  async generatePdf(householdId: string, childId: string, query: ReportQueryDto): Promise<Buffer> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    // Cross-field checks the DTO's per-property decorators cannot express.
    const periodError = validateReportPeriod(from, to);
    if (periodError) {
      throw new BadRequestException(periodError);
    }

    const child = await this.findChildOrThrow(householdId, childId);

    const document = await this.builder.build({
      householdId,
      child,
      from,
      to,
      sections: query.sections,
      locale: query.locale,
    });

    if (isDocumentEmpty(document)) {
      // A PDF containing nothing but a header and four "no data" notes is a
      // worse answer than an error: the user would download it, open it, and
      // only then discover they picked the wrong period. Note that a
      // *partially* empty report is still generated — see `isDocumentEmpty`.
      throw new UnprocessableEntityException({ code: REPORT_EMPTY_PERIOD });
    }

    return this.renderer.render(document);
  }

  /**
   * Same double-check as `ExportService`/`EventService`: the
   * `HouseholdMembershipGuard` proves household membership but not that this
   * child belongs to that household, so a cross-household child id has to
   * become a 404 here rather than leaking another household's data.
   */
  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({ where: { id: childId, householdId } });

    if (!child) {
      throw new NotFoundException();
    }

    return child;
  }
}

/**
 * True when every selected content section came back empty.
 *
 * The document header does not count as content — a report consisting only of
 * the child's name and the period is empty in every sense that matters to the
 * person who asked for it.
 */
function isDocumentEmpty(document: ReportDocument): boolean {
  return !document.blocks.some(
    (block) =>
      block.kind !== 'documentHeader' &&
      block.kind !== 'sectionHeading' &&
      block.kind !== 'emptySectionNote',
  );
}

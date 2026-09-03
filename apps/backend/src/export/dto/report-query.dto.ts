import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsISO8601 } from 'class-validator';
import {
  REPORT_SECTIONS,
  type ReportLocale,
  type ReportSection,
} from '../report/report-document.types';

/**
 * Hard upper bound on the reporting period, in days (EXP-15).
 *
 * Two years, because that is the span a paediatric check-up actually looks
 * back over, and because report generation is synchronous: it holds a request
 * thread and builds the whole document in memory. The measured cost is
 * documented in ADR-0015; the cap exists so an accidental "from 1970" cannot
 * turn one request into a multi-second, multi-hundred-megabyte stall. Moving
 * generation to a worker thread would be the way to lift it.
 */
export const MAX_REPORT_PERIOD_DAYS = 731;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Accepts `?sections=A,B` and repeated `?sections=A&sections=B` alike. */
function toSectionArray(value: unknown): unknown {
  if (value === undefined) {
    return [...REPORT_SECTIONS];
  }
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : [entry]))
    .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
    .filter((entry) => entry !== '');
}

/**
 * Query params for `GET .../export/report.pdf`.
 *
 * Unlike `ExportQueryDto`, where the range is optional and omitting it dumps
 * the full history, **every** parameter that shapes the document is required:
 * a period (EXP-1) and a language (EXP-8, "passed in, never server-guessed").
 * A report with a server-chosen language or an unbounded period would be a
 * different document than the one the user asked for.
 */
export class ReportQueryDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;

  @IsIn(['de', 'en'])
  locale!: ReportLocale;

  // Optional in effect, not by decorator: the transform substitutes the full
  // section list when the param is absent, so the value is always a validated
  // array and `@IsOptional` would only make that harder to see (EXP-2).
  @Transform(({ value }) => toSectionArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(REPORT_SECTIONS, { each: true })
  sections: ReportSection[] = [...REPORT_SECTIONS];
}

/**
 * Range checks that need both bounds at once, so they cannot be expressed as
 * per-property decorators. Returns a message key on failure, null when valid.
 */
export function validateReportPeriod(from: Date, to: Date): string | null {
  if (!(to.getTime() > from.getTime())) {
    return '`to` must be after `from`';
  }
  if (to.getTime() - from.getTime() > MAX_REPORT_PERIOD_DAYS * MS_PER_DAY) {
    return `Reporting period must not exceed ${MAX_REPORT_PERIOD_DAYS} days`;
  }
  return null;
}

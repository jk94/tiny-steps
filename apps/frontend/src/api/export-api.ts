import { ApiError, apiFetchBlob } from './http-client';
import type { BlobResponse } from './http-client';

export type ExportFormat = 'json' | 'csv';

/**
 * The individually selectable report sections (EXP-2). `CORE` is the header and
 * master data and is always included — see `Export.tsx`.
 */
export const REPORT_SECTIONS = ['CORE', 'GROWTH', 'MILESTONES', 'MEDICAL', 'TRACKING'] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

/**
 * The backend's structured code for "the request was fine, the chosen period
 * and sections just contain nothing". Distinguished from a generic failure
 * because the two need different advice: change the period, versus try again.
 */
export const REPORT_EMPTY_PERIOD = 'REPORT_EMPTY_PERIOD';

/** The languages the report catalog exists in — mirrors i18n's `supportedLngs`. */
const REPORT_LOCALES = ['de', 'en'] as const;

const DEFAULT_REPORT_LOCALE = 'de';

/**
 * Narrows an i18next language to one the report endpoint accepts.
 *
 * The language detector can produce a region-tagged value (`de-DE`, `en-GB`)
 * that the backend's `@IsIn(['de','en'])` would reject, so the region is
 * dropped here rather than being allowed to turn a language preference into a
 * 400.
 */
export function toReportLocale(language: string): string {
  const base = language.split('-')[0];
  return (REPORT_LOCALES as readonly string[]).includes(base) ? base : DEFAULT_REPORT_LOCALE;
}

export interface ReportRequest {
  from: string;
  to: string;
  sections: ReportSection[];
  /** The active UI language, passed explicitly — never server-guessed (EXP-8). */
  locale: string;
}

/** True for the 422 the backend raises when nothing at all would be printed. */
export function isEmptyPeriodError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 422 &&
    typeof error.body === 'object' &&
    error.body !== null &&
    (error.body as { code?: unknown }).code === REPORT_EMPTY_PERIOD
  );
}

/**
 * Downloads the curated PDF report for a period and a section selection.
 *
 * Unlike `downloadExport`, every parameter is required: the report is always
 * for a chosen span (EXP-1) and a chosen language (EXP-8).
 */
export function downloadReport(
  householdId: string,
  childId: string,
  request: ReportRequest,
): Promise<BlobResponse> {
  const params = new URLSearchParams({
    from: request.from,
    to: request.to,
    locale: toReportLocale(request.locale),
    sections: request.sections.join(','),
  });

  return apiFetchBlob(
    `/households/${householdId}/children/${childId}/export/report.pdf?${params.toString()}`,
  );
}

function exportPath(householdId: string, childId: string, format: ExportFormat): string {
  return `/households/${householdId}/children/${childId}/export/${format}`;
}

/**
 * Builds the optional `?from=&to=` range query. Both bounds are only sent when
 * present — the backend's `ExportQueryDto` treats them as optional (omitting
 * both exports the child's full history), unlike the required range on
 * `/events/daily`.
 */
function optionalRangeQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) {
    params.set('from', from);
  }
  if (to) {
    params.set('to', to);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Downloads a child's raw-data export in the requested format, returning the
 * blob plus the server-provided filename. The caller is responsible for
 * triggering the browser save (see `Export.tsx`).
 */
export function downloadExport(
  householdId: string,
  childId: string,
  format: ExportFormat,
  from?: string,
  to?: string,
): Promise<BlobResponse> {
  return apiFetchBlob(`${exportPath(householdId, childId, format)}${optionalRangeQuery(from, to)}`);
}

import type { ReportDocument } from '../report-document.types';

/**
 * Injection token for the active renderer. A token rather than the class
 * itself, so selecting a different implementation later (EXP-10/EXP-11: an
 * external HTML→PDF service) is a one-line provider change instead of an
 * import change in every consumer.
 */
export const REPORT_RENDERER = 'REPORT_RENDERER';

/**
 * Draws a `ReportDocument` into a PDF.
 *
 * The whole contract: no locale, no period, no data access. Everything a
 * renderer needs is already in the document as formatted, localized strings
 * (see `report-document.types.ts`), which is what makes it possible to add a
 * second renderer without duplicating any report logic.
 */
export interface ReportRenderer {
  render(document: ReportDocument): Promise<Buffer>;
}

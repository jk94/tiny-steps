/**
 * The renderer-neutral intermediate representation of a PDF report
 * (roadmap Phase 7.4, EXP-10; see ADR-0015).
 *
 * The problem this solves: the built-in renderer speaks JSX, an external
 * browser-based PDF service speaks HTML, and neither can consume the other's
 * layout. Without an intermediate representation the report's layout would be
 * maintained twice and would drift.
 *
 * So `ReportDocumentBuilder` produces a `ReportDocument` exactly once, and a
 * renderer only has to draw this small, stable set of block types. Data
 * selection, period logic, aggregation, percentile lookup and ordering
 * therefore exist **once**.
 *
 * Two rules keep that boundary honest and are the reason this module imports
 * nothing:
 *
 * 1. **Every value here is an already-formatted, already-localized string.** A
 *    renderer does no translation, no number formatting and no date logic — if
 *    it did, two renderers could format the same measurement differently.
 * 2. **No renderer types leak in.** Nothing in this file or in the builder may
 *    reference `@react-pdf/renderer`, so a second renderer can be added later
 *    without touching either.
 */

/** The report's header — the child's identity and the period it covers (EXP-3). */
export interface DocumentHeaderBlock {
  kind: 'documentHeader';
  childName: string;
  birthDate: string;
  /** The child's age on the day the report was generated. */
  ageAtReport: string;
  periodFrom: string;
  /** Inclusive last day of the period — `to` is an exclusive bound internally. */
  periodTo: string;
  createdAt: string;
}

export interface SectionHeadingBlock {
  kind: 'sectionHeading';
  text: string;
}

/** Aggregated numbers with no per-row detail — the tracking summary (EXP-7). */
export interface KeyFiguresBlock {
  kind: 'keyFigures';
  figures: { label: string; value: string }[];
}

export interface TableBlock {
  kind: 'table';
  caption?: string;
  columns: string[];
  rows: string[][];
}

/**
 * A chart as a standalone SVG document string (EXP-4).
 *
 * SVG rather than a raster image: `@react-pdf/renderer` parses SVG through
 * `@react-pdf/svg` and draws it as vectors, so the curve stays sharp at any
 * print resolution. The Phase 7.4 spike confirmed this end to end — see
 * ADR-0015's "Measured" section for the raster alternative that was rejected.
 */
export interface ChartBlock {
  kind: 'chart';
  title: string;
  svg: string;
}

export interface BodyTextBlock {
  kind: 'bodyText';
  text: string;
}

/**
 * Stands in for a section the user selected that turned out to have no data.
 *
 * Rendered instead of an empty table, and deliberately *not* omitted: a doctor
 * reading the report has to be able to tell "nothing was recorded" apart from
 * "this section was not requested".
 */
export interface EmptySectionNoteBlock {
  kind: 'emptySectionNote';
  text: string;
}

export type ReportBlock =
  | DocumentHeaderBlock
  | SectionHeadingBlock
  | KeyFiguresBlock
  | TableBlock
  | ChartBlock
  | BodyTextBlock
  | EmptySectionNoteBlock;

/** The report's language, passed in by the client and never guessed (EXP-8). */
export type ReportLocale = 'de' | 'en';

export interface ReportDocument {
  locale: ReportLocale;
  title: string;
  blocks: ReportBlock[];
}

/**
 * The individually selectable sections (EXP-2). `CORE` is the header and master
 * data; the other four map one-to-one onto phases 7.1–7.3 and the Phase 2–3
 * tracking data.
 */
export const REPORT_SECTIONS = ['CORE', 'GROWTH', 'MILESTONES', 'MEDICAL', 'TRACKING'] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

import { StyleSheet } from '@react-pdf/renderer';
import { reportTokens } from './report-tokens.generated';

/**
 * The report's stylesheet, built entirely from the generated design tokens
 * (EXP-9). No literal color or size appears below — anything that looks like
 * one would be a value the design system could no longer change.
 *
 * `StyleSheet.create` is called here rather than in the generated module, so
 * the design-system codegen stays free of any `@react-pdf/renderer` import.
 */
const { color, spacing, fontSize, fontWeight, lineHeight, radii } = reportTokens;

/** A4 portrait margin. Generous on purpose — a doctor annotates in the margin. */
const PAGE_PADDING = spacing[8];

/** Hairline rules: react-pdf draws sub-point widths cleanly, unlike a browser. */
const HAIRLINE = 0.5;

export const reportStyles = StyleSheet.create({
  page: {
    fontFamily: reportTokens.fontFamily.report,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
    color: color.foreground,
    backgroundColor: color.background,
    paddingVertical: PAGE_PADDING,
    paddingHorizontal: PAGE_PADDING,
  },

  documentTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing[2],
  },
  headerCard: {
    backgroundColor: color.muted,
    borderRadius: radii.md,
    padding: spacing[3],
    marginBottom: spacing[5],
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: spacing[1],
  },
  headerLabel: {
    width: '40%',
    color: color['muted-foreground'],
  },
  headerValue: {
    flex: 1,
    fontWeight: fontWeight.medium,
  },

  sectionHeading: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginTop: spacing[5],
    marginBottom: spacing[2],
    paddingBottom: spacing[1],
    borderBottomWidth: HAIRLINE,
    borderBottomColor: color.border,
  },

  bodyText: {
    color: color['muted-foreground'],
    marginTop: spacing[1],
  },
  emptySectionNote: {
    // Muted colour, deliberately not italic: only the four upright Inter faces
    // are vendored (see fonts/README.md), and react-pdf throws rather than
    // synthesising a style it has no file for.
    color: color['muted-foreground'],
    marginBottom: spacing[2],
  },

  keyFigureRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  keyFigure: {
    flex: 1,
    backgroundColor: color.muted,
    borderRadius: radii.md,
    padding: spacing[3],
  },
  keyFigureValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  keyFigureLabel: {
    fontSize: fontSize.xs,
    color: color['muted-foreground'],
  },

  tableCaption: {
    fontWeight: fontWeight.medium,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingBottom: spacing[1],
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: HAIRLINE,
    borderBottomColor: color.border,
    paddingVertical: spacing[1],
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: color['muted-foreground'],
    paddingRight: spacing[1],
  },
  tableCell: {
    flex: 1,
    fontSize: fontSize.xs,
    paddingRight: spacing[1],
  },

  chartTitle: {
    fontWeight: fontWeight.medium,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  chart: {
    marginBottom: spacing[2],
  },
});

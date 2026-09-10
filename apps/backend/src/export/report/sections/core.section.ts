import type { Child } from '@prisma/client';
import type { DocumentHeaderBlock } from '../report-document.types';
import { formatAge, formatReportDate } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';

/** One day in milliseconds — used to turn the exclusive `to` back into a day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CoreSectionInput {
  child: Child;
  /** Inclusive start of the reporting period. */
  from: Date;
  /** Exclusive end of the reporting period. */
  to: Date;
  createdAt: Date;
  strings: ReportStrings;
}

/**
 * The report header (EXP-3): who the report is about, how old they are, what
 * period it covers and when it was made.
 *
 * Always present — `CORE` is the one section the UI does not let the user
 * deselect, because a page of measurements with no name or date on it is not a
 * document anybody can hand to a doctor.
 */
export function buildCoreSection({
  child,
  from,
  to,
  createdAt,
  strings,
}: CoreSectionInput): DocumentHeaderBlock {
  // `to` is an exclusive bound internally (`occurredAt < to`), but a reader
  // expects an inclusive last day — "01.06. – 31.08.", not "– 01.09.".
  const lastDay = new Date(to.getTime() - MS_PER_DAY);

  return {
    kind: 'documentHeader',
    childName: child.name,
    birthDate: formatReportDate(strings.locale, child.birthDate),
    ageAtReport: formatAge(strings, child.birthDate, createdAt),
    periodFrom: formatReportDate(strings.locale, from),
    periodTo: formatReportDate(strings.locale, lastDay),
    createdAt: formatReportDate(strings.locale, createdAt),
  };
}

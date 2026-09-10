import type { MilestoneSummary } from '../../../milestone/milestone.service';
import type { ReportBlock } from '../report-document.types';
import { formatAge, formatReportDate } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';

export interface MilestonesSectionInput {
  birthDate: Date;
  milestones: MilestoneSummary[];
  strings: ReportStrings;
}

/**
 * The milestones section (EXP-5): what the child reached during the period,
 * with the date and the age it happened at.
 *
 * Oldest first, unlike the app's timeline (M-11, newest first): a report is
 * read as a developmental history, so it runs forwards through time.
 *
 * The stored `title` is used verbatim — it is frozen at creation time, so a
 * later rename of the template catalog never rewrites what parents recorded.
 * Photos are deliberately out of scope (see the phase 7.4 scope note): low
 * clinical value, high file size.
 */
export function buildMilestonesSection({
  birthDate,
  milestones,
  strings,
}: MilestonesSectionInput): ReportBlock[] {
  if (milestones.length === 0) {
    return [];
  }

  const chronological = [...milestones].sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));

  return [
    {
      kind: 'table',
      columns: [
        strings.t('common.date'),
        strings.t('common.age'),
        strings.t('milestones.column.title'),
        strings.t('milestones.column.category'),
      ],
      rows: chronological.map((milestone) => [
        formatReportDate(strings.locale, milestone.achievedAt),
        formatAge(strings, birthDate, new Date(milestone.achievedAt)),
        milestone.title,
        milestone.category
          ? strings.t(`milestones.category.${milestone.category}` as 'milestones.category.MOTOR')
          : strings.t('common.none'),
      ]),
    },
  ];
}

import type { PeriodTrackingSummary } from '../../../event/event.service';
import type { ReportBlock } from '../report-document.types';
import { formatReportNumber } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';

export interface TrackingSectionInput {
  summary: PeriodTrackingSummary;
  strings: ReportStrings;
}

/**
 * The daily-tracking section (EXP-7): aggregated averages only, never the
 * individual events.
 *
 * A doctor wants "roughly 7 feedings and 14 hours of sleep a day". A list of
 * every feed over three months is a spreadsheet, not a report — that belongs in
 * the raw CSV/JSON export, which already carries it.
 */
export function buildTrackingSection({ summary, strings }: TrackingSectionInput): ReportBlock[] {
  // No events at all in the period is genuinely "nothing recorded", not "an
  // average of zero" — the caller turns an empty result into the section's
  // empty note instead of printing three zeroes.
  if (summary.feedingCount === 0 && summary.diaperCount === 0 && summary.sleepHours === 0) {
    return [];
  }

  return [
    {
      kind: 'keyFigures',
      figures: [
        {
          label: strings.t('tracking.feedingsPerDay'),
          value: formatReportNumber(strings.locale, summary.feedingsPerDay),
        },
        {
          label: strings.t('tracking.sleepHoursPerDay'),
          value: formatReportNumber(strings.locale, summary.sleepHoursPerDay),
        },
        {
          label: strings.t('tracking.diapersPerDay'),
          value: formatReportNumber(strings.locale, summary.diapersPerDay),
        },
      ],
    },
    {
      kind: 'bodyText',
      text: strings.t('tracking.caption', {
        days: strings.t('age.days', { count: summary.days }),
      }),
    },
  ];
}

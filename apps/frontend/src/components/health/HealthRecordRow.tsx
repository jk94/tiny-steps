import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthRecordSummary } from '../../api/health-record-api';
import { formatCalendarDate } from '../../lib/calendarDate';
import { healthRecordVisuals, OVERDUE_BADGE_VARIANT } from '../../lib/healthRecordVisuals';
import { Badge, Card } from '../ui';

export interface HealthRecordRowProps {
  record: HealthRecordSummary;
  /** True when the planned date has passed without the entry being done (MED-6). */
  isOverdue?: boolean;
  /** Buttons/links owned by the section this row appears in. */
  actions: ReactNode;
}

/**
 * One medication/vaccination as both of MED-12's sections render it: the kind's
 * icon and label, the name, the date that section is about, and the
 * kind-specific detail (dose or batch).
 *
 * Shared between the two sections rather than duplicated, because they differ
 * only in *which* date they lead with and which actions they offer — the row
 * itself picks the date from the record's own state, so a "planned" row can
 * never accidentally print an administration date it does not have.
 */
export function HealthRecordRow({ record, isOverdue = false, actions }: HealthRecordRowProps) {
  const { t, i18n } = useTranslation();
  const visual = healthRecordVisuals[record.kind];

  // `administeredAt` is a real instant, `dueAt` a calendar day — hence two
  // different formatters, not one.
  const dateLabel = record.administeredAt
    ? t('health.row.administeredOn', {
        date: new Date(record.administeredAt).toLocaleString(i18n.language),
      })
    : record.dueAt
      ? t('health.row.dueOn', { date: formatCalendarDate(record.dueAt, i18n.language) })
      : null;

  const detail =
    record.kind === 'MEDICATION'
      ? record.doseAmount !== null && record.doseUnit !== null
        ? t('health.row.doseFormat', { amount: record.doseAmount, unit: record.doseUnit })
        : null
      : record.vaccineBatch
        ? t('health.row.batchFormat', { batch: record.vaccineBatch })
        : null;

  return (
    <Card>
      <Card.Body className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <visual.Icon
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          />

          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{record.name}</p>
            {dateLabel && <p className="text-sm text-muted-foreground">{dateLabel}</p>}
            {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
            {record.note && <p className="text-sm text-muted-foreground">{record.note}</p>}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {/* The kind is labelled as text, never carried by colour alone. */}
            <Badge variant={visual.badgeVariant} size="sm">
              {t(visual.labelKey)}
            </Badge>
            {isOverdue && (
              <Badge variant={OVERDUE_BADGE_VARIANT} size="sm">
                {t('health.row.overdueBadge')}
              </Badge>
            )}
            {record.reminderEnabled && record.administeredAt === null && (
              <span className="text-xs text-muted-foreground">{t('health.row.reminderBadge')}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
      </Card.Body>
    </Card>
  );
}

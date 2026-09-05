import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  deleteGrowthMeasurement,
  growthQueryKey,
  type GrowthMeasurementSummary,
} from '../../api/growth-api';
import { listHouseholdMembers, type HouseholdMemberSummary } from '../../api/household-api';
import { ageInMonths } from '../../lib/childAge';
import { formatCalendarDate, parseCalendarDate } from '../../lib/calendarDate';
import { GROWTH_MEASURES } from '../../lib/growthMeasureVisuals';
import {
  canEditEntry,
  canWrite,
  FULL_WRITE_ROLES,
  type HouseholdRole,
} from '../../lib/householdPermissions';
import { ConfirmDialog } from '../ConfirmDialog';
import { ErrorMessage } from '../ErrorMessage';
import { Button, Card, EmptyState, Skeleton, toast } from '../ui';
import { GrowthMeasureValueRow } from './GrowthMeasureValueRow';

export interface GrowthMeasurementListProps {
  householdId: string;
  childId: string;
  /** ISO birth date, used to state the child's age at each measurement. */
  birthDate: string;
  measurements: GrowthMeasurementSummary[];
  isLoading: boolean;
  /** The signed-in user's role in this household; gates edit/delete. */
  role: HouseholdRole | undefined;
  /** The signed-in user's id, for the ownership half of the edit check. */
  currentUserId: string | undefined;
}

/**
 * Resolves a recording user's id to their email via the household member list
 * — the only user-identifying field this app has. Falls back to a neutral
 * label rather than exposing a raw id while the members query is in flight.
 */
function resolveUserLabel(
  userId: string,
  members: HouseholdMemberSummary[] | undefined,
  fallback: string,
): string {
  return members?.find((candidate) => candidate.userId === userId)?.email ?? fallback;
}

/**
 * All recorded measurements, newest first (the API returns them oldest-first
 * for the chart, so the order is reversed here rather than fetched twice).
 *
 * The measurement list is rendered from the same query the chart uses — one
 * request, one source of truth for "what has been recorded".
 */
export function GrowthMeasurementList({
  householdId,
  childId,
  birthDate,
  measurements,
  isLoading,
  role,
  currentUserId,
}: GrowthMeasurementListProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: () => listHouseholdMembers(householdId),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (measurementId: string) =>
      deleteGrowthMeasurement(householdId, childId, measurementId),
    onSuccess: async () => {
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: growthQueryKey(householdId, childId) });
    },
    onError: () => {
      // W-16 again: online-only, so a failed delete is surfaced, never queued.
      setPendingDeleteId(null);
      toast.error(t('growth.validation.deleteFailed'));
    },
  });

  if (isLoading) {
    return (
      <ul className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <Card>
              <Card.Body className="flex flex-col gap-2">
                <Skeleton shape="text" className="h-4 w-32" />
                <Skeleton shape="text" className="h-3 w-48" />
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  if (measurements.length === 0) {
    return (
      <EmptyState
        title={t('growth.list.empty.title')}
        description={t('growth.list.empty.description')}
        action={
          <Link
            to={`/households/${householdId}/children/${childId}/growth/new`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('growth.list.empty.cta')}
          </Link>
        }
      />
    );
  }

  const newestFirst = [...measurements].reverse();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('growth.list.title')}
      </h2>

      <ul className="flex flex-col gap-2">
        {newestFirst.map((measurement) => (
          <li key={measurement.id}>
            <Card>
              <Card.Body className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {formatCalendarDate(measurement.measuredAt, i18n.language)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('growth.list.ageAtMeasurement', {
                      count: ageInMonths(
                        birthDate,
                        parseCalendarDate(measurement.measuredAt) ?? new Date(),
                      ),
                    })}
                  </span>
                </div>

                <ul className="flex flex-col gap-1">
                  {GROWTH_MEASURES.map((measure) => (
                    <GrowthMeasureValueRow
                      key={measure}
                      measure={measure}
                      measurement={measurement}
                    />
                  ))}
                </ul>

                {measurement.note && (
                  <p className="text-sm text-muted-foreground">{measurement.note}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('growth.list.recordedBy', {
                      name: resolveUserLabel(
                        measurement.userId,
                        membersQuery.data,
                        t('growth.list.unknownUser'),
                      ),
                    })}
                  </span>
                  <span className="flex items-center gap-3">
                    {canEditEntry(role, measurement.userId, currentUserId) && (
                      <Link
                        to={`/households/${householdId}/children/${childId}/growth/${measurement.id}/edit`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('growth.list.editLink')}
                      </Link>
                    )}
                    {canWrite(role, FULL_WRITE_ROLES) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteId(measurement.id)}
                      >
                        {t('growth.list.deleteButton')}
                      </Button>
                    )}
                  </span>
                </div>
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>

      {deleteMutation.isError && <ErrorMessage message={t('growth.validation.deleteFailed')} />}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={t('growth.list.deleteDialog.title')}
        description={t('growth.list.deleteDialog.description')}
        confirmLabel={t('growth.list.deleteDialog.confirmButton')}
        cancelLabel={t('growth.list.deleteDialog.cancelButton')}
        isConfirming={deleteMutation.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMutation.mutate(pendingDeleteId);
          }
        }}
      />
    </section>
  );
}

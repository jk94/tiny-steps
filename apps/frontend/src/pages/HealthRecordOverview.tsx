import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import {
  deleteHealthRecord,
  healthRecordsQueryKey,
  listHealthRecords,
  updateHealthRecord,
  type HealthRecordSummary,
} from '../api/health-record-api';
import { useAuth } from '../auth/useAuth';
import { mapChildError } from '../child/mapChildError';
import { useHouseholdRole } from '../household/useHouseholdRole';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { HealthRecordRow } from '../components/health/HealthRecordRow';
import { Button, Card, EmptyState, Skeleton, toast } from '../components/ui';
import { mapHealthRecordError } from '../health/mapHealthRecordError';
import { todayAsCalendarDate, toCalendarDateInputValue } from '../lib/calendarDate';
import {
  canEditEntry,
  canWrite,
  ENTRY_WRITE_ROLES,
  FULL_WRITE_ROLES,
} from '../lib/householdPermissions';

/** A planned entry whose due day has passed (MED-6/MED-12). */
function isOverdue(record: HealthRecordSummary, today: string): boolean {
  return record.dueAt !== null && toCalendarDateInputValue(record.dueAt) < today;
}

/**
 * Medications and vaccinations for one child, split into MED-12's two
 * sections: what is still coming (or already overdue), ascending by due date,
 * and what has been given, descending by administration date.
 *
 * Both come from a single unfiltered list query — the split is presentation,
 * and two filtered requests would just double the latency of this screen.
 *
 * Deliberately does NOT call `useHouseholdRoom`: health records are online-only
 * with no realtime push (MED-15). One recorded on another device shows up on
 * the next visit, which is the right granularity for a handful of entries.
 */
export function HealthRecordOverview() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const { user } = useAuth();
  const { role } = useHouseholdRole(householdId);
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const basePath = `/households/${householdId}/children/${childId}/health`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const recordsQuery = useQuery({
    queryKey: healthRecordsQueryKey(householdId!, childId!),
    queryFn: () => listHealthRecords(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const invalidateRecords = () =>
    queryClient.invalidateQueries({ queryKey: healthRecordsQueryKey(householdId!, childId!) });

  // MED-5: one tap, no intermediate confirm dialog. The result is an ordinary
  // record whose timestamp stays editable on the edit page, so a mis-tap costs
  // a correction rather than being unrecoverable.
  const markDoneMutation = useMutation({
    mutationFn: (recordId: string) =>
      updateHealthRecord(householdId!, childId!, recordId, {
        administeredAt: new Date().toISOString(),
      }),
    onSuccess: invalidateRecords,
    onError: (error) => {
      // MED-15: online-only, so a failure is surfaced, never queued.
      toast.error(t(mapHealthRecordError(error)));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (recordId: string) => deleteHealthRecord(householdId!, childId!, recordId),
    onSuccess: async () => {
      setPendingDeleteId(null);
      await invalidateRecords();
    },
    onError: () => {
      setPendingDeleteId(null);
      toast.error(t('health.validation.deleteFailed'));
    },
  });

  if (childQuery.isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-7 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;
  const records = recordsQuery.data ?? [];
  const today = todayAsCalendarDate();

  // Derived from `administeredAt` rather than a stored status, exactly like the
  // backend's own filter, so the two can never disagree.
  const upcoming = records
    .filter((record) => record.administeredAt === null && record.dueAt !== null)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const history = records
    .filter((record) => record.administeredAt !== null)
    .sort((a, b) => b.administeredAt!.localeCompare(a.administeredAt!));

  const mayEdit = (record: HealthRecordSummary) => canEditEntry(role, record.userId, user?.id);
  const mayDelete = canWrite(role, FULL_WRITE_ROLES);
  const mayRecord = canWrite(role, ENTRY_WRITE_ROLES);

  // Deliberately role-only, with NO ownership check: the backend lets any
  // ENTRY_WRITE_ROLES member (i.e. also a CAREGIVER) mark someone else's planned
  // record as done, because `isMarkAsDoneOnly()` bypasses the ownership
  // assertion for a PATCH that carries nothing but `administeredAt` — which is
  // exactly what `markDoneMutation` sends. Do not "fix" this into canEditEntry.
  const mayMarkAsDone = mayRecord;

  /**
   * The action cluster for one row, or `undefined` when this role has no action
   * on it at all — so `HealthRecordRow` can skip its wrapper instead of
   * rendering an empty flex box. `withMarkDone` is true only in the upcoming
   * section; a record in the history is already done.
   */
  const rowActions = (
    record: HealthRecordSummary,
    withMarkDone: boolean,
  ): ReactNode | undefined => {
    const showMarkDone = withMarkDone && mayMarkAsDone;
    const showEdit = mayEdit(record);
    if (!showMarkDone && !showEdit && !mayDelete) {
      return undefined;
    }
    return (
      <>
        {showMarkDone && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={markDoneMutation.isPending}
            onClick={() => markDoneMutation.mutate(record.id)}
          >
            {markDoneMutation.isPending && markDoneMutation.variables === record.id
              ? t('health.row.markDonePending')
              : t('health.row.markDone')}
          </Button>
        )}
        {showEdit && (
          <Link
            to={`${basePath}/${record.id}/edit`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('health.row.editLink')}
          </Link>
        )}
        {mayDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPendingDeleteId(record.id)}
          >
            {t('health.row.deleteButton')}
          </Button>
        )}
      </>
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}/children/${childId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('health.overview.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('health.overview.title', { name: child.name })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('health.overview.subtitle')}</p>
      </div>

      {/* Both sections below stay readable for every role — only the
          invitation to record a new entry is gated. */}
      {mayRecord && (
        <Link to={`${basePath}/new`} className="text-sm font-medium text-primary hover:underline">
          {t('health.overview.addLink')}
        </Link>
      )}

      {recordsQuery.error ? (
        <ErrorMessage message={t('health.overview.loadFailed')} />
      ) : recordsQuery.isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {t('health.overview.upcomingSectionTitle')}
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <Card.Body>
                  <EmptyState description={t('health.overview.upcomingEmpty')} />
                </Card.Body>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((record) => (
                  <li key={record.id}>
                    <HealthRecordRow
                      record={record}
                      isOverdue={isOverdue(record, today)}
                      actions={rowActions(record, true)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {t('health.overview.historySectionTitle')}
            </h2>
            {history.length === 0 ? (
              <Card>
                <Card.Body>
                  <EmptyState description={t('health.overview.historyEmpty')} />
                </Card.Body>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((record) => (
                  <li key={record.id}>
                    <HealthRecordRow record={record} actions={rowActions(record, false)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={t('health.row.deleteDialog.title')}
        description={t('health.row.deleteDialog.description')}
        confirmLabel={t('health.row.deleteDialog.confirmButton')}
        cancelLabel={t('health.row.deleteDialog.cancelButton')}
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

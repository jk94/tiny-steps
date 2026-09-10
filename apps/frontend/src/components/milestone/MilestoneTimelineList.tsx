import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  deleteMilestone,
  milestonePhotoUrl,
  milestonesQueryKey,
  type MilestoneSummary,
} from '../../api/milestone-api';
import { listHouseholdMembers, type HouseholdMemberSummary } from '../../api/household-api';
import { formatCalendarDate } from '../../lib/calendarDate';
import {
  canEditEntry,
  canWrite,
  ENTRY_WRITE_ROLES,
  FULL_WRITE_ROLES,
  type HouseholdRole,
} from '../../lib/householdPermissions';
import { milestoneCategoryVisuals } from '../../lib/milestoneCategoryVisuals';
import { ConfirmDialog } from '../ConfirmDialog';
import { ErrorMessage } from '../ErrorMessage';
import { Badge, Button, Card, EmptyState, Skeleton, toast } from '../ui';
import { MilestonePhotoGallery } from './MilestonePhotoGallery';

/** How many thumbnails fit next to the text before a "+N" takes over. */
const VISIBLE_THUMBNAILS = 3;

export interface MilestoneTimelineListProps {
  householdId: string;
  childId: string;
  /** Already newest-first — the API returns them in timeline order (M-11). */
  milestones: MilestoneSummary[];
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
 * The milestone timeline (M-11): date and age on the left, title/note in the
 * middle, a photo preview on the right.
 *
 * Renders the server list verbatim — no `src/offline/` merge the way the event
 * lists do, because milestones are online-only (M-15) and nothing is ever
 * pending locally.
 */
export function MilestoneTimelineList({
  householdId,
  childId,
  milestones,
  isLoading,
  role,
  currentUserId,
}: MilestoneTimelineListProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ milestoneId: string; index: number } | null>(null);

  const membersQuery = useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: () => listHouseholdMembers(householdId),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (milestoneId: string) => deleteMilestone(householdId, childId, milestoneId),
    onSuccess: async () => {
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey(householdId, childId) });
    },
    onError: () => {
      // M-15 again: online-only, so a failed delete is surfaced, never queued.
      setPendingDeleteId(null);
      toast.error(t('milestone.validation.deleteFailed'));
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

  const mayRecord = canWrite(role, ENTRY_WRITE_ROLES);
  const mayDelete = canWrite(role, FULL_WRITE_ROLES);

  if (milestones.length === 0) {
    return (
      <EmptyState
        title={t('milestone.list.empty.title')}
        description={t('milestone.list.empty.description')}
        // A read-only role still learns that nothing has been recorded — it
        // just isn't invited to record something it may not record.
        action={
          mayRecord ? (
            <Link
              to={`/households/${householdId}/children/${childId}/milestones/new`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('milestone.list.empty.cta')}
            </Link>
          ) : undefined
        }
      />
    );
  }

  const galleryMilestone = milestones.find((entry) => entry.id === gallery?.milestoneId);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('milestone.list.title')}
      </h2>

      <ul className="flex flex-col gap-2">
        {milestones.map((milestone) => {
          const visual = milestone.category ? milestoneCategoryVisuals[milestone.category] : null;
          const visiblePhotos = milestone.photos.slice(0, VISIBLE_THUMBNAILS);
          const hiddenPhotoCount = milestone.photos.length - visiblePhotos.length;
          const mayEdit = canEditEntry(role, milestone.userId, currentUserId);

          return (
            <li key={milestone.id}>
              <Card>
                <Card.Body className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col gap-1">
                      <time
                        dateTime={milestone.achievedAt.slice(0, 10)}
                        className="text-sm font-medium text-foreground"
                      >
                        {formatCalendarDate(milestone.achievedAt, i18n.language)}
                      </time>
                      <span className="text-xs text-muted-foreground">
                        {t('milestone.list.ageAtMilestone', {
                          count: milestone.ageInMonthsAtMilestone,
                        })}
                      </span>
                      {visual && (
                        <span className="flex items-center gap-1 self-start">
                          <visual.Icon
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            style={{ color: `var(${visual.colorVar})` }}
                          />
                          <Badge variant={visual.badgeVariant} size="sm">
                            {t(visual.labelKey)}
                          </Badge>
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* The stored title, never a re-translation of the
                          template key — see the backend schema comment. */}
                      <p className="font-medium text-foreground">{milestone.title}</p>
                      {milestone.note && (
                        <p className="text-sm text-muted-foreground">{milestone.note}</p>
                      )}
                    </div>

                    {visiblePhotos.length > 0 && (
                      <div className="flex shrink-0 items-center gap-1">
                        {visiblePhotos.map((photo, photoIndex) => (
                          <button
                            key={photo.id}
                            type="button"
                            className="rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label={t('milestone.list.openGallery', { title: milestone.title })}
                            onClick={() =>
                              setGallery({ milestoneId: milestone.id, index: photoIndex })
                            }
                          >
                            <img
                              src={milestonePhotoUrl(householdId, childId, milestone.id, photo.id)}
                              alt=""
                              aria-hidden="true"
                              className="h-12 w-12 rounded object-cover"
                            />
                          </button>
                        ))}
                        {hiddenPhotoCount > 0 && (
                          <button
                            type="button"
                            className="rounded text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label={t('milestone.list.openGallery', { title: milestone.title })}
                            onClick={() =>
                              setGallery({ milestoneId: milestone.id, index: VISIBLE_THUMBNAILS })
                            }
                          >
                            {t('milestone.list.morePhotos', { count: hiddenPhotoCount })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t('milestone.list.recordedBy', {
                        name: resolveUserLabel(
                          milestone.userId,
                          membersQuery.data,
                          t('milestone.list.unknownUser'),
                        ),
                      })}
                    </span>
                    {/* Rendered only when there is something in it — an empty
                        flex box would still consume the row's gap and leave a
                        dead strip on every row for a read-only role. */}
                    {(mayEdit || mayDelete) && (
                      <span className="flex items-center gap-3">
                        {mayEdit && (
                          <Link
                            to={`/households/${householdId}/children/${childId}/milestones/${milestone.id}/edit`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {t('milestone.list.editLink')}
                          </Link>
                        )}
                        {mayDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeleteId(milestone.id)}
                          >
                            {t('milestone.list.deleteButton')}
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </li>
          );
        })}
      </ul>

      {deleteMutation.isError && <ErrorMessage message={t('milestone.validation.deleteFailed')} />}

      {galleryMilestone && gallery && (
        <MilestonePhotoGallery
          householdId={householdId}
          childId={childId}
          milestoneId={galleryMilestone.id}
          milestoneTitle={galleryMilestone.title}
          photos={galleryMilestone.photos}
          initialIndex={gallery.index}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setGallery(null);
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={t('milestone.list.deleteDialog.title')}
        description={t('milestone.list.deleteDialog.description')}
        confirmLabel={t('milestone.list.deleteDialog.confirmButton')}
        cancelLabel={t('milestone.list.deleteDialog.cancelButton')}
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

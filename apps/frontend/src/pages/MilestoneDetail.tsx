import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { listHouseholdMembers, type HouseholdMemberSummary } from '../api/household-api';
import {
  deleteMilestone,
  fetchMilestone,
  milestonePhotoUrl,
  milestoneQueryKey,
  milestonesQueryKey,
  type MilestoneSummary,
} from '../api/milestone-api';
import { useAuth } from '../auth/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { MilestoneCover } from '../components/milestone/MilestoneCover';
import { MilestonePhotoGallery } from '../components/milestone/MilestonePhotoGallery';
import { TransitionLink } from '../components/TransitionLink';
import { Badge, Button, Card, Skeleton, toast } from '../components/ui';
import { useHouseholdRole } from '../household/useHouseholdRole';
import { formatCalendarDate } from '../lib/calendarDate';
import { childPath } from '../lib/childAreas';
import { canEditEntry, canWrite, FULL_WRITE_ROLES } from '../lib/householdPermissions';
import { milestoneCategoryVisuals } from '../lib/milestoneCategoryVisuals';
import { viewTransitionStyle } from '../lib/viewTransition';
import { mapMilestoneError } from '../milestone/mapMilestoneError';

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
 * One milestone in full: the cover (its first photo, or its category's
 * illustration), every further photo, title, category, date and age, the note,
 * who recorded it — and the edit/delete actions the timeline tiles deliberately
 * leave out.
 *
 * Permissions are the same as they were on the old timeline rows: editing
 * needs `canEditEntry` (FULL_WRITE_ROLES, or a CAREGIVER on their own entry),
 * deleting needs FULL_WRITE_ROLES with no ownership exception.
 *
 * Online-only like the rest of the milestone feature (M-15): a failed delete is
 * surfaced and nothing is queued. Arriving from the timeline, the list's cached
 * entry is shown immediately (`placeholderData`), so the tile's cover can
 * expand straight into this page's cover during the view transition.
 */
export function MilestoneDetail() {
  const { t, i18n } = useTranslation();
  const { householdId, childId, milestoneId } = useParams<{
    householdId: string;
    childId: string;
    milestoneId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role } = useHouseholdRole(householdId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const listPath = childPath(householdId!, childId!, 'milestones');

  const milestoneQuery = useQuery({
    queryKey: milestoneQueryKey(householdId!, childId!, milestoneId!),
    queryFn: () => fetchMilestone(householdId!, childId!, milestoneId!),
    retry: false,
    enabled: !!householdId && !!childId && !!milestoneId,
    placeholderData: () =>
      queryClient
        .getQueryData<MilestoneSummary[]>(milestonesQueryKey(householdId!, childId!))
        ?.find((candidate) => candidate.id === milestoneId),
  });

  const membersQuery = useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: () => listHouseholdMembers(householdId!),
    retry: false,
    enabled: !!householdId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMilestone(householdId!, childId!, milestoneId!),
    onSuccess: async () => {
      setIsConfirmingDelete(false);
      queryClient.removeQueries({
        queryKey: milestoneQueryKey(householdId!, childId!, milestoneId!),
      });
      await queryClient.invalidateQueries({
        queryKey: milestonesQueryKey(householdId!, childId!),
      });
      toast.success(t('milestone.detail.deleted'));
      await navigate(listPath, { replace: true });
    },
    onError: () => {
      // M-15 again: online-only, so a failed delete is surfaced, never queued.
      setIsConfirmingDelete(false);
      toast.error(t('milestone.validation.deleteFailed'));
    },
  });

  if (milestoneQuery.isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-4 w-32" />
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <Skeleton shape="text" className="h-7 w-2/3" />
        <Skeleton shape="text" className="h-4 w-1/2" />
      </section>
    );
  }

  if (milestoneQuery.error || !milestoneQuery.data) {
    return <ErrorMessage message={t(mapMilestoneError(milestoneQuery.error))} />;
  }

  const milestone = milestoneQuery.data;
  const visual = milestone.category ? milestoneCategoryVisuals[milestone.category] : null;
  const mayEdit = canEditEntry(role, milestone.userId, user?.id);
  const mayDelete = canWrite(role, FULL_WRITE_ROLES);
  const hasPhotos = milestone.photos.length > 0;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <TransitionLink
        to={listPath}
        className="inline-flex items-center gap-1 self-start text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t('milestone.detail.backLink')}
      </TransitionLink>

      {hasPhotos ? (
        <button
          type="button"
          onClick={() => setGalleryIndex(0)}
          aria-label={t('milestone.list.openGallery', { title: milestone.title })}
          className="group overflow-hidden rounded-xl shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <MilestoneCover
            householdId={householdId!}
            childId={childId!}
            milestone={milestone}
            className="aspect-[4/3] w-full"
            style={viewTransitionStyle('milestone-cover', milestone.id)}
          />
        </button>
      ) : (
        <MilestoneCover
          householdId={householdId!}
          childId={childId!}
          milestone={milestone}
          className="aspect-[16/9] w-full rounded-xl"
          illustrationClassName="h-3/4 w-3/4"
          style={viewTransitionStyle('milestone-cover', milestone.id)}
        />
      )}

      {milestone.photos.length > 1 && (
        <ul className="-mt-2 flex gap-2 overflow-x-auto pb-1">
          {milestone.photos.map((photo, index) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setGalleryIndex(index)}
                aria-label={t('milestone.gallery.photoAlt', {
                  index: index + 1,
                  title: milestone.title,
                })}
                className="block overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <img
                  src={milestonePhotoUrl(householdId!, childId!, milestone.id, photo.id)}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 object-cover transition-transform hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <header className="flex flex-col gap-2">
        {visual && (
          <Badge variant={visual.badgeVariant} className="gap-1.5">
            <visual.Icon aria-hidden="true" />
            {t(visual.labelKey)}
          </Badge>
        )}
        {/* The stored title, never a re-translation of the template key. */}
        <h1 className="text-3xl leading-tight font-black text-foreground">{milestone.title}</h1>
        <p className="text-sm font-semibold text-muted-foreground">
          <time dateTime={milestone.achievedAt.slice(0, 10)}>
            {t('milestone.card.achievedOn', {
              date: formatCalendarDate(milestone.achievedAt, i18n.language),
            })}
          </time>
          {' · '}
          {t('milestone.list.ageAtMilestone', { count: milestone.ageInMonthsAtMilestone })}
        </p>
      </header>

      {milestone.note && (
        <Card className="bg-[color-mix(in_oklab,var(--color-milestone)_6%,var(--color-card))]">
          <Card.Body className="flex flex-col gap-1">
            <h2 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">
              {t('milestone.detail.noteTitle')}
            </h2>
            <p className="whitespace-pre-line text-foreground">{milestone.note}</p>
          </Card.Body>
        </Card>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound aria-hidden="true" className="h-4 w-4" />
        {t('milestone.list.recordedBy', {
          name: resolveUserLabel(
            milestone.userId,
            membersQuery.data,
            t('milestone.list.unknownUser'),
          ),
        })}
      </p>

      {(mayEdit || mayDelete) && (
        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
          {mayEdit && (
            <Button asChild>
              <Link to={`${listPath}/${milestone.id}/edit`}>
                <Pencil aria-hidden="true" />
                {t('milestone.list.editLink')}
              </Link>
            </Button>
          )}
          {mayDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setIsConfirmingDelete(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('milestone.list.deleteButton')}
            </Button>
          )}
        </div>
      )}

      {deleteMutation.isError && <ErrorMessage message={t('milestone.validation.deleteFailed')} />}

      {galleryIndex !== null && (
        <MilestonePhotoGallery
          householdId={householdId!}
          childId={childId!}
          milestoneId={milestone.id}
          milestoneTitle={milestone.title}
          photos={milestone.photos}
          initialIndex={galleryIndex}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setGalleryIndex(null);
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title={t('milestone.list.deleteDialog.title')}
        description={t('milestone.list.deleteDialog.description')}
        confirmLabel={t('milestone.list.deleteDialog.confirmButton')}
        cancelLabel={t('milestone.list.deleteDialog.cancelButton')}
        isConfirming={deleteMutation.isPending}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </article>
  );
}

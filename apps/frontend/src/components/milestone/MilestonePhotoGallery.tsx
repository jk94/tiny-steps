import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { milestonePhotoUrl, type MilestonePhotoRef } from '../../api/milestone-api';
import { Button, Dialog } from '../ui';

export interface MilestonePhotoGalleryProps {
  householdId: string;
  childId: string;
  milestoneId: string;
  /** The milestone's title, used for the images' accessible names. */
  milestoneTitle: string;
  /** Already ordered by `sortIndex` — the API guarantees it (M-10). */
  photos: MilestonePhotoRef[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Index the gallery opens on, e.g. the thumbnail that was clicked. */
  initialIndex?: number;
}

/**
 * Full-size photo viewer for one milestone, on top of the shared `Dialog`
 * primitive.
 *
 * Deliberately plain: previous/next within this milestone's photos, no zoom,
 * no swipe gestures, no cross-milestone browsing. Image *editing* is
 * explicitly out of scope for this phase, and a lightbox library would be a
 * dependency for one screen.
 *
 * The images are addressed by photo id through the authenticated serve
 * endpoint (M-8) — a stored path never reaches the client.
 */
export function MilestonePhotoGallery({
  householdId,
  childId,
  milestoneId,
  milestoneTitle,
  photos,
  isOpen,
  onOpenChange,
  initialIndex = 0,
}: MilestonePhotoGalleryProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);

  if (photos.length === 0) {
    return null;
  }

  // Clamp rather than trust: a photo deleted while the gallery is open would
  // otherwise leave the index past the end.
  const safeIndex = Math.min(index, photos.length - 1);
  const photo = photos[safeIndex];

  const step = (delta: number) => {
    // Wraps around, so the arrows never dead-end on a two-photo milestone.
    setIndex((current) => (current + delta + photos.length) % photos.length);
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} aria-label={t('milestone.gallery.title')}>
      <Dialog.Header>
        <Dialog.Title>{milestoneTitle}</Dialog.Title>
        <Dialog.Description>
          {t('milestone.gallery.counter', { current: safeIndex + 1, total: photos.length })}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Body className="flex flex-col gap-3">
        <img
          src={milestonePhotoUrl(householdId, childId, milestoneId, photo.id)}
          alt={t('milestone.gallery.photoAlt', {
            index: safeIndex + 1,
            title: milestoneTitle,
          })}
          className="max-h-[60vh] w-full rounded object-contain"
        />
        {photos.length > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t('milestone.gallery.previous')}
              onClick={() => step(-1)}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t('milestone.gallery.next')}
              onClick={() => step(1)}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Dialog.Body>
    </Dialog>
  );
}

import type { CSSProperties } from 'react';
import { milestonePhotoUrl, type MilestoneSummary } from '../../api/milestone-api';
import { cn } from '../../lib/cn';
import {
  milestoneCategoryVisuals,
  UNCATEGORISED_MILESTONE_COVER,
} from '../../lib/milestoneCategoryVisuals';

export interface MilestoneCoverProps {
  householdId: string;
  childId: string;
  milestone: MilestoneSummary;
  className?: string;
  style?: CSSProperties;
  /** Size of the fallback illustration relative to the cover. */
  illustrationClassName?: string;
}

/**
 * A milestone's cover picture: its first photo (the API orders photos by
 * `sortIndex`, M-10), or — without any — its category's illustration on a
 * category-tinted surface. Purely decorative: wherever it appears, the title
 * next to it names the milestone, so the image itself carries no alt text.
 */
export function MilestoneCover({
  householdId,
  childId,
  milestone,
  className,
  style,
  illustrationClassName = 'h-3/5 w-3/5',
}: MilestoneCoverProps) {
  const firstPhoto = milestone.photos[0];
  const cover = milestone.category
    ? milestoneCategoryVisuals[milestone.category]
    : UNCATEGORISED_MILESTONE_COVER;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        !firstPhoto && cover.coverTint,
        className,
      )}
      style={style}
    >
      {firstPhoto ? (
        <img
          src={milestonePhotoUrl(householdId, childId, milestone.id, firstPhoto.id)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <cover.Illustration
          className={cn(
            'transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3',
            illustrationClassName,
          )}
        />
      )}
    </div>
  );
}

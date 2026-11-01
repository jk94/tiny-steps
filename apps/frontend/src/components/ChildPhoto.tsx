import type { HTMLAttributes } from 'react';
import { childPhotoUrl } from '../api/child-api';
import { getPhotoCacheBust } from '../child/childPhotoCacheBust';
import { cn } from '../lib/cn';
import { BabyIllustration } from './illustrations';
import { Avatar } from './ui';

export interface ChildPhotoProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  childId: string;
  householdId: string;
  hasPhoto: boolean;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Without an uploaded photo, show the baby illustration instead of initials
   * — used on the large, decorative child tiles and the child-home hero, where
   * two letters on a grey disc would look like a placeholder.
   */
  illustrationFallback?: boolean;
}

/**
 * A child's photo as an `Avatar`: shows the uploaded photo, or falls back to
 * initials. Not routed through `apiFetch` — cookies are sent automatically
 * on a same-origin image request. The `v` cache-bust query param comes from
 * `childPhotoCacheBust.ts`, since the backend exposes no photo version/
 * `updatedAt` field to key off of. Forwards extra attributes (e.g.
 * `aria-hidden`) to `Avatar` — needed when a sibling element already
 * conveys the child's name, so the two don't double up in an ancestor
 * link/button's computed accessible name.
 */
export function ChildPhoto({
  childId,
  householdId,
  hasPhoto,
  name,
  size,
  illustrationFallback = false,
  className,
  ...rest
}: ChildPhotoProps) {
  if (!hasPhoto && illustrationFallback) {
    return (
      <span
        data-slot="avatar"
        role="img"
        aria-label={name}
        className={cn(
          'inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white',
          className,
        )}
        {...rest}
      >
        <BabyIllustration className="h-[115%] w-[115%]" />
      </span>
    );
  }

  return (
    <Avatar
      name={name}
      size={size}
      className={className}
      src={hasPhoto ? childPhotoUrl(householdId, childId, getPhotoCacheBust(childId)) : undefined}
      {...rest}
    />
  );
}

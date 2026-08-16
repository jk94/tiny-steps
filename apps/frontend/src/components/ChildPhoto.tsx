import type { HTMLAttributes } from 'react';
import { childPhotoUrl } from '../api/child-api';
import { getPhotoCacheBust } from '../child/childPhotoCacheBust';
import { Avatar } from './ui';

export interface ChildPhotoProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  childId: string;
  householdId: string;
  hasPhoto: boolean;
  name: string;
  size?: 'sm' | 'md' | 'lg';
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
  ...rest
}: ChildPhotoProps) {
  return (
    <Avatar
      name={name}
      size={size}
      src={hasPhoto ? childPhotoUrl(householdId, childId, getPhotoCacheBust(childId)) : undefined}
      {...rest}
    />
  );
}

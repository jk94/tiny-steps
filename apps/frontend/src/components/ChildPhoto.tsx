import { childPhotoUrl } from '../api/child-api';
import { getPhotoCacheBust } from '../child/childPhotoCacheBust';
import { useTranslation } from 'react-i18next';

export interface ChildPhotoProps {
  childId: string;
  householdId: string;
  hasPhoto: boolean;
  name: string;
}

/**
 * Renders a child's photo as a plain `<img>` (not routed through
 * `apiFetch` — cookies are sent automatically on a same-origin image
 * request), or a minimal placeholder when no photo has been uploaded. The
 * `v` cache-bust query param comes from `childPhotoCacheBust.ts`, since the
 * backend exposes no photo version/`updatedAt` field to key off of.
 */
export function ChildPhoto({ childId, householdId, hasPhoto, name }: ChildPhotoProps) {
  const { t } = useTranslation();

  if (!hasPhoto) {
    return <div aria-hidden="true">{name.charAt(0).toUpperCase()}</div>;
  }

  return (
    <img
      src={childPhotoUrl(householdId, childId, getPhotoCacheBust(childId))}
      alt={t('child.list.photoAlt', { name })}
    />
  );
}

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { X } from 'lucide-react';
import type { MilestoneCategory } from '../../api/milestone-api';
import { todayAsCalendarDate } from '../../lib/calendarDate';
import {
  getTemplateEntry,
  milestoneTemplateLabelKey,
  MILESTONE_TEMPLATES,
} from '../../lib/milestoneCatalog';
import { MILESTONE_CATEGORIES, milestoneCategoryVisuals } from '../../lib/milestoneCategoryVisuals';
import { MAX_MILESTONE_TITLE_LENGTH, MAX_NOTE_LENGTH } from '../../lib/milestoneLimits';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_MILESTONE,
} from '../../lib/photoConstraints';
import { mergePhotoResults } from '../../milestone/uploadQueuedPhotos';
import type { PhotoUploadStatus, QueuedPhoto } from '../../milestone/uploadQueuedPhotos';
import { ErrorMessage } from '../ErrorMessage';
import { Badge, Button, Input, Select, Textarea } from '../ui';

/**
 * UI-only value of the "no category" option. Radix's `Select` reserves the
 * empty string, and the API expresses "no category" by omitting the field —
 * so the two cannot be the same token.
 */
const CATEGORY_NONE_OPTION = 'NONE';

type MilestoneFieldErrorKey =
  | 'milestone.validation.titleRequired'
  | 'milestone.validation.titleTooLong'
  | 'milestone.validation.templateRequired'
  | 'milestone.validation.achievedAtRequired'
  | 'milestone.validation.achievedAtInFuture'
  | 'milestone.validation.achievedAtBeforeBirth'
  | 'milestone.validation.noteTooLong'
  | 'milestone.validation.photosNeedAttention';

interface FieldErrors {
  template?: MilestoneFieldErrorKey;
  title?: MilestoneFieldErrorKey;
  achievedAt?: MilestoneFieldErrorKey;
  note?: MilestoneFieldErrorKey;
  /** Spans the whole photo queue, so it is reported once rather than per file. */
  photos?: MilestoneFieldErrorKey;
}

export interface MilestoneFormInitialValues {
  /** `null` for a free entry. */
  templateKey: string | null;
  title: string;
  category: MilestoneCategory | null;
  /** `YYYY-MM-DD`. */
  achievedAt: string;
  note: string;
}

/** What the page needs to persist: the fields plus the files still to upload. */
export interface MilestoneFormOutput {
  templateKey: string | null;
  title: string;
  category: MilestoneCategory | null;
  achievedAt: string;
  note: string | null;
  /**
   * The files still to upload, in selection order: everything `pending`,
   * which includes entries a previous run failed on. Already-stored (`done`)
   * entries are never handed on, so a retry cannot duplicate a photo.
   */
  photos: QueuedPhoto[];
}

export interface MilestoneFormProps {
  mode: 'create' | 'edit';
  /** `YYYY-MM-DD`; the earliest date a milestone may carry (M-6). */
  birthDate: string;
  /** Preselected template, e.g. from the catalog view's `?templateKey=`. */
  templateKey?: string | null;
  initialValues?: MilestoneFormInitialValues;
  /**
   * How many photos the milestone already has on the server. Counted towards
   * the per-milestone ceiling so the form can refuse a selection before the
   * upload round-trip (M-7).
   */
  existingPhotoCount?: number;
  onSubmit: (output: MilestoneFormOutput) => Promise<void>;
  /**
   * Per-file upload outcome, handed back by the page after it has tried the
   * uploads. Lets the form show which single file failed while the rest
   * succeeded — never a blanket failure (M-15).
   */
  photoResults?: QueuedPhoto[];
}

function nextPhotoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Shared create/edit form for one milestone.
 *
 * Plain `useState` per field with a manual `validate()`, matching
 * `GrowthMeasurementForm` and the event forms rather than introducing a form
 * library for one screen.
 *
 * Two kinds of entry (M-2/M-4). For a **template** entry the title and the
 * category are owned by the catalog: the title is rendered read-only from
 * `milestone.templates.<KEY>` and submitted as-is, which is what the server
 * then freezes onto the record. For a **free** entry both are the user's own.
 * The mode toggle only exists while creating — an existing entry cannot change
 * kind, since `templateKey` carries the uniqueness rule.
 *
 * Photos are queued here but uploaded by the page, after the milestone exists
 * and therefore has an id to attach them to.
 */
export function MilestoneForm({
  mode,
  birthDate,
  templateKey: initialTemplateKey,
  initialValues,
  existingPhotoCount = 0,
  onSubmit,
  photoResults,
}: MilestoneFormProps) {
  const { t } = useTranslation();

  const [templateKey, setTemplateKey] = useState<string | null>(
    initialValues?.templateKey ?? initialTemplateKey ?? null,
  );
  const isTemplateEntry = templateKey !== null;
  const templateEntry = templateKey ? getTemplateEntry(templateKey) : undefined;

  const [freeTitle, setFreeTitle] = useState(
    initialValues && initialValues.templateKey === null ? initialValues.title : '',
  );
  const [category, setCategory] = useState<string>(initialValues?.category ?? CATEGORY_NONE_OPTION);
  const [achievedAt, setAchievedAt] = useState(initialValues?.achievedAt ?? todayAsCalendarDate());
  const [note, setNote] = useState(initialValues?.note ?? '');
  // Seeded from `photoResults` so a form mounted with an already-failed upload
  // run (create -> edit after a partial failure) shows it immediately.
  const [photos, setPhotos] = useState<QueuedPhoto[]>(() =>
    mergePhotoResults([], photoResults ?? []),
  );
  const [photoSelectionError, setPhotoSelectionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The page reports per-file outcomes back so a partial failure is visible on
  // exactly the files it affected. Adopted by adjusting state *during render*
  // on the prop change (React's documented "adjusting state when a prop
  // changes" pattern) rather than in an effect: an effect here would render
  // the stale queue once, then immediately re-render — the cascading-render
  // case `react-hooks/set-state-in-effect` exists to prevent.
  const [adoptedPhotoResults, setAdoptedPhotoResults] = useState(photoResults);
  if (photoResults !== adoptedPhotoResults) {
    setAdoptedPhotoResults(photoResults);
    if (photoResults) {
      // Merged by id, not assigned: the run only covers the files it was given,
      // so anything else in the queue has to survive it untouched.
      setPhotos((current) => mergePhotoResults(current, photoResults));
      // The submit is over; whatever failed is now visible per file.
      setIsSubmitting(false);
    }
  }

  // A template entry's displayed title is always the current translation of
  // the catalog key; it is only frozen once, at creation, by the server.
  const templateTitle = templateKey ? t(milestoneTemplateLabelKey(templateKey)) : '';
  const effectiveTitle = isTemplateEntry ? templateTitle : freeTitle;
  const effectiveCategory: MilestoneCategory | null = isTemplateEntry
    ? (templateEntry?.category ?? null)
    : category === CATEGORY_NONE_OPTION
      ? null
      : (category as MilestoneCategory);

  // One object URL per queued photo, revoked on the next `photos` change (via
  // the effect cleanup keyed on `previewUrls`) and on unmount. Kept in
  // `useMemo` rather than an effect on purpose: the repo's `react-hooks` lint
  // rules forbid both `setState` inside an effect and ref access during
  // render, which the "create in an effect" rewrites would need. StrictMode's
  // dev-only double-invocation of the factory can briefly allocate a second,
  // never-revoked URL, but production invokes it once — see `ChildForm` for
  // the same accepted pattern.
  const previewUrls = useMemo(
    () => photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.file) })),
    [photos],
  );
  useEffect(() => {
    return () => {
      previewUrls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Only entries that are NOT on the server yet count here: once a photo
  // uploads it leaves this queue and shows up in `existingPhotoCount` instead,
  // and counting it twice would shrink the ceiling after every partial run.
  const queuedNotYetUploaded = photos.filter((photo) => photo.status !== 'done').length;
  const remainingPhotoSlots = Math.max(
    0,
    MAX_PHOTOS_PER_MILESTONE - existingPhotoCount - queuedNotYetUploaded,
  );

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    // Reset the input so picking the same file again still fires a change.
    event.target.value = '';
    if (selected.length === 0) {
      return;
    }

    const accepted = selected.slice(0, remainingPhotoSlots);
    const rejectedForLimit = selected.length - accepted.length;
    setPhotoSelectionError(
      rejectedForLimit > 0
        ? t('milestone.form.photos.limitReached', {
            max: MAX_PHOTOS_PER_MILESTONE,
            count: rejectedForLimit,
          })
        : null,
    );

    // An invalid file is kept in the list with its own error rather than
    // silently dropped, so the user can see *which* file was refused and why —
    // and the valid ones alongside it are unaffected.
    const queued: QueuedPhoto[] = accepted.map((file) => {
      if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
        return {
          id: nextPhotoId(),
          file,
          status: 'error',
          errorKey: 'milestone.validation.photoInvalidType',
        };
      }
      if (file.size > MAX_PHOTO_BYTES) {
        return {
          id: nextPhotoId(),
          file,
          status: 'error',
          errorKey: 'milestone.validation.photoTooLarge',
        };
      }
      return { id: nextPhotoId(), file, status: 'pending' };
    });

    setPhotos((current) => [...current, ...queued]);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setPhotoSelectionError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (mode === 'create' && isTemplateEntry && !templateEntry) {
      errors.template = 'milestone.validation.templateRequired';
    }

    if (!isTemplateEntry) {
      if (freeTitle.trim().length === 0) {
        errors.title = 'milestone.validation.titleRequired';
      } else if (freeTitle.length > MAX_MILESTONE_TITLE_LENGTH) {
        errors.title = 'milestone.validation.titleTooLong';
      }
    }

    if (achievedAt.trim().length === 0) {
      errors.achievedAt = 'milestone.validation.achievedAtRequired';
    } else if (achievedAt > todayAsCalendarDate()) {
      errors.achievedAt = 'milestone.validation.achievedAtInFuture';
    } else if (achievedAt < birthDate) {
      errors.achievedAt = 'milestone.validation.achievedAtBeforeBirth';
    }

    if (note.length > MAX_NOTE_LENGTH) {
      errors.note = 'milestone.validation.noteTooLong';
    }

    // A client-rejected file can never be uploaded as-is, so submitting with
    // one still queued would either drop it silently or strand the user on a
    // "still failing" screen forever. Blocking here keeps the only outcome an
    // honest one: remove it or pick a different file (M-15).
    if (photos.some((photo) => photo.status === 'error')) {
      errors.photos = 'milestone.validation.photosNeedAttention';
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.values(nextErrors).some(Boolean)) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await onSubmit({
        templateKey,
        title: effectiveTitle.trim(),
        // Never sent for a template entry: the server derives it from the
        // catalog and rejects a client-supplied one.
        category: isTemplateEntry ? null : effectiveCategory,
        achievedAt,
        // An emptied note is an explicit `null`, which the PATCH endpoint
        // reads as "clear it" rather than "leave it alone".
        note: note.trim().length > 0 ? note.trim() : null,
        // `pending` only — `done` entries are already on the server and
        // must never be sent again, and `error` ones were rejected above.
        photos: photos.filter((photo) => photo.status === 'pending'),
      });
      // No `finally` reset: a fully successful submit navigates away, and a
      // partial photo failure comes back through `photoResults`.
    } catch {
      // M-15: the page keeps the entered values and surfaces the failure via a
      // toast raised by the caller — nothing is buffered, no success is faked.
      setIsSubmitting(false);
    }
  };

  const submitLabelKey =
    mode === 'create'
      ? isSubmitting
        ? 'milestone.form.submit.createPending'
        : 'milestone.form.submit.create'
      : isSubmitting
        ? 'milestone.form.submit.editPending'
        : 'milestone.form.submit.edit';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      {/* Kind of entry is fixed once created: `templateKey` carries the
          uniqueness rule, so switching would be a delete plus a create. */}
      {mode === 'create' && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isTemplateEntry ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={isTemplateEntry}
            disabled={isSubmitting}
            onClick={() => setTemplateKey(MILESTONE_TEMPLATES[0].key)}
          >
            {t('milestone.form.modeTemplate')}
          </Button>
          <Button
            type="button"
            variant={isTemplateEntry ? 'secondary' : 'primary'}
            size="sm"
            aria-pressed={!isTemplateEntry}
            disabled={isSubmitting}
            onClick={() => setTemplateKey(null)}
          >
            {t('milestone.form.modeFree')}
          </Button>
        </div>
      )}

      {mode === 'create' && isTemplateEntry && (
        <Select
          id="milestone-template"
          label={t('milestone.form.templateLabel')}
          placeholder={t('milestone.form.templatePlaceholder')}
          value={templateKey ?? undefined}
          disabled={isSubmitting}
          error={fieldErrors.template ? t(fieldErrors.template) : undefined}
          onValueChange={setTemplateKey}
        >
          {MILESTONE_TEMPLATES.map((entry) => (
            <Select.Item key={entry.key} value={entry.key}>
              {t(milestoneTemplateLabelKey(entry.key))}
            </Select.Item>
          ))}
        </Select>
      )}

      {isTemplateEntry ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {t('milestone.form.titleLabel')}
          </span>
          <p className="text-base text-foreground">{templateTitle}</p>
          <p className="text-xs text-muted-foreground">{t('milestone.form.titleFixedHint')}</p>
        </div>
      ) : (
        <Input
          id="milestone-title"
          label={t('milestone.form.titleLabel')}
          placeholder={t('milestone.form.titlePlaceholder')}
          required
          maxLength={MAX_MILESTONE_TITLE_LENGTH}
          value={freeTitle}
          onChange={(event) => setFreeTitle(event.target.value)}
          error={
            fieldErrors.title
              ? t(fieldErrors.title, { max: MAX_MILESTONE_TITLE_LENGTH })
              : undefined
          }
          disabled={isSubmitting}
        />
      )}

      {isTemplateEntry ? (
        effectiveCategory && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t('milestone.form.categoryLabel')}
            </span>
            <Badge
              variant={milestoneCategoryVisuals[effectiveCategory].badgeVariant}
              size="sm"
              className="self-start"
            >
              {t(milestoneCategoryVisuals[effectiveCategory].labelKey)}
            </Badge>
            <p className="text-xs text-muted-foreground">{t('milestone.form.categoryFixedHint')}</p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-1">
          <Select
            id="milestone-category"
            label={t('milestone.form.categoryLabel')}
            value={category}
            disabled={isSubmitting}
            onValueChange={setCategory}
          >
            <Select.Item value={CATEGORY_NONE_OPTION}>
              {t('milestone.form.categoryNone')}
            </Select.Item>
            {MILESTONE_CATEGORIES.map((candidate) => (
              <Select.Item key={candidate} value={candidate}>
                {t(milestoneCategoryVisuals[candidate].labelKey)}
              </Select.Item>
            ))}
          </Select>
          {/* M-3: the category groups, it never judges. */}
          <p className="text-xs text-muted-foreground">{t('milestone.form.categoryHint')}</p>
        </div>
      )}

      <Input
        id="milestone-achieved-at"
        label={t('milestone.form.achievedAtLabel')}
        type="date"
        required
        min={birthDate}
        max={todayAsCalendarDate()}
        value={achievedAt}
        onChange={(event) => setAchievedAt(event.target.value)}
        error={fieldErrors.achievedAt ? t(fieldErrors.achievedAt) : undefined}
        disabled={isSubmitting}
      />

      <Textarea
        label={t('milestone.form.noteLabel')}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={fieldErrors.note ? t(fieldErrors.note, { max: MAX_NOTE_LENGTH }) : undefined}
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          {t('milestone.form.photos.sectionLabel')}
        </span>
        <label
          htmlFor="milestone-photos"
          className="cursor-pointer rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {t('milestone.form.photos.addLabel')}
        </label>
        <input
          id="milestone-photos"
          type="file"
          multiple
          accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
          onChange={handlePhotoChange}
          aria-label={t('milestone.form.photos.addLabel')}
          aria-describedby="milestone-photos-hint"
          disabled={isSubmitting || remainingPhotoSlots === 0}
          className="sr-only"
        />
        <p id="milestone-photos-hint" className="text-xs text-muted-foreground">
          {t('milestone.form.photos.hint', { max: MAX_PHOTOS_PER_MILESTONE })}
        </p>
        {photoSelectionError && <ErrorMessage message={photoSelectionError} />}
        {fieldErrors.photos && <ErrorMessage message={t(fieldErrors.photos)} />}

        {photos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {photos.map((photo) => {
              const preview = previewUrls.find((entry) => entry.id === photo.id)?.url;
              return (
                <li key={photo.id} className="flex items-center gap-3">
                  {preview && (
                    <img
                      src={preview}
                      alt=""
                      aria-hidden="true"
                      className="h-12 w-12 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {photo.file.name}
                  </span>
                  <span
                    className={
                      photo.status === 'error'
                        ? 'text-xs text-destructive'
                        : 'text-xs text-muted-foreground'
                    }
                  >
                    {photo.errorKey
                      ? t(photo.errorKey, { name: photo.file.name })
                      : t(PHOTO_STATUS_KEYS[photo.status])}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('milestone.form.photos.removeLabel', { name: photo.file.name })}
                    disabled={isSubmitting}
                    onClick={() => removePhoto(photo.id)}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button type="submit" variant="primary" className="self-start" disabled={isSubmitting}>
        {t(submitLabelKey)}
      </Button>
    </form>
  );
}

/**
 * Maps an upload status onto its i18n key. A literal key per branch rather
 * than an interpolated `...status${Suffix}` string, so the keys stay
 * greppable and compile-time-checked against `de.json`.
 */
const PHOTO_STATUS_KEYS: Record<PhotoUploadStatus, ParseKeys> = {
  pending: 'milestone.form.photos.statusPending',
  done: 'milestone.form.photos.statusDone',
  error: 'milestone.form.photos.statusError',
};

import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateFeedingEventInput, FeedingSide, FeedingType } from '../api/feeding-api';
import { mapFeedingError, type FeedingErrorKey } from '../feeding/mapFeedingError';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input, Select } from './ui';

const MAX_NOTE_LENGTH = 500;
const MIN_AMOUNT_ML = 1;
const MAX_AMOUNT_ML = 2000;

/** `<input type="datetime-local">` max attribute + the JS not-in-the-future check. */
function nowAsDatetimeLocalValue(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

/** Converts a backend ISO 8601 timestamp into a local `datetime-local` input value. */
function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

/** Converts a `datetime-local` input value (local time, no timezone) back to ISO 8601 UTC. */
function datetimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString();
}

type FieldErrorKeys = {
  feedingType?: 'feeding.validation.feedingTypeRequired';
  occurredAt?: 'feeding.validation.occurredAtRequired' | 'feeding.validation.occurredAtFuture';
  side?: 'feeding.validation.sideRequired';
  amountMl?: 'feeding.validation.amountRequired' | 'feeding.validation.amountOutOfRange';
  endedAt?: 'feeding.validation.endedBeforeStarted' | 'feeding.validation.endedAtRequired';
  note?: 'feeding.validation.noteTooLong';
};

/** All fields as `datetime-local`-input-friendly strings, mirroring the form's own state shape. */
export interface FeedingEventFormInitialValues {
  feedingType: FeedingType;
  occurredAt: string;
  startedAt?: string;
  endedAt?: string;
  side?: FeedingSide;
  amountMl?: number;
  note?: string;
}

/**
 * `note` is widened to `string | null` (unlike `CreateFeedingEventInput.note`)
 * because edit mode needs to be able to send an explicit `null` to clear a
 * previously-set note — see `handleSubmit` below and
 * `UpdateFeedingEventInput`. Create mode never actually produces `null`
 * here, only `undefined` (omitted) or a non-empty string.
 */
export type FeedingEventFormOutput = Omit<CreateFeedingEventInput, 'note'> & {
  note?: string | null;
};

export interface FeedingEventFormProps {
  mode: 'create' | 'edit';
  initialValues?: FeedingEventFormInitialValues;
  onSubmit: (output: FeedingEventFormOutput) => Promise<void>;
}

/**
 * Shared create/backfill + edit form for a single feeding event. `startedAt`/
 * `endedAt` (BREAST only) are for a fully-backfilled *completed* feed —
 * starting a new running timer is exclusively `FeedingQuickEntry`'s job,
 * never this form's.
 */
export function FeedingEventForm({ mode, initialValues, onSubmit }: FeedingEventFormProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const noteErrorId = `${noteId}-error`;
  const [feedingType, setFeedingType] = useState<FeedingType | ''>(
    initialValues?.feedingType ?? '',
  );
  const [occurredAt, setOccurredAt] = useState(
    initialValues?.occurredAt ? isoToDatetimeLocalValue(initialValues.occurredAt) : '',
  );
  const [startedAt, setStartedAt] = useState(
    initialValues?.startedAt ? isoToDatetimeLocalValue(initialValues.startedAt) : '',
  );
  const [endedAt, setEndedAt] = useState(
    initialValues?.endedAt ? isoToDatetimeLocalValue(initialValues.endedAt) : '',
  );
  const [side, setSide] = useState<FeedingSide | ''>(initialValues?.side ?? '');
  const [amountMl, setAmountMl] = useState(
    initialValues?.amountMl !== undefined ? String(initialValues.amountMl) : '',
  );
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<FeedingErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof FieldErrorKeys) => {
    setFieldErrorKeys((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = (): FieldErrorKeys => {
    const errors: FieldErrorKeys = {};

    if (!feedingType) {
      errors.feedingType = 'feeding.validation.feedingTypeRequired';
    }

    if (occurredAt.trim().length === 0) {
      errors.occurredAt = 'feeding.validation.occurredAtRequired';
    } else if (occurredAt > nowAsDatetimeLocalValue()) {
      errors.occurredAt = 'feeding.validation.occurredAtFuture';
    }

    if (feedingType === 'BREAST' && !side) {
      errors.side = 'feeding.validation.sideRequired';
    }

    if (feedingType === 'BOTTLE') {
      const amount = Number(amountMl);
      if (amountMl.trim().length === 0 || Number.isNaN(amount)) {
        errors.amountMl = 'feeding.validation.amountRequired';
      } else if (amount < MIN_AMOUNT_ML || amount > MAX_AMOUNT_ML) {
        errors.amountMl = 'feeding.validation.amountOutOfRange';
      }
    }

    if (feedingType === 'BREAST') {
      if (mode === 'create' && !endedAt) {
        // Create mode is exclusively for backfilling *completed* feeds (see
        // this form's own doc comment) — an omitted endedAt would otherwise
        // reach `FeedingService.create` as `endedAt: null` and silently
        // start a running timer dated in the past, which is
        // `FeedingQuickEntry`'s job, not this form's. Edit mode is exempt:
        // an existing running timer legitimately has `endedAt: null` and
        // must stay editable without forcing an end time.
        errors.endedAt = 'feeding.validation.endedAtRequired';
      } else if (startedAt && endedAt && endedAt < startedAt) {
        errors.endedAt = 'feeding.validation.endedBeforeStarted';
      }
    }

    if (note.length > MAX_NOTE_LENGTH) {
      errors.note = 'feeding.validation.noteTooLong';
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrorKeys = validate();
    if (Object.values(nextFieldErrorKeys).some(Boolean)) {
      setFieldErrorKeys(nextFieldErrorKeys);
      setFormErrorKey(null);
      return;
    }

    setFieldErrorKeys({});
    setFormErrorKey(null);
    setIsSubmitting(true);
    try {
      const output: FeedingEventFormOutput = {
        feedingType: feedingType as FeedingType,
        occurredAt: datetimeLocalValueToIso(occurredAt),
      };
      if (mode === 'edit') {
        // Edit mode must be able to signal "clear this note" — omitting
        // the key here (like create mode does) would be indistinguishable
        // from "leave it untouched" once serialized, so an explicit `null`
        // is sent instead. See `UpdateFeedingEventDto`/`FeedingService.update`.
        output.note = note.trim().length > 0 ? note : null;
      } else if (note.trim().length > 0) {
        output.note = note;
      }
      if (feedingType === 'BREAST') {
        output.side = side as FeedingSide;
        if (startedAt) {
          output.startedAt = datetimeLocalValueToIso(startedAt);
        }
        if (endedAt) {
          output.endedAt = datetimeLocalValueToIso(endedAt);
        }
      }
      if (feedingType === 'BOTTLE') {
        output.amountMl = Number(amountMl);
      }

      await onSubmit(output);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapFeedingError(err, mode === 'create' ? 'create' : 'update'));
      setIsSubmitting(false);
    }
  };

  const submitButtonTextKey =
    mode === 'create'
      ? isSubmitting
        ? 'feeding.form.submitButtonPending'
        : 'feeding.form.submitButton'
      : isSubmitting
        ? 'feeding.form.saveButtonPending'
        : 'feeding.form.saveButton';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <Select
        id="feeding-type"
        label={t('feeding.fields.feedingTypeLabel')}
        required
        value={feedingType}
        disabled={mode === 'edit' || isSubmitting}
        onChange={(event) => {
          setFeedingType(event.target.value as FeedingType);
          clearFieldError('feedingType');
        }}
        error={fieldErrorKeys.feedingType ? t(fieldErrorKeys.feedingType) : undefined}
      >
        <option value="" disabled>
          {t('feeding.fields.feedingTypePlaceholder')}
        </option>
        <option value="BREAST">{t('feeding.fields.feedingTypeOptionBreast')}</option>
        <option value="BOTTLE">{t('feeding.fields.feedingTypeOptionBottle')}</option>
        <option value="SOLID">{t('feeding.fields.feedingTypeOptionSolid')}</option>
      </Select>

      <Input
        id="feeding-occurred-at"
        label={t('feeding.fields.occurredAtLabel')}
        type="datetime-local"
        required
        max={nowAsDatetimeLocalValue()}
        value={occurredAt}
        onChange={(event) => {
          setOccurredAt(event.target.value);
          clearFieldError('occurredAt');
        }}
        error={fieldErrorKeys.occurredAt ? t(fieldErrorKeys.occurredAt) : undefined}
        disabled={isSubmitting}
      />

      {feedingType === 'BREAST' && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {t('feeding.fields.sideLabel')}
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="feeding-side"
                  value="LEFT"
                  checked={side === 'LEFT'}
                  onChange={() => {
                    setSide('LEFT');
                    clearFieldError('side');
                  }}
                  disabled={isSubmitting}
                  className="h-4 w-4 accent-primary"
                />
                {t('feeding.fields.sideLeftOption')}
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="feeding-side"
                  value="RIGHT"
                  checked={side === 'RIGHT'}
                  onChange={() => {
                    setSide('RIGHT');
                    clearFieldError('side');
                  }}
                  disabled={isSubmitting}
                  className="h-4 w-4 accent-primary"
                />
                {t('feeding.fields.sideRightOption')}
              </label>
            </div>
            {fieldErrorKeys.side && <ErrorMessage message={t(fieldErrorKeys.side)} />}
          </fieldset>

          <Input
            id="feeding-started-at"
            label={t('feeding.fields.startedAtLabel')}
            type="datetime-local"
            max={nowAsDatetimeLocalValue()}
            value={startedAt}
            onChange={(event) => {
              setStartedAt(event.target.value);
              clearFieldError('endedAt');
            }}
            disabled={isSubmitting}
          />

          <Input
            id="feeding-ended-at"
            label={t('feeding.fields.endedAtLabel')}
            type="datetime-local"
            max={nowAsDatetimeLocalValue()}
            value={endedAt}
            onChange={(event) => {
              setEndedAt(event.target.value);
              clearFieldError('endedAt');
            }}
            error={fieldErrorKeys.endedAt ? t(fieldErrorKeys.endedAt) : undefined}
            disabled={isSubmitting}
          />
        </>
      )}

      {feedingType === 'BOTTLE' && (
        <Input
          id="feeding-amount-ml"
          label={t('feeding.fields.amountLabel')}
          type="number"
          min={MIN_AMOUNT_ML}
          max={MAX_AMOUNT_ML}
          value={amountMl}
          onChange={(event) => {
            setAmountMl(event.target.value);
            clearFieldError('amountMl');
          }}
          error={fieldErrorKeys.amountMl ? t(fieldErrorKeys.amountMl) : undefined}
          disabled={isSubmitting}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="text-sm font-medium text-foreground">
          {t('feeding.fields.noteLabel')}
        </label>
        <textarea
          id={noteId}
          maxLength={MAX_NOTE_LENGTH}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            clearFieldError('note');
          }}
          aria-invalid={!!fieldErrorKeys.note}
          aria-describedby={fieldErrorKeys.note ? noteErrorId : undefined}
          disabled={isSubmitting}
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {fieldErrorKeys.note && (
          <div id={noteErrorId}>
            <ErrorMessage message={t(fieldErrorKeys.note)} />
          </div>
        )}
      </div>

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </Button>
    </form>
  );
}

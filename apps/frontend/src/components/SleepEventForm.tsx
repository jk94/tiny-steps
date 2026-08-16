import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateSleepEventInput } from '../api/sleep-api';
import { mapSleepError, type SleepErrorKey } from '../sleep/mapSleepError';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input } from './ui';

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
  occurredAt?: 'sleep.validation.occurredAtRequired' | 'sleep.validation.occurredAtFuture';
  endedAt?: 'sleep.validation.endedBeforeStarted' | 'sleep.validation.endedAtRequired';
};

/** All fields as `datetime-local`-input-friendly strings, mirroring the form's own state shape. */
export interface SleepEventFormInitialValues {
  occurredAt: string;
  endedAt?: string;
}

export type SleepEventFormOutput = CreateSleepEventInput;

export interface SleepEventFormProps {
  mode: 'create' | 'edit';
  initialValues?: SleepEventFormInitialValues;
  onSubmit: (output: SleepEventFormOutput) => Promise<void>;
}

/**
 * Shared create/backfill + edit form for a single sleep event. Simplified
 * version of `FeedingEventForm` — no type select, no side radios, no
 * amount input, no note field (Sleep is a pure base-Event type, see
 * ADR-0006's addendum). `endedAt` is required in `mode === 'create'` but
 * optional in `mode === 'edit'`: create mode is exclusively for backfilling
 * a completed sleep — an omitted `endedAt` would silently start a running
 * timer dated in the past, which is `SleepQuickEntry`'s job, not this
 * form's. Edit mode stays exempt so an in-progress timer (`endedAt: null`)
 * remains editable.
 *
 * There is no separate `startedAt` input: unlike Feeding (where a bottle's
 * point-in-time and a breastfeeding timer's start are genuinely distinct),
 * Sleep's `occurredAt` and `startedAt` always mean the same moment. Showing
 * both invited them to drift apart (e.g. a backfill leaving `startedAt`
 * empty while setting an inconsistent `occurredAt`/`endedAt`), which could
 * persist a negative-duration event. `occurredAt` is the sole "when did
 * this start" field the user sees; `startedAt` is always mirrored from it
 * on submit, in both create and edit mode.
 */
export function SleepEventForm({ mode, initialValues, onSubmit }: SleepEventFormProps) {
  const { t } = useTranslation();
  const [occurredAt, setOccurredAt] = useState(
    initialValues?.occurredAt ? isoToDatetimeLocalValue(initialValues.occurredAt) : '',
  );
  const [endedAt, setEndedAt] = useState(
    initialValues?.endedAt ? isoToDatetimeLocalValue(initialValues.endedAt) : '',
  );
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<SleepErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof FieldErrorKeys) => {
    setFieldErrorKeys((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = (): FieldErrorKeys => {
    const errors: FieldErrorKeys = {};

    if (occurredAt.trim().length === 0) {
      errors.occurredAt = 'sleep.validation.occurredAtRequired';
    } else if (occurredAt > nowAsDatetimeLocalValue()) {
      errors.occurredAt = 'sleep.validation.occurredAtFuture';
    }

    if (mode === 'create' && !endedAt) {
      // Create mode is exclusively for backfilling *completed* sleep
      // phases (see this form's own doc comment) — an omitted endedAt
      // would otherwise reach `SleepService.create` as `endedAt: null` and
      // silently start a running timer dated in the past, which is
      // `SleepQuickEntry`'s job, not this form's. Edit mode is exempt: an
      // existing running timer legitimately has `endedAt: null` and must
      // stay editable without forcing an end time.
      errors.endedAt = 'sleep.validation.endedAtRequired';
    } else if (occurredAt && endedAt && endedAt < occurredAt) {
      errors.endedAt = 'sleep.validation.endedBeforeStarted';
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
      const occurredAtIso = datetimeLocalValueToIso(occurredAt);
      // `startedAt` always mirrors `occurredAt` — there's no separate UI
      // field for it (see this form's doc comment) — so an edit that only
      // changes `occurredAt` can't leave `startedAt` stale relative to it.
      const output: SleepEventFormOutput = {
        occurredAt: occurredAtIso,
        startedAt: occurredAtIso,
      };
      if (endedAt) {
        output.endedAt = datetimeLocalValueToIso(endedAt);
      }

      await onSubmit(output);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapSleepError(err, mode === 'create' ? 'create' : 'update'));
      setIsSubmitting(false);
    }
  };

  const submitButtonTextKey =
    mode === 'create'
      ? isSubmitting
        ? 'sleep.form.submitButtonPending'
        : 'sleep.form.submitButton'
      : isSubmitting
        ? 'sleep.form.saveButtonPending'
        : 'sleep.form.saveButton';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <Input
        id="sleep-occurred-at"
        label={t('sleep.fields.occurredAtLabel')}
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

      <Input
        id="sleep-ended-at"
        label={t('sleep.fields.endedAtLabel')}
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

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </Button>
    </form>
  );
}

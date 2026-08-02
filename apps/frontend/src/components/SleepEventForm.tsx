import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateSleepEventInput } from '../api/sleep-api';
import { mapSleepError, type SleepErrorKey } from '../sleep/mapSleepError';
import { ErrorMessage } from './ErrorMessage';

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
  startedAt?: string;
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
 */
export function SleepEventForm({ mode, initialValues, onSubmit }: SleepEventFormProps) {
  const { t } = useTranslation();
  const [occurredAt, setOccurredAt] = useState(
    initialValues?.occurredAt ? isoToDatetimeLocalValue(initialValues.occurredAt) : '',
  );
  const [startedAt, setStartedAt] = useState(
    initialValues?.startedAt ? isoToDatetimeLocalValue(initialValues.startedAt) : '',
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
    } else if (startedAt && endedAt && endedAt < startedAt) {
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
      const output: SleepEventFormOutput = {
        occurredAt: datetimeLocalValueToIso(occurredAt),
      };
      if (startedAt) {
        output.startedAt = datetimeLocalValueToIso(startedAt);
      }
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
    <form className="sleep-event-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className="sleep-event-form__field">
        <label htmlFor="sleep-occurred-at">{t('sleep.fields.occurredAtLabel')}</label>
        <input
          id="sleep-occurred-at"
          type="datetime-local"
          required
          max={nowAsDatetimeLocalValue()}
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            clearFieldError('occurredAt');
          }}
          aria-invalid={!!fieldErrorKeys.occurredAt}
          aria-describedby={fieldErrorKeys.occurredAt ? 'sleep-occurred-at-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.occurredAt && (
          <div id="sleep-occurred-at-error">
            <ErrorMessage message={t(fieldErrorKeys.occurredAt)} />
          </div>
        )}
      </div>

      <div className="sleep-event-form__field">
        <label htmlFor="sleep-started-at">{t('sleep.fields.startedAtLabel')}</label>
        <input
          id="sleep-started-at"
          type="datetime-local"
          max={nowAsDatetimeLocalValue()}
          value={startedAt}
          onChange={(event) => {
            setStartedAt(event.target.value);
            clearFieldError('endedAt');
          }}
          disabled={isSubmitting}
        />
      </div>

      <div className="sleep-event-form__field">
        <label htmlFor="sleep-ended-at">{t('sleep.fields.endedAtLabel')}</label>
        <input
          id="sleep-ended-at"
          type="datetime-local"
          max={nowAsDatetimeLocalValue()}
          value={endedAt}
          onChange={(event) => {
            setEndedAt(event.target.value);
            clearFieldError('endedAt');
          }}
          aria-invalid={!!fieldErrorKeys.endedAt}
          aria-describedby={fieldErrorKeys.endedAt ? 'sleep-ended-at-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.endedAt && (
          <div id="sleep-ended-at-error">
            <ErrorMessage message={t(fieldErrorKeys.endedAt)} />
          </div>
        )}
      </div>

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <button type="submit" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </button>
    </form>
  );
}

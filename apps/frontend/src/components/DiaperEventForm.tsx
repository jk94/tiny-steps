import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateDiaperEventInput, DiaperType } from '../api/diaper-api';
import { mapDiaperError, type DiaperErrorKey } from '../diaper/mapDiaperError';
import { ErrorMessage } from './ErrorMessage';

const MAX_NOTE_LENGTH = 500;

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
  diaperType?: 'diaper.validation.diaperTypeRequired';
  occurredAt?: 'diaper.validation.occurredAtRequired' | 'diaper.validation.occurredAtFuture';
  note?: 'diaper.validation.noteTooLong';
};

/** All fields as form-input-friendly strings, mirroring the form's own state shape. */
export interface DiaperEventFormInitialValues {
  diaperType: DiaperType;
  occurredAt: string;
  note?: string;
}

export type DiaperEventFormOutput = CreateDiaperEventInput;

export interface DiaperEventFormProps {
  mode: 'create' | 'edit';
  initialValues?: DiaperEventFormInitialValues;
  onSubmit: (output: DiaperEventFormOutput) => Promise<void>;
}

/**
 * Shared create/backfill + edit form for a single diaper event. Only 3
 * fields, and no conditional rendering branches — every `diaperType` shows
 * the same fields, since `note` applies uniformly to all of them (unlike
 * `FeedingEventForm`).
 *
 * Deliberate divergence from `FeedingEventForm`: the `diaperType` select is
 * NOT disabled in edit mode — `diaperType` is editable via PATCH (see
 * `UpdateDiaperEventDto`'s doc comment), unlike Feeding's immutable
 * `feedingType`.
 */
export function DiaperEventForm({ mode, initialValues, onSubmit }: DiaperEventFormProps) {
  const { t } = useTranslation();
  const [diaperType, setDiaperType] = useState<DiaperType | ''>(initialValues?.diaperType ?? '');
  const [occurredAt, setOccurredAt] = useState(
    initialValues?.occurredAt ? isoToDatetimeLocalValue(initialValues.occurredAt) : '',
  );
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [fieldErrorKeys, setFieldErrorKeys] = useState<FieldErrorKeys>({});
  const [formErrorKey, setFormErrorKey] = useState<DiaperErrorKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof FieldErrorKeys) => {
    setFieldErrorKeys((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = (): FieldErrorKeys => {
    const errors: FieldErrorKeys = {};

    if (!diaperType) {
      errors.diaperType = 'diaper.validation.diaperTypeRequired';
    }

    if (occurredAt.trim().length === 0) {
      errors.occurredAt = 'diaper.validation.occurredAtRequired';
    } else if (occurredAt > nowAsDatetimeLocalValue()) {
      errors.occurredAt = 'diaper.validation.occurredAtFuture';
    }

    if (note.length > MAX_NOTE_LENGTH) {
      errors.note = 'diaper.validation.noteTooLong';
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
      const output: DiaperEventFormOutput = {
        diaperType: diaperType as DiaperType,
        occurredAt: datetimeLocalValueToIso(occurredAt),
      };
      if (note.trim().length > 0) {
        output.note = note;
      }

      await onSubmit(output);
      // No `finally`-reset here — a successful submit navigates away, so
      // resetting `isSubmitting` right before unmount would be pure churn.
    } catch (err) {
      setFormErrorKey(mapDiaperError(err, mode === 'create' ? 'create' : 'update'));
      setIsSubmitting(false);
    }
  };

  const submitButtonTextKey =
    mode === 'create'
      ? isSubmitting
        ? 'diaper.form.submitButtonPending'
        : 'diaper.form.submitButton'
      : isSubmitting
        ? 'diaper.form.saveButtonPending'
        : 'diaper.form.saveButton';

  return (
    <form className="diaper-event-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className="diaper-event-form__field">
        <label htmlFor="diaper-type">{t('diaper.fields.diaperTypeLabel')}</label>
        <select
          id="diaper-type"
          required
          value={diaperType}
          disabled={isSubmitting}
          onChange={(event) => {
            setDiaperType(event.target.value as DiaperType);
            clearFieldError('diaperType');
          }}
          aria-invalid={!!fieldErrorKeys.diaperType}
          aria-describedby={fieldErrorKeys.diaperType ? 'diaper-type-error' : undefined}
        >
          <option value="" disabled>
            {t('diaper.fields.diaperTypePlaceholder')}
          </option>
          <option value="PEE">{t('diaper.fields.diaperTypeOptionPee')}</option>
          <option value="STOOL">{t('diaper.fields.diaperTypeOptionStool')}</option>
          <option value="BOTH">{t('diaper.fields.diaperTypeOptionBoth')}</option>
        </select>
        {fieldErrorKeys.diaperType && (
          <div id="diaper-type-error">
            <ErrorMessage message={t(fieldErrorKeys.diaperType)} />
          </div>
        )}
      </div>

      <div className="diaper-event-form__field">
        <label htmlFor="diaper-occurred-at">{t('diaper.fields.occurredAtLabel')}</label>
        <input
          id="diaper-occurred-at"
          type="datetime-local"
          required
          max={nowAsDatetimeLocalValue()}
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            clearFieldError('occurredAt');
          }}
          aria-invalid={!!fieldErrorKeys.occurredAt}
          aria-describedby={fieldErrorKeys.occurredAt ? 'diaper-occurred-at-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.occurredAt && (
          <div id="diaper-occurred-at-error">
            <ErrorMessage message={t(fieldErrorKeys.occurredAt)} />
          </div>
        )}
      </div>

      <div className="diaper-event-form__field">
        <label htmlFor="diaper-note">{t('diaper.fields.noteLabel')}</label>
        <textarea
          id="diaper-note"
          maxLength={MAX_NOTE_LENGTH}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            clearFieldError('note');
          }}
          aria-invalid={!!fieldErrorKeys.note}
          aria-describedby={fieldErrorKeys.note ? 'diaper-note-error' : undefined}
          disabled={isSubmitting}
        />
        {fieldErrorKeys.note && (
          <div id="diaper-note-error">
            <ErrorMessage message={t(fieldErrorKeys.note)} />
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

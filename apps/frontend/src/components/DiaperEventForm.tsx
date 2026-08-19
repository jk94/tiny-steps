import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateDiaperEventInput, DiaperType } from '../api/diaper-api';
import { mapDiaperError, type DiaperErrorKey } from '../diaper/mapDiaperError';
import { ErrorMessage } from './ErrorMessage';
import { Button, Input, Select, Textarea } from './ui';

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

/**
 * `note` is widened to `string | null` (unlike `CreateDiaperEventInput.note`)
 * because edit mode needs to be able to send an explicit `null` to clear a
 * previously-set note — see `handleSubmit` below and
 * `UpdateDiaperEventInput`. Create mode never actually produces `null`
 * here, only `undefined` (omitted) or a non-empty string.
 */
export type DiaperEventFormOutput = Omit<CreateDiaperEventInput, 'note'> & {
  note?: string | null;
};

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
      if (mode === 'edit') {
        // Edit mode must be able to signal "clear this note" — omitting
        // the key here (like create mode does) would be indistinguishable
        // from "leave it untouched" once serialized, so an explicit `null`
        // is sent instead. See `UpdateDiaperEventDto`/`DiaperService.update`.
        output.note = note.trim().length > 0 ? note : null;
      } else if (note.trim().length > 0) {
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
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <Select
        id="diaper-type"
        label={t('diaper.fields.diaperTypeLabel')}
        placeholder={t('diaper.fields.diaperTypePlaceholder')}
        required
        value={diaperType}
        disabled={isSubmitting}
        onValueChange={(value) => {
          setDiaperType(value as DiaperType);
          clearFieldError('diaperType');
        }}
        error={fieldErrorKeys.diaperType ? t(fieldErrorKeys.diaperType) : undefined}
      >
        <Select.Item value="PEE">{t('diaper.fields.diaperTypeOptionPee')}</Select.Item>
        <Select.Item value="STOOL">{t('diaper.fields.diaperTypeOptionStool')}</Select.Item>
        <Select.Item value="BOTH">{t('diaper.fields.diaperTypeOptionBoth')}</Select.Item>
      </Select>

      <Input
        id="diaper-occurred-at"
        label={t('diaper.fields.occurredAtLabel')}
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

      <Textarea
        label={t('diaper.fields.noteLabel')}
        maxLength={MAX_NOTE_LENGTH}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          clearFieldError('note');
        }}
        error={fieldErrorKeys.note ? t(fieldErrorKeys.note) : undefined}
        disabled={isSubmitting}
        rows={3}
      />

      {formErrorKey && <ErrorMessage message={t(formErrorKey)} />}

      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
        {t(submitButtonTextKey)}
      </Button>
    </form>
  );
}

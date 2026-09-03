import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthRecordKind } from '../../api/health-record-api';
import {
  MAX_DOSE_UNIT_LENGTH,
  MAX_HEALTH_RECORD_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_VACCINE_BATCH_LENGTH,
} from '../../lib/healthRecordLimits';
import { HEALTH_RECORD_KINDS, healthRecordVisuals } from '../../lib/healthRecordVisuals';
import { Badge, Button, Input, Tabs, Textarea } from '../ui';

/** Common dose units, offered as suggestions rather than a closed list (MED-3). */
const DOSE_UNIT_SUGGESTIONS = ['ml', 'mg', 'Tropfen', 'Stück'];

type HealthRecordFieldErrorKey =
  | 'health.validation.nameRequired'
  | 'health.validation.nameTooLong'
  | 'health.validation.missingDate'
  | 'health.validation.doseUnitRequired'
  | 'health.validation.doseAmountInvalid'
  | 'health.validation.doseUnitTooLong'
  | 'health.validation.vaccineBatchTooLong'
  | 'health.validation.noteTooLong'
  | 'health.validation.administeredAtBeforeBirth'
  | 'health.validation.administeredAtInFuture';

interface FieldErrors {
  name?: HealthRecordFieldErrorKey;
  administeredAt?: HealthRecordFieldErrorKey;
  /** MED-2 spans both date fields, so it is reported on the due-date input. */
  dueAt?: HealthRecordFieldErrorKey;
  doseAmount?: HealthRecordFieldErrorKey;
  doseUnit?: HealthRecordFieldErrorKey;
  vaccineBatch?: HealthRecordFieldErrorKey;
  note?: HealthRecordFieldErrorKey;
}

/** All fields as form-input-friendly strings, mirroring the form's own state. */
export interface HealthRecordFormInitialValues {
  kind: HealthRecordKind;
  name: string;
  /** `datetime-local` value (local time, no zone), or empty. */
  administeredAt: string;
  /** `YYYY-MM-DD`, or empty. */
  dueAt: string;
  doseAmount: string;
  doseUnit: string;
  vaccineBatch: string;
  note: string;
  reminderEnabled: boolean;
}

/**
 * What the page persists. Optional values are `null` rather than `''` so the
 * PATCH endpoint reads an emptied field as "clear it" instead of "leave it".
 * `administeredAt` is a full ISO instant; `dueAt` a bare calendar day.
 */
export interface HealthRecordFormOutput {
  kind: HealthRecordKind;
  name: string;
  administeredAt: string | null;
  dueAt: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  vaccineBatch: string | null;
  note: string | null;
  reminderEnabled: boolean;
}

export interface HealthRecordFormProps {
  mode: 'create' | 'edit';
  /** `YYYY-MM-DD`; the earliest moment a record may carry (MED-6). */
  birthDate: string;
  initialValues?: HealthRecordFormInitialValues;
  onSubmit: (output: HealthRecordFormOutput) => Promise<void>;
}

/** `<input type="datetime-local">` max attribute + the JS not-in-the-future check. */
function nowAsDatetimeLocalValue(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

/** Converts a `datetime-local` input value (local time, no zone) back to ISO 8601 UTC. */
function datetimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Shared create/edit form for one medication or vaccination.
 *
 * Plain `useState` per field with a manual `validate()`, matching
 * `MilestoneForm` and the event forms rather than introducing a form library
 * for one screen.
 *
 * The kind picker is a `Tabs` list, and only while creating: `kind` decides
 * which of the optional columns are legal, so changing it afterwards would
 * invalidate data already stored — the server rejects it outright. In edit mode
 * the kind is therefore shown as a static badge.
 *
 * Every cross-column rule the server enforces is pre-checked here (MED-2,
 * MED-3, MED-6), so the common case never costs a round-trip; the server checks
 * remain the authority, since a stale cached birth date can still slip past.
 */
export function HealthRecordForm({
  mode,
  birthDate,
  initialValues,
  onSubmit,
}: HealthRecordFormProps) {
  const { t } = useTranslation();

  const [kind, setKind] = useState<HealthRecordKind>(initialValues?.kind ?? 'MEDICATION');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [administeredAt, setAdministeredAt] = useState(initialValues?.administeredAt ?? '');
  const [dueAt, setDueAt] = useState(initialValues?.dueAt ?? '');
  const [doseAmount, setDoseAmount] = useState(initialValues?.doseAmount ?? '');
  const [doseUnit, setDoseUnit] = useState(initialValues?.doseUnit ?? '');
  const [vaccineBatch, setVaccineBatch] = useState(initialValues?.vaccineBatch ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [reminderEnabled, setReminderEnabled] = useState(initialValues?.reminderEnabled ?? false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMedication = kind === 'MEDICATION';
  const visual = healthRecordVisuals[kind];

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (name.trim().length === 0) {
      errors.name = 'health.validation.nameRequired';
    } else if (name.length > MAX_HEALTH_RECORD_NAME_LENGTH) {
      errors.name = 'health.validation.nameTooLong';
    }

    // MED-2: an entry is either something that happened or something planned,
    // but never neither.
    if (administeredAt.trim().length === 0 && dueAt.trim().length === 0) {
      errors.dueAt = 'health.validation.missingDate';
    }

    if (administeredAt.trim().length > 0) {
      if (administeredAt > nowAsDatetimeLocalValue()) {
        errors.administeredAt = 'health.validation.administeredAtInFuture';
      } else if (administeredAt.slice(0, 10) < birthDate) {
        // MED-6, compared on the calendar-day prefix: `birthDate` is a bare
        // day, so there is no time of day to compare against on that side.
        errors.administeredAt = 'health.validation.administeredAtBeforeBirth';
      }
    }

    if (isMedication) {
      const trimmedAmount = doseAmount.trim();
      if (trimmedAmount.length > 0) {
        const parsed = Number(trimmedAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          errors.doseAmount = 'health.validation.doseAmountInvalid';
        } else if (doseUnit.trim().length === 0) {
          // MED-3: "5" of what?
          errors.doseUnit = 'health.validation.doseUnitRequired';
        }
      }
      if (doseUnit.length > MAX_DOSE_UNIT_LENGTH) {
        errors.doseUnit = 'health.validation.doseUnitTooLong';
      }
    } else if (vaccineBatch.length > MAX_VACCINE_BATCH_LENGTH) {
      errors.vaccineBatch = 'health.validation.vaccineBatchTooLong';
    }

    if (note.length > MAX_NOTE_LENGTH) {
      errors.note = 'health.validation.noteTooLong';
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
        kind,
        name: name.trim(),
        administeredAt:
          administeredAt.trim().length > 0 ? datetimeLocalValueToIso(administeredAt) : null,
        dueAt: dueAt.trim().length > 0 ? dueAt : null,
        // The fields of the other kind are always cleared, never carried over:
        // the server rejects a dose on a vaccination outright, and silently
        // keeping a hidden value would be invisible to the user.
        doseAmount: isMedication && doseAmount.trim().length > 0 ? Number(doseAmount) : null,
        doseUnit: isMedication && doseUnit.trim().length > 0 ? doseUnit.trim() : null,
        vaccineBatch: !isMedication && vaccineBatch.trim().length > 0 ? vaccineBatch.trim() : null,
        note: note.trim().length > 0 ? note.trim() : null,
        // A record with no due date can never fire a reminder, so the flag is
        // dropped along with the field it depends on.
        reminderEnabled: dueAt.trim().length > 0 && reminderEnabled,
      });
      // No `finally` reset: a successful submit navigates away.
    } catch {
      // MED-15: the page keeps the entered values and surfaces the failure via
      // a toast raised by the caller — nothing is buffered, no success is faked.
      setIsSubmitting(false);
    }
  };

  const submitLabelKey =
    mode === 'create'
      ? isSubmitting
        ? 'health.form.submit.createPending'
        : 'health.form.submit.create'
      : isSubmitting
        ? 'health.form.submit.editPending'
        : 'health.form.submit.edit';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      {mode === 'create' ? (
        <Tabs
          defaultValue={kind}
          value={kind}
          onValueChange={(next) => setKind(next as HealthRecordKind)}
        >
          <Tabs.List>
            {HEALTH_RECORD_KINDS.map((candidate) => (
              <Tabs.Tab key={candidate} value={candidate}>
                {t(healthRecordVisuals[candidate].labelKey)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{t('health.form.kindLabel')}</span>
          <Badge variant={visual.badgeVariant} size="sm" className="self-start">
            {t(visual.labelKey)}
          </Badge>
          <p className="text-xs text-muted-foreground">{t('health.form.kindFixedHint')}</p>
        </div>
      )}

      <Input
        id="health-record-name"
        label={t('health.form.nameLabel')}
        placeholder={
          isMedication
            ? t('health.form.namePlaceholder')
            : t('health.form.namePlaceholderVaccination')
        }
        required
        maxLength={MAX_HEALTH_RECORD_NAME_LENGTH}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={
          fieldErrors.name ? t(fieldErrors.name, { max: MAX_HEALTH_RECORD_NAME_LENGTH }) : undefined
        }
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-1">
        <Input
          id="health-record-administered-at"
          label={t('health.form.administeredAtLabel')}
          type="datetime-local"
          max={nowAsDatetimeLocalValue()}
          value={administeredAt}
          onChange={(event) => setAdministeredAt(event.target.value)}
          error={fieldErrors.administeredAt ? t(fieldErrors.administeredAt) : undefined}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">{t('health.form.administeredAtHint')}</p>
      </div>

      <div className="flex flex-col gap-1">
        {/* Deliberately no `min`/`max`: a due date in the past is a legitimate,
            overdue appointment (MED-6), and one far ahead is a real plan. */}
        <Input
          id="health-record-due-at"
          label={t('health.form.dueAtLabel')}
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          error={fieldErrors.dueAt ? t(fieldErrors.dueAt) : undefined}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">{t('health.form.dueAtHint')}</p>
      </div>

      {isMedication ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              id="health-record-dose-amount"
              label={t('health.form.doseAmountLabel')}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={doseAmount}
              onChange={(event) => setDoseAmount(event.target.value)}
              error={fieldErrors.doseAmount ? t(fieldErrors.doseAmount) : undefined}
              disabled={isSubmitting}
            />
          </div>
          {/* Free text with suggestions rather than a closed `Select`: units
              vary by preparation ("Hub", "Messlöffel"), and refusing an unusual
              one would be worse than storing it. */}
          <div className="flex-1">
            <Input
              id="health-record-dose-unit"
              label={t('health.form.doseUnitLabel')}
              placeholder={t('health.form.doseUnitPlaceholder')}
              list="health-record-dose-units"
              maxLength={MAX_DOSE_UNIT_LENGTH}
              value={doseUnit}
              onChange={(event) => setDoseUnit(event.target.value)}
              error={
                fieldErrors.doseUnit
                  ? t(fieldErrors.doseUnit, { max: MAX_DOSE_UNIT_LENGTH })
                  : undefined
              }
              disabled={isSubmitting}
            />
            <datalist id="health-record-dose-units">
              {DOSE_UNIT_SUGGESTIONS.map((unit) => (
                <option key={unit} value={unit} />
              ))}
            </datalist>
          </div>
        </div>
      ) : (
        <Input
          id="health-record-vaccine-batch"
          label={t('health.form.vaccineBatchLabel')}
          placeholder={t('health.form.vaccineBatchPlaceholder')}
          maxLength={MAX_VACCINE_BATCH_LENGTH}
          value={vaccineBatch}
          onChange={(event) => setVaccineBatch(event.target.value)}
          error={
            fieldErrors.vaccineBatch
              ? t(fieldErrors.vaccineBatch, { max: MAX_VACCINE_BATCH_LENGTH })
              : undefined
          }
          disabled={isSubmitting}
        />
      )}

      <Textarea
        label={t('health.form.noteLabel')}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={fieldErrors.note ? t(fieldErrors.note, { max: MAX_NOTE_LENGTH }) : undefined}
        disabled={isSubmitting}
      />

      {/* Only offered once there is a date to remind about — a reminder with no
          due date has nothing to fire on. */}
      {dueAt.trim().length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(event) => setReminderEnabled(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-foreground">
              {t('health.form.reminderToggleLabel')}
            </span>
          </label>
          <p className="text-xs text-muted-foreground">{t('health.form.reminderHint')}</p>
        </div>
      )}

      <Button type="submit" variant="primary" className="self-start" disabled={isSubmitting}>
        {t(submitLabelKey)}
      </Button>
    </form>
  );
}

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateGrowthMeasurementInput, LengthMeasurementPosition } from '../../api/growth-api';
import { growthMeasureLimits, MAX_NOTE_LENGTH } from '../../lib/growthLimits';
import { todayAsCalendarDate } from '../../lib/growthFormat';
import { centimetresToMillimetres, kilogramsToGrams } from '../../lib/growthUnits';
import { ErrorMessage } from '../ErrorMessage';
import { Button, Input, Select, Textarea } from '../ui';

/**
 * UI-only value of the "automatic" position option. Radix's `Select` reserves
 * the empty string, and the API expresses "derive from age" by omitting the
 * field entirely (W-17) — so the two cannot be the same token.
 */
const POSITION_AUTO_OPTION = 'AUTO';

/** One decimal in the familiar display units, as W-3 prescribes. */
const VALUE_INPUT_STEP = '0.1';

type MeasurementFieldErrorKey =
  | 'growth.validation.atLeastOneValue'
  | 'growth.validation.weightRange'
  | 'growth.validation.lengthRange'
  | 'growth.validation.headCircumferenceRange'
  | 'growth.validation.measuredAtRequired'
  | 'growth.validation.measuredAtFuture'
  | 'growth.validation.measuredAtBeforeBirth'
  | 'growth.validation.noteTooLong';

interface FieldErrors {
  measuredAt?: MeasurementFieldErrorKey;
  weight?: MeasurementFieldErrorKey;
  length?: MeasurementFieldErrorKey;
  headCircumference?: MeasurementFieldErrorKey;
  note?: MeasurementFieldErrorKey;
  /** W-1 spans all three value fields, so it is reported once, form-level. */
  form?: MeasurementFieldErrorKey;
}

/** All fields as form-input-friendly strings, in the *display* units. */
export interface GrowthMeasurementFormInitialValues {
  /** `YYYY-MM-DD`. */
  measuredAt: string;
  weightKilograms: string;
  lengthCentimetres: string;
  headCircumferenceCentimetres: string;
  position: LengthMeasurementPosition | null;
  note: string;
}

/**
 * Submitted values, already converted to the API's integer base units.
 * `null` clears a field, which only edit mode ever produces.
 */
export type GrowthMeasurementFormOutput = Pick<CreateGrowthMeasurementInput, 'measuredAt'> & {
  weightGrams?: number | null;
  lengthMillimeters?: number | null;
  headCircumferenceMillimeters?: number | null;
  lengthMeasurementPosition?: LengthMeasurementPosition | null;
  note?: string | null;
};

export interface GrowthMeasurementFormProps {
  mode: 'create' | 'edit';
  /** `YYYY-MM-DD`; the earliest date a measurement may carry (W-5). */
  birthDate: string;
  initialValues?: GrowthMeasurementFormInitialValues;
  onSubmit: (output: GrowthMeasurementFormOutput) => Promise<void>;
}

/** Parses a display-unit input, returning `null` for an empty field. */
function parseOptionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Shared create/edit form for one growth measurement.
 *
 * Plain `useState` per field with a manual `validate()`, matching `ChildForm`
 * and the event forms rather than introducing a form library for one screen.
 *
 * Inputs work in kilograms and centimetres, the units printed in the
 * child health record; conversion to the API's integer grams/millimetres
 * happens once, on submit (W-3).
 */
export function GrowthMeasurementForm({
  mode,
  birthDate,
  initialValues,
  onSubmit,
}: GrowthMeasurementFormProps) {
  const { t } = useTranslation();
  const [measuredAt, setMeasuredAt] = useState(initialValues?.measuredAt ?? todayAsCalendarDate());
  const [weight, setWeight] = useState(initialValues?.weightKilograms ?? '');
  const [length, setLength] = useState(initialValues?.lengthCentimetres ?? '');
  const [headCircumference, setHeadCircumference] = useState(
    initialValues?.headCircumferenceCentimetres ?? '',
  );
  const [position, setPosition] = useState<string>(initialValues?.position ?? POSITION_AUTO_OPTION);
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weightGrams = parseOptionalNumber(weight);
  const lengthMillimetres = parseOptionalNumber(length);
  const headCircumferenceMillimetres = parseOptionalNumber(headCircumference);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (measuredAt.trim().length === 0) {
      errors.measuredAt = 'growth.validation.measuredAtRequired';
    } else if (measuredAt > todayAsCalendarDate()) {
      errors.measuredAt = 'growth.validation.measuredAtFuture';
    } else if (measuredAt < birthDate) {
      errors.measuredAt = 'growth.validation.measuredAtBeforeBirth';
    }

    const checks: {
      field: 'weight' | 'length' | 'headCircumference';
      raw: number | null | undefined;
      base: number | null;
      limits: (typeof growthMeasureLimits)[keyof typeof growthMeasureLimits];
      errorKey: MeasurementFieldErrorKey;
    }[] = [
      {
        field: 'weight',
        raw: weightGrams,
        base: weightGrams == null ? null : kilogramsToGrams(weightGrams),
        limits: growthMeasureLimits.WEIGHT,
        errorKey: 'growth.validation.weightRange',
      },
      {
        field: 'length',
        raw: lengthMillimetres,
        base: lengthMillimetres == null ? null : centimetresToMillimetres(lengthMillimetres),
        limits: growthMeasureLimits.LENGTH,
        errorKey: 'growth.validation.lengthRange',
      },
      {
        field: 'headCircumference',
        raw: headCircumferenceMillimetres,
        base:
          headCircumferenceMillimetres == null
            ? null
            : centimetresToMillimetres(headCircumferenceMillimetres),
        limits: growthMeasureLimits.HEAD_CIRCUMFERENCE,
        errorKey: 'growth.validation.headCircumferenceRange',
      },
    ];

    for (const check of checks) {
      // `undefined` means "typed something unparseable" — treated like an
      // out-of-range value so the user sees the bounds rather than a silent
      // drop.
      if (check.raw === undefined) {
        errors[check.field] = check.errorKey;
        continue;
      }
      if (check.base !== null && (check.base < check.limits.min || check.base > check.limits.max)) {
        errors[check.field] = check.errorKey;
      }
    }

    // W-1: a measurement with no value at all is meaningless.
    const hasAnyValue = checks.some((check) => check.base !== null && check.raw !== undefined);
    if (!hasAnyValue && !errors.weight && !errors.length && !errors.headCircumference) {
      errors.form = 'growth.validation.atLeastOneValue';
    }

    if (note.length > MAX_NOTE_LENGTH) {
      errors.note = 'growth.validation.noteTooLong';
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
      const toBaseUnit = (
        value: number | null | undefined,
        convert: (input: number) => number,
      ): number | null | undefined => {
        if (value === null) {
          // Create omits an empty field; edit sends an explicit null so the
          // stored value is actually cleared.
          return mode === 'edit' ? null : undefined;
        }
        return value === undefined ? undefined : convert(value);
      };

      await onSubmit({
        // Sent as the bare calendar day the user picked, exactly like
        // `Child.birthDate`. Turning it into an instant here would make the
        // stored day depend on the entering device's timezone (and could push
        // a measurement taken this morning into the server's "future").
        measuredAt,
        weightGrams: toBaseUnit(weightGrams, kilogramsToGrams),
        lengthMillimeters: toBaseUnit(lengthMillimetres, centimetresToMillimetres),
        headCircumferenceMillimeters: toBaseUnit(
          headCircumferenceMillimetres,
          centimetresToMillimetres,
        ),
        lengthMeasurementPosition:
          position === POSITION_AUTO_OPTION
            ? mode === 'edit'
              ? null
              : undefined
            : (position as LengthMeasurementPosition),
        note: note.trim().length > 0 ? note : mode === 'edit' ? null : undefined,
      });
      // No `finally` reset: a successful submit navigates away.
    } catch {
      // W-16: the page keeps the entered values and surfaces the failure via
      // a toast raised by the caller — nothing is buffered and no success
      // state is faked.
      setIsSubmitting(false);
    }
  };

  const submitLabelKey =
    mode === 'create'
      ? isSubmitting
        ? 'growth.form.submit.createPending'
        : 'growth.form.submit.create'
      : isSubmitting
        ? 'growth.form.submit.editPending'
        : 'growth.form.submit.edit';

  return (
    <form
      className="flex w-full flex-col gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <Input
        id="growth-measured-at"
        label={t('growth.form.measuredAtLabel')}
        type="date"
        required
        min={birthDate}
        max={todayAsCalendarDate()}
        value={measuredAt}
        onChange={(event) => setMeasuredAt(event.target.value)}
        error={fieldErrors.measuredAt ? t(fieldErrors.measuredAt) : undefined}
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-1">
        <Input
          id="growth-weight"
          label={t('growth.form.weightLabel')}
          type="number"
          inputMode="decimal"
          step={VALUE_INPUT_STEP}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          error={
            fieldErrors.weight
              ? t(fieldErrors.weight, {
                  min: growthMeasureLimits.WEIGHT.minDisplay,
                  max: growthMeasureLimits.WEIGHT.maxDisplay,
                })
              : undefined
          }
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">{t('growth.form.valuesHint')}</p>
      </div>

      <Input
        id="growth-length"
        label={t('growth.form.lengthLabel')}
        type="number"
        inputMode="decimal"
        step={VALUE_INPUT_STEP}
        value={length}
        onChange={(event) => setLength(event.target.value)}
        error={
          fieldErrors.length
            ? t(fieldErrors.length, {
                min: growthMeasureLimits.LENGTH.minDisplay,
                max: growthMeasureLimits.LENGTH.maxDisplay,
              })
            : undefined
        }
        disabled={isSubmitting}
      />

      <Input
        id="growth-head-circumference"
        label={t('growth.form.headCircumferenceLabel')}
        type="number"
        inputMode="decimal"
        step={VALUE_INPUT_STEP}
        value={headCircumference}
        onChange={(event) => setHeadCircumference(event.target.value)}
        error={
          fieldErrors.headCircumference
            ? t(fieldErrors.headCircumference, {
                min: growthMeasureLimits.HEAD_CIRCUMFERENCE.minDisplay,
                max: growthMeasureLimits.HEAD_CIRCUMFERENCE.maxDisplay,
              })
            : undefined
        }
        disabled={isSubmitting}
      />

      <div className="flex flex-col gap-1">
        <Select
          id="growth-position"
          label={t('growth.form.position.label')}
          value={position}
          disabled={isSubmitting}
          onValueChange={setPosition}
        >
          <Select.Item value={POSITION_AUTO_OPTION}>{t('growth.form.position.auto')}</Select.Item>
          <Select.Item value="LYING">{t('growth.form.position.lying')}</Select.Item>
          <Select.Item value="STANDING">{t('growth.form.position.standing')}</Select.Item>
        </Select>
        {/* W-19: the toggle explains why it exists, rather than being an
            unexplained clinical term. */}
        <p className="text-xs text-muted-foreground">{t('growth.form.position.explanation')}</p>
      </div>

      <Textarea
        label={t('growth.form.noteLabel')}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={fieldErrors.note ? t(fieldErrors.note) : undefined}
        disabled={isSubmitting}
      />

      {fieldErrors.form && <ErrorMessage message={t(fieldErrors.form)} />}

      <Button type="submit" variant="primary" className="self-start" disabled={isSubmitting}>
        {t(submitLabelKey)}
      </Button>
    </form>
  );
}

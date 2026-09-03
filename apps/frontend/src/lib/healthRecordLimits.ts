/**
 * Field limits for medications/vaccinations, mirroring
 * `apps/backend/src/health-record/health-record.constants.ts`.
 *
 * Kept in sync by hand, like `milestoneLimits.ts` and `growthLimits.ts`: they
 * exist so the form can `maxLength` an input instead of letting the user type
 * a value the server will reject.
 */

/** A medication or vaccine name, including its dosage form. */
export const MAX_HEALTH_RECORD_NAME_LENGTH = 200;

/** "ml", "mg", "Tropfen", "Stück" — a unit, never a sentence. */
export const MAX_DOSE_UNIT_LENGTH = 30;

/** Copied off a vaccination record, so occasionally a long alphanumeric code. */
export const MAX_VACCINE_BATCH_LENGTH = 200;

/** Same ceiling as a growth measurement's and a milestone's note. */
export const MAX_NOTE_LENGTH = 500;

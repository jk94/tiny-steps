/**
 * Field limits for health records, shared by the create and update DTOs.
 *
 * The frontend mirrors these in `apps/frontend/src/lib/healthRecordLimits.ts`;
 * any change here has to be made there too.
 */

/**
 * A medication or vaccine name ("Paracetamol 125mg Zäpfchen", "6-fach-Impfung
 * Infanrix hexa") — generous enough for a full trade name plus its dosage form,
 * which is how these read on a package.
 */
export const MAX_HEALTH_RECORD_NAME_LENGTH = 200;

/** "ml", "mg", "Tropfen", "Stück" — a unit, never a sentence. */
export const MAX_DOSE_UNIT_LENGTH = 30;

/** Copied off a vaccination record, so occasionally a long alphanumeric code. */
export const MAX_VACCINE_BATCH_LENGTH = 200;

/** Same ceiling as a growth measurement's and a milestone's note. */
export const MAX_NOTE_LENGTH = 500;

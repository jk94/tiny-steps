/**
 * Conversions between the units parents actually use (kilograms, centimetres)
 * and the integer base units the API stores (grams, millimetres) — W-3.
 *
 * The rounding on the way *in* is deliberate and one-directional: a value
 * typed with more precision than the base unit can hold (6.2534 kg) is
 * committed to the nearest gram once, at submit time, rather than being kept
 * as a float that would render differently on every screen.
 */
const GRAMS_PER_KILOGRAM = 1000;
const MILLIMETRES_PER_CENTIMETRE = 10;

export function kilogramsToGrams(kilograms: number): number {
  return Math.round(kilograms * GRAMS_PER_KILOGRAM);
}

export function gramsToKilograms(grams: number): number {
  return grams / GRAMS_PER_KILOGRAM;
}

export function centimetresToMillimetres(centimetres: number): number {
  return Math.round(centimetres * MILLIMETRES_PER_CENTIMETRE);
}

export function millimetresToCentimetres(millimetres: number): number {
  return millimetres / MILLIMETRES_PER_CENTIMETRE;
}

import type { AlexaChildOption } from '../api/alexa-api';

/**
 * "Emma" — or "Emma (Familie Müller)" once the children span more than one
 * household, so two children of separated parents' households stay
 * distinguishable in the default-child picker.
 */
export function childOptionLabel(
  child: AlexaChildOption,
  allChildren: readonly AlexaChildOption[],
): string {
  const households = new Set(allChildren.map((option) => option.householdName));
  return households.size > 1 ? `${child.name} (${child.householdName})` : child.name;
}

/** Radix Select cannot use an empty string as an item value. */
export const NO_DEFAULT_CHILD = 'none';

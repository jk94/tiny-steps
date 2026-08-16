import type { ComponentType } from 'react';
import type { EventTypeIconProps } from './EventTypeIconBase';
import { BreastfeedingIcon } from './BreastfeedingIcon';
import { BottleIcon } from './BottleIcon';
import { SolidFoodIcon } from './SolidFoodIcon';
import { SleepIcon } from './SleepIcon';
import { DiaperIcon } from './DiaperIcon';

export { EventTypeIconBase, type EventTypeIconProps } from './EventTypeIconBase';
export { BreastfeedingIcon } from './BreastfeedingIcon';
export { BottleIcon } from './BottleIcon';
export { SolidFoodIcon } from './SolidFoodIcon';
export { SleepIcon } from './SleepIcon';
export { DiaperIcon } from './DiaperIcon';

/**
 * Lookup keyed by the `iconKey` values used in
 * `design-system/tokens/event-types.json` (and the generated
 * `eventTypeTokens.generated.ts`). `getEventTypeVisual` resolves a timeline
 * row's icon component through this map.
 */
export const eventTypeIcons = {
  breastfeeding: BreastfeedingIcon,
  bottle: BottleIcon,
  'solid-food': SolidFoodIcon,
  sleep: SleepIcon,
  diaper: DiaperIcon,
} as const satisfies Record<string, ComponentType<EventTypeIconProps>>;

export type EventTypeIconKey = keyof typeof eventTypeIcons;

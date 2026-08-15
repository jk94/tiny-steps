import type { ComponentType } from 'react';
import type { EventType } from '../api/event-api';
import {
  eventTypeIcons,
  type EventTypeIconKey,
  type EventTypeIconProps,
} from '../components/ui/icons/event-types';
import { eventTypeTokens, type EventTypeTokenEntry } from './eventTypeTokens.generated';

/** The resolved visual identity of a single event/sub-type. */
export interface EventTypeVisual {
  /** CSS custom-property name holding the color, e.g. `--color-feeding-breast`. */
  colorVar: string;
  /** The icon component to render. */
  Icon: ComponentType<EventTypeIconProps>;
  /** i18n key for the human-readable label (under the `ui.eventTypes` namespace). */
  labelKey: string;
}

const tokensByKey = eventTypeTokens as Record<string, EventTypeTokenEntry | undefined>;

/**
 * Single place to resolve the color + icon + label for a timeline/list row from
 * its event type and optional sub-type (e.g. Feeding + `BREAST`). Sub-type keys
 * use dot notation (`FEEDING.BREAST`) matching `event-types.json`; an unknown or
 * omitted sub-type falls back to the base type's mapping. Consumed by a future
 * phase's timeline UI — kept here so icon/color resolution lives in exactly one
 * place (see ADR-0013).
 */
export function getEventTypeVisual(type: EventType, subtype?: string): EventTypeVisual {
  const compositeKey = subtype ? `${type}.${subtype}` : type;
  const entry = tokensByKey[compositeKey] ?? tokensByKey[type];
  if (!entry) {
    throw new Error(`No event-type visual mapping for "${compositeKey}"`);
  }
  const Icon = eventTypeIcons[entry.iconKey as EventTypeIconKey];
  return {
    colorVar: entry.colorVar,
    Icon,
    labelKey: `ui.eventTypes.${compositeKey.replace('.', '_')}`,
  };
}

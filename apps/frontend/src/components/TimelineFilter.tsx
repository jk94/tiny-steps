import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { EventType } from '../api/event-api';

const ALL_EVENT_TYPES: EventType[] = ['FEEDING', 'SLEEP', 'DIAPER'];

/**
 * A `switch` calling `t()` with a literal key directly in each branch
 * (mirroring `TimelineEventList`'s `entryLabel`), not a `Record<EventType,
 * string>` lookup table — this repo's `i18next.d.ts` module augmentation
 * only allows `t()` to be called with a literal translation-key string;
 * indexing a `Record` (or returning the key itself from a helper) widens the
 * value back to plain `string`, which `t()` then rejects at compile time.
 */
function filterLabel(t: TFunction, type: EventType): string {
  switch (type) {
    case 'FEEDING':
      return t('timeline.filter.feedingLabel');
    case 'SLEEP':
      return t('timeline.filter.sleepLabel');
    case 'DIAPER':
      return t('timeline.filter.diaperLabel');
  }
}

export interface TimelineFilterProps {
  /** Called with the full new enabled-types set on every toggle, including the initial default. */
  onChange: (enabledTypes: Set<EventType>) => void;
}

/**
 * Three toggle checkboxes (Feeding/Sleep/Diaper), defaulting to all three
 * enabled. Purely a client-side filter — no backend param, no query-key
 * impact (see `TimelineEventList`, which receives the resulting set and
 * filters the already-fetched daily events in-memory). Owns its own
 * checked/unchecked state; `onChange` is how the sibling
 * `TimelineEventList` (rendered by the same parent page) learns about the
 * current selection.
 */
export function TimelineFilter({ onChange }: TimelineFilterProps) {
  const { t } = useTranslation();
  const [enabledTypes, setEnabledTypes] = useState<Set<EventType>>(() => new Set(ALL_EVENT_TYPES));

  function toggle(type: EventType) {
    const next = new Set(enabledTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setEnabledTypes(next);
    onChange(next);
  }

  return (
    <fieldset>
      {ALL_EVENT_TYPES.map((type) => (
        <label key={type}>
          <input type="checkbox" checked={enabledTypes.has(type)} onChange={() => toggle(type)} />
          {filterLabel(t, type)}
        </label>
      ))}
    </fieldset>
  );
}

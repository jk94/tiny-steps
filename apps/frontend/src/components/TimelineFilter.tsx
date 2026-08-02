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
  /** The currently enabled event types, owned by the parent (fully controlled component). */
  enabledTypes: Set<EventType>;
  /** Called with the full new enabled-types set whenever a checkbox is toggled. */
  onChange: (enabledTypes: Set<EventType>) => void;
}

/**
 * Three toggle checkboxes (Feeding/Sleep/Diaper). Purely a client-side
 * filter — no backend param, no query-key impact (see `TimelineEventList`,
 * which receives the resulting set and filters the already-fetched daily
 * events in-memory). Fully controlled: `enabledTypes` and `onChange` are the
 * single source of truth, owned by the parent page, so this component holds
 * no state of its own.
 */
export function TimelineFilter({ enabledTypes, onChange }: TimelineFilterProps) {
  const { t } = useTranslation();

  function toggle(type: EventType) {
    const next = new Set(enabledTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
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

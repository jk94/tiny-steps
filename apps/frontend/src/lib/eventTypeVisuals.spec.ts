import { describe, expect, it } from 'vitest';
import { getEventTypeVisual } from './eventTypeVisuals';
import { BreastfeedingIcon, DiaperIcon } from '../components/ui/icons/event-types';

describe('getEventTypeVisual', () => {
  it('resolves a base event type to its color, icon, and label key', () => {
    const visual = getEventTypeVisual('DIAPER');
    expect(visual.colorVar).toBe('--color-diaper');
    expect(visual.Icon).toBe(DiaperIcon);
    expect(visual.labelKey).toBe('ui.eventTypes.DIAPER');
  });

  it('resolves a sub-type to its more specific color and icon', () => {
    const visual = getEventTypeVisual('FEEDING', 'BREAST');
    expect(visual.colorVar).toBe('--color-feeding-breast');
    expect(visual.Icon).toBe(BreastfeedingIcon);
    expect(visual.labelKey).toBe('ui.eventTypes.FEEDING_BREAST');
  });

  it('falls back to the base type mapping for an unknown sub-type', () => {
    const visual = getEventTypeVisual('FEEDING', 'NOPE');
    expect(visual.colorVar).toBe('--color-feeding');
    expect(visual.labelKey).toBe('ui.eventTypes.FEEDING');
  });
});

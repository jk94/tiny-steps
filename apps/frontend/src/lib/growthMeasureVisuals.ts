import { Ruler, Scan, Weight, type LucideIcon } from 'lucide-react';

/** The three body measures a growth measurement can carry (W-2). */
export type GrowthMeasure = 'WEIGHT' | 'LENGTH' | 'HEAD_CIRCUMFERENCE';

export interface GrowthMeasureVisual {
  /** CSS custom-property name holding the measure's color. */
  colorVar: string;
  Icon: LucideIcon;
  /** i18n key of the measure's label. */
  labelKey: string;
  /** i18n key of the unit the value is *displayed* in (not stored in). */
  unitKey: string;
}

/**
 * Color/icon/label lookup for the growth measures, deliberately hand-written
 * and separate from `eventTypeVisuals.ts`.
 *
 * A growth measurement is not an `Event` (see ADR-0006's addendum), so it has
 * no entry in `design-system/tokens/event-types.json` — extending
 * `getEventTypeVisual` would have meant either inventing fake event types or
 * loosening its "unknown key throws" contract. Generic `lucide-react` icons
 * are enough here; the hand-authored SVG set exists specifically for the event
 * types shown in the mixed timeline, which this is not part of.
 */
export const growthMeasureVisuals: Record<GrowthMeasure, GrowthMeasureVisual> = {
  WEIGHT: {
    colorVar: '--color-growth-weight',
    Icon: Weight,
    labelKey: 'growth.measures.weight',
    unitKey: 'growth.units.kg',
  },
  LENGTH: {
    colorVar: '--color-growth-length',
    Icon: Ruler,
    labelKey: 'growth.measures.length',
    unitKey: 'growth.units.cm',
  },
  HEAD_CIRCUMFERENCE: {
    colorVar: '--color-growth-head-circumference',
    Icon: Scan,
    labelKey: 'growth.measures.headCircumference',
    unitKey: 'growth.units.cm',
  },
};

/** Stable render order for the measure tabs and the summary card. */
export const GROWTH_MEASURES: GrowthMeasure[] = ['WEIGHT', 'LENGTH', 'HEAD_CIRCUMFERENCE'];

/* GENERATED FILE — do not edit by hand. Run 'bun run design-tokens:build' to regenerate. Source: design-system/tokens/*.json */

/** One resolved event-type visual mapping: a CSS custom-property name holding
 * the color, plus the hand-authored icon key (see the icons/event-types barrel). */
export interface EventTypeTokenEntry {
  colorVar: string;
  iconKey: string;
}

/** Event/sub-type key -> visual tokens, generated from
 * `design-system/tokens/event-types.json`. Sub-type keys use dot notation
 * (e.g. `'FEEDING.BREAST'`) matching the EventType union + sub-type fields. */
export const eventTypeTokens = {
  FEEDING: { colorVar: '--color-feeding', iconKey: 'bottle' },
  'FEEDING.BREAST': { colorVar: '--color-feeding-breast', iconKey: 'breastfeeding' },
  'FEEDING.BOTTLE': { colorVar: '--color-feeding-bottle', iconKey: 'bottle' },
  'FEEDING.SOLID': { colorVar: '--color-feeding-solid', iconKey: 'solid-food' },
  SLEEP: { colorVar: '--color-sleep', iconKey: 'sleep' },
  DIAPER: { colorVar: '--color-diaper', iconKey: 'diaper' },
  'DIAPER.PEE': { colorVar: '--color-diaper-pee', iconKey: 'diaper' },
  'DIAPER.STOOL': { colorVar: '--color-diaper-stool', iconKey: 'diaper' },
  'DIAPER.BOTH': { colorVar: '--color-diaper-both', iconKey: 'diaper' },
} as const satisfies Record<string, EventTypeTokenEntry>;

export type EventTypeTokenKey = keyof typeof eventTypeTokens;

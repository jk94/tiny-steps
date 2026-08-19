import { describe, expect, it } from 'vitest';
import colorTokens from '../../../../../design-system/tokens/color.json';

/**
 * WCAG 2.1 contrast-ratio regression guard for every `Badge` variant's
 * background/foreground pair, in both light and dark mode, read directly from
 * `design-system/tokens/color.json` (the single source of truth all three
 * generated artifacts derive from — see `docs/design-system/reconciliation-process.md`).
 * Catches the class of bug found during the Phase 6 M4 accessibility audit:
 * a colored badge background paired with `text-white` that looked fine but
 * failed AA (as low as 1.53:1 in dark mode for `diaper-pee`).
 */

type Mode = 'light' | 'dark';
type ColorTokens = Record<string, Record<Mode, string>>;

const colors = colorTokens as ColorTokens;

// Background/foreground token pairs, mirroring `badgeVariants` in `./Badge.tsx`.
const BADGE_VARIANT_TOKEN_PAIRS: Record<string, { background: string; foreground: string }> = {
  default: { background: 'secondary', foreground: 'secondary-foreground' },
  success: { background: 'success', foreground: 'success-foreground' },
  warning: { background: 'warning', foreground: 'warning-foreground' },
  destructive: { background: 'destructive', foreground: 'destructive-foreground' },
  feeding: { background: 'feeding', foreground: 'feeding-foreground' },
  'feeding-breast': { background: 'feeding-breast', foreground: 'feeding-breast-foreground' },
  'feeding-bottle': { background: 'feeding-bottle', foreground: 'feeding-bottle-foreground' },
  'feeding-solid': { background: 'feeding-solid', foreground: 'feeding-solid-foreground' },
  sleep: { background: 'sleep', foreground: 'sleep-foreground' },
  diaper: { background: 'diaper', foreground: 'diaper-foreground' },
  'diaper-pee': { background: 'diaper-pee', foreground: 'diaper-pee-foreground' },
  'diaper-stool': { background: 'diaper-stool', foreground: 'diaper-stool-foreground' },
  'diaper-both': { background: 'diaper-both', foreground: 'diaper-both-foreground' },
};

const WCAG_AA_NORMAL_TEXT_MIN_RATIO = 4.5;

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Badge variant color contrast (WCAG AA)', () => {
  it.each(Object.entries(BADGE_VARIANT_TOKEN_PAIRS))(
    '%s variant clears 4.5:1 in light and dark mode',
    (_variant, { background, foreground }) => {
      (['light', 'dark'] as const).forEach((mode) => {
        const ratio = contrastRatio(colors[background][mode], colors[foreground][mode]);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      });
    },
  );
});

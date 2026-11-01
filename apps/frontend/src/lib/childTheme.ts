/**
 * Each child gets one of a handful of gradients, picked deterministically from
 * its id, so a family with several children can tell the tiles apart at a
 * glance and a child keeps "its" color everywhere — the household tile and the
 * child-home hero share it, which is what makes the expanding-tile transition
 * read as one surface growing.
 *
 * Decorative, like the illustrations, hence literal colors rather than design
 * tokens; every stop keeps white text at WCAG AA (≥ 4.5:1), checked by
 * `childTheme.spec.ts`.
 */
export const CHILD_GRADIENTS = [
  { from: '#6246ea', to: '#9b3fd6', className: 'bg-[linear-gradient(135deg,#6246ea,#9b3fd6)]' },
  { from: '#2563eb', to: '#0e7490', className: 'bg-[linear-gradient(135deg,#2563eb,#0e7490)]' },
  { from: '#be185d', to: '#a21caf', className: 'bg-[linear-gradient(135deg,#be185d,#a21caf)]' },
  { from: '#047857', to: '#0f766e', className: 'bg-[linear-gradient(135deg,#047857,#0f766e)]' },
  { from: '#c2410c', to: '#be185d', className: 'bg-[linear-gradient(135deg,#c2410c,#be185d)]' },
] as const;

/** Stable gradient class for a child id (a tiny string hash, not crypto). */
export function childGradientClass(childId: string): string {
  let hash = 0;
  for (let index = 0; index < childId.length; index += 1) {
    hash = (hash * 31 + childId.charCodeAt(index)) >>> 0;
  }
  return CHILD_GRADIENTS[hash % CHILD_GRADIENTS.length].className;
}

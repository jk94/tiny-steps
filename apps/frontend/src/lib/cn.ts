import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names for the `components/ui/` primitives: `clsx` handles
 * conditional/array/object inputs, then `tailwind-merge` resolves conflicting
 * Tailwind utilities so a consumer-passed `className` reliably wins over a
 * component's defaults (e.g. `cn('px-4', 'px-2')` -> `'px-2'`). See ADR-0013.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

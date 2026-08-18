import type { SVGProps } from 'react';
import { cn } from '../../../../lib/cn';

export type FlagIconProps = SVGProps<SVGSVGElement>;

/** Flags are 3:2, not square — the intrinsic size below is 21×14 CSS px. */
const FLAG_WIDTH = 21;
const FLAG_HEIGHT = 14;

/**
 * Shared wrapper for the language-switcher flag icons. Deliberately *not*
 * built on `EventTypeIconBase`: flags are flat multi-colour fills at a 3:2
 * aspect ratio, the exact opposite of that base's monochrome
 * `stroke="currentColor"` 24×24 language.
 *
 * Always decorative (`aria-hidden`) — the enclosing language button carries
 * the accessible name (`language.switchToGerman`/`switchToEnglish`), so
 * announcing the flag too would just duplicate it. A rounded clip plus a
 * subtle border keeps a white flag stripe visible against a white header.
 */
export function FlagIconBase({ children, className, ...props }: FlagIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 30 20"
      width={FLAG_WIDTH}
      height={FLAG_HEIGHT}
      aria-hidden="true"
      // `size-auto` is load-bearing twice over: it makes the SVG fall back to
      // its intrinsic 3:2 width/height attributes above, and — because it
      // matches `[class*='size-']` — it opts out of `Button`'s
      // `[&_svg:not([class*='size-'])]:size-4` rule, which would otherwise
      // squash a flag inside a button into a 16×16 square.
      className={cn('size-auto', className)}
      {...props}
    >
      {children}
      <rect
        x={0.5}
        y={0.5}
        width={29}
        height={19}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
      />
    </svg>
  );
}

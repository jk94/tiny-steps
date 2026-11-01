import type { ReactNode, SVGProps } from 'react';
import { cn } from '../../lib/cn';

export interface IllustrationProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /**
   * Accessible name. Omit it (the default) for a purely decorative use — the
   * illustration is then hidden from assistive technology, which is right
   * wherever a visible label sits next to it (a tile, a header, an empty
   * state with its own heading).
   */
  title?: string;
}

/**
 * Shared frame for the hand-drawn illustration set: a square 120×120 canvas,
 * no intrinsic size (the caller sizes it via `className`), and the
 * decorative-by-default accessibility contract described on `title`.
 *
 * Every illustration paints its own pastel background blob, so it reads the
 * same on the light `canvas` and on a dark card — no theme-dependent colors
 * inside, which is also why these are not driven by the design tokens.
 */
export function IllustrationSvg({
  title,
  className,
  children,
  ...props
}: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      className={cn('shrink-0', className)}
      {...(title ? { role: 'img' } : { 'aria-hidden': true })}
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

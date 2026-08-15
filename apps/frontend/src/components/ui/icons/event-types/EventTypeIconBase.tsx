import type { SVGProps } from 'react';

export type EventTypeIconProps = SVGProps<SVGSVGElement>;

/**
 * Shared wrapper for the hand-authored event-type icons. Matches Lucide's
 * visual language (24×24 viewBox, `stroke="currentColor"`, `strokeWidth={2}`,
 * `fill="none"`, rounded caps/joins) so these domain icons sit consistently
 * next to `lucide-react` icons used elsewhere in the primitives. Decorative by
 * default (`aria-hidden`); callers that need a labelled icon can override via
 * `...props`.
 */
export function EventTypeIconBase({ children, ...props }: EventTypeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

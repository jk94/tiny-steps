import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

// Base ported from shadcn/ui's Skeleton reference (`bg-accent animate-pulse
// rounded-md`); the `shape` variant is this design system's own addition, so
// `rect` carries shadcn's default radius and the other shapes override it.
const skeletonVariants = cva('animate-pulse bg-accent', {
  variants: {
    shape: {
      rect: 'rounded-md',
      circle: 'rounded-full',
      text: 'h-4 w-full rounded',
    },
  },
  defaultVariants: {
    shape: 'rect',
  },
});

export interface SkeletonProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {}

/**
 * Decorative loading placeholder shown while content is fetched. Always
 * `aria-hidden` — a skeleton conveys no information to assistive tech; the
 * surrounding region should carry an `aria-busy`/live-region status instead.
 * Size it via `className` (e.g. `h-4 w-32`); `shape` sets the corner style.
 */
export function Skeleton({ shape, className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
}

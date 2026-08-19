import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  // Structure ported from shadcn/ui's Badge reference: a `w-fit`/`shrink-0`
  // flex pill that clips overflow, sizes any inline SVG child, and keeps the
  // glyph non-interactive. The pill radius (`rounded-full`, not shadcn's
  // `rounded-md`) is this design system's own documented shape.
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border font-medium whitespace-nowrap transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        feeding: 'border-transparent bg-feeding text-feeding-foreground',
        'feeding-breast': 'border-transparent bg-feeding-breast text-feeding-breast-foreground',
        'feeding-bottle': 'border-transparent bg-feeding-bottle text-feeding-bottle-foreground',
        'feeding-solid': 'border-transparent bg-feeding-solid text-feeding-solid-foreground',
        sleep: 'border-transparent bg-sleep text-sleep-foreground',
        diaper: 'border-transparent bg-diaper text-diaper-foreground',
        'diaper-pee': 'border-transparent bg-diaper-pee text-diaper-pee-foreground',
        'diaper-stool': 'border-transparent bg-diaper-stool text-diaper-stool-foreground',
        'diaper-both': 'border-transparent bg-diaper-both text-diaper-both-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * Small, purely-presentational status/category label. Renders a non-interactive
 * `<span>` — it must never be a button/link (assert-tested), which is why it
 * deliberately does NOT take shadcn's `asChild`/`Slot` escape hatch. Provides
 * semantic variants (default/success/warning/destructive) and one variant per
 * event type so timeline/list entries can be color-coded from the design
 * tokens.
 */
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

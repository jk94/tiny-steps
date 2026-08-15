import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        feeding: 'bg-feeding text-white',
        'feeding-breast': 'bg-feeding-breast text-white',
        'feeding-bottle': 'bg-feeding-bottle text-white',
        'feeding-solid': 'bg-feeding-solid text-white',
        sleep: 'bg-sleep text-white',
        diaper: 'bg-diaper text-white',
        'diaper-pee': 'bg-diaper-pee text-white',
        'diaper-stool': 'bg-diaper-stool text-white',
        'diaper-both': 'bg-diaper-both text-white',
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
 * `<span>` — it must never be a button/link (assert-tested). Provides semantic
 * variants (default/success/warning/destructive) and one variant per event type
 * so a future timeline/list migration can color-code entries from the design
 * tokens instead of dead, undefined CSS classes (e.g. the `offline-badge`
 * classes referenced but never defined in `OfflineStatusBadge.tsx`).
 */
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  // Base ported from shadcn/ui's Button reference: `shrink-0` so a button in a
  // flex row keeps its size, plus the `[&_svg]` rules that size and neutralize
  // leading/trailing icons (including the loading spinner) without each call
  // site repeating them. The focus ring stays this design system's own
  // ring/ring-offset pair, shared with Input, Select and Tabs.
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, sets `aria-busy`, and blocks interaction while true. */
  isLoading?: boolean;
  /**
   * Renders the single child element (e.g. a router `<Link>`) with the button's
   * styling and props merged in, instead of a `<button>`. The child is then
   * responsible for its own semantics — see the doc comment below.
   */
  asChild?: boolean;
}

/**
 * The primary interactive control. Forwards its `ref` and spreads all native
 * `<button>` props. When `isLoading`, it renders a leading spinner, sets
 * `aria-busy="true"`, and blocks interaction. Consumers set `type` explicitly
 * (native default is `submit`).
 *
 * `asChild` (Radix's `Slot`) is an additive opt-in for the "link that looks
 * like a button" case; it is off by default, so existing call sites are
 * unaffected. Because a non-`<button>` child ignores the `disabled` attribute,
 * the disabled/loading state is mirrored onto `aria-disabled` in that mode
 * (which the base classes also key off), but preventing navigation remains the
 * child's responsibility.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, isLoading = false, asChild = false, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  const isDisabled = disabled || isLoading;

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : isDisabled}
      aria-disabled={asChild && isDisabled ? true : undefined}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
    </Comp>
  );
});

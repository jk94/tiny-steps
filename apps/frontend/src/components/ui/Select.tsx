import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Visible, programmatically-associated label text. */
  label: string;
  /** When set, marks the control invalid and renders the message below it. */
  error?: string;
}

/**
 * A labeled wrapper around the native `<select>`, with the same label/error and
 * `aria-*` wiring as `Input`. Deliberately native: the open dropdown is not
 * fully cross-browser stylable without a combobox library — an accepted
 * trade-off (see ADR-0013 and the Select styleguide entry). Options are passed
 * as `children`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : false}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            error && 'border-destructive',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible, programmatically-associated label text. */
  label: string;
  /** When set, marks the field invalid and renders the message below it. */
  error?: string;
}

/**
 * A labeled text input. The `<label>` is associated to the `<input>` via
 * `htmlFor`/`id` (auto-generated with `useId` when no `id` is passed). When
 * `error` is set, the input gets `aria-invalid="true"` and `aria-describedby`
 * pointing at the rendered error message (itself `role="alert"`). Forwards
 * `ref` and spreads native `<input>` props.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : false}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          error && 'border-destructive',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

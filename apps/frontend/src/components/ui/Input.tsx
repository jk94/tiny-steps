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
 *
 * Deliberately uses a native `<label htmlFor>` rather than Radix's Label
 * primitive: that primitive exists to make labels work for *non-native*
 * controls, and this component wraps a real `<input>`, where `htmlFor`/`id`
 * already provides the full association and click-to-focus behavior.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div data-slot="input-field" className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        data-slot="input"
        aria-invalid={error ? true : false}
        aria-describedby={error ? errorId : undefined}
        // Ported from shadcn/ui's Input reference: the `input` border token
        // (distinct from the generic `border` role), placeholder/selection
        // colors, file-input normalization, and — instead of a JS-computed
        // error class — an `aria-invalid:` variant, so the visual state can
        // never drift from the announced one.
        className={cn(
          'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
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

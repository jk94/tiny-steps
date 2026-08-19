import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible, programmatically-associated label text. */
  label: string;
  /** When set, marks the field invalid and renders the message below it. */
  error?: string;
}

/**
 * A labeled multi-line text field — `Input`'s exact label/error contract
 * (auto-generated `id` via `useId`, `aria-invalid`/`aria-describedby` wired
 * to a `role="alert"` message), just backed by a `<textarea>`. Extracted
 * during the Phase 6 M4 audit, which found the note fields in
 * `DiaperEventForm`/`FeedingEventForm` hand-rolling this exact pattern twice
 * because no primitive covered multi-line input.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;

  return (
    <div data-slot="textarea-field" className="flex flex-col gap-1">
      <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        data-slot="textarea"
        aria-invalid={error ? true : false}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
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

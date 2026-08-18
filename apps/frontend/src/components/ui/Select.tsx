/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its Item sub-component (plus the exported
   prop types) intentionally live in one file; the one-export-per-file
   fast-refresh rule doesn't fit this shadcn-style pattern. */
import { useId, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

export interface SelectProps {
  /** Visible, programmatically-associated label text. */
  label: string;
  /** When set, marks the control invalid and renders the message below it. */
  error?: string;
  /** Shown on the trigger while nothing is selected. */
  placeholder?: string;
  /** Controlled selected value (makes the component controlled). */
  value?: string;
  /** Uncontrolled initial selected value. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  /** Name submitted with a surrounding native `<form>`. */
  name?: string;
  required?: boolean;
  /** Falls back to a generated id used to associate the label with the trigger. */
  id?: string;
  /** `Select.Item` children. */
  children: ReactNode;
  /** Merged onto the trigger. */
  className?: string;
}

function SelectRoot({
  label,
  error,
  placeholder,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  id,
  children,
  className,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const errorId = `${triggerId}-error`;

  return (
    <div data-slot="select-field" className="flex flex-col gap-1">
      <label id={labelId} htmlFor={triggerId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        required={required}
      >
        <SelectPrimitive.Trigger
          id={triggerId}
          data-slot="select-trigger"
          // The trigger is a `button[role=combobox]`, whose accessible name
          // would otherwise be computed from its own subtree (i.e. the selected
          // value) — a `<label for>` is not part of a button's name
          // computation. Pointing at the label makes the name the field label
          // and leaves the subtree to act as the combobox's *value*, which is
          // exactly how a native `<select>` announces.
          aria-labelledby={labelId}
          aria-invalid={error ? true : false}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[placeholder]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            data-slot="select-content"
            // `popper` (rather than the default `item-aligned`) is what lets
            // the list be width-matched to the trigger and flipped/clamped
            // inside the viewport — see the CSS variables used below.
            position="popper"
            className="relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1"
          >
            <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-muted-foreground">
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="w-full min-w-[var(--radix-select-trigger-width)] p-1">
              {children}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-muted-foreground">
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface SelectItemProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

function SelectItem({ value, disabled, children, className }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={value}
      disabled={disabled}
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center justify-center">
        <Check aria-hidden="true" className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/**
 * A labeled single-choice dropdown backed by Radix UI's Select primitive,
 * sharing the label/error/`aria-*` contract with `Input`.
 *
 * **This replaced a native-`<select>` wrapper and its API is not compatible
 * with it**: choices are now `Select.Item` children (mirroring the
 * `Tabs.Tab` naming convention) rather than raw `<option>` elements, selection
 * is reported through `onValueChange(value)` rather than a change event, and
 * the empty-value placeholder `<option>` is replaced by the `placeholder` prop.
 * Both call sites — `FeedingEventForm` and `DiaperEventForm` — were migrated
 * along with it.
 *
 * What it buys: a fully stylable, keyboard- and typeahead-navigable dropdown,
 * which the native control could not offer cross-browser (the limitation
 * previously documented in the styleguide). What it costs: the native OS picker
 * on mobile, including inside the Capacitor WebView — a trade-off accepted
 * deliberately, see `docs/design-system/components/select.md`.
 */
export const Select = Object.assign(SelectRoot, {
  Item: SelectItem,
});

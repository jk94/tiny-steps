/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its List/Tab/Panel sub-components (plus the
   exported prop types) intentionally live in one file; the one-export-per-file
   fast-refresh rule doesn't fit this shadcn-style pattern. */
import {
  createContext,
  useContext,
  useId,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs.List / Tabs.Tab / Tabs.Panel must be used within <Tabs>');
  }
  return ctx;
}

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export interface TabsProps {
  /** Uncontrolled initial selected value. */
  defaultValue: string;
  /** Controlled selected value (makes the component controlled). */
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

function TabsBase({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const baseId = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const setValue = (next: string) => {
    if (controlled === undefined) {
      setUncontrolled(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="tablist" className={cn('flex gap-1 border-b border-border', className)} {...props} />
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function Tab({ value, children, className }: TabProps) {
  const { value: selected, setValue, baseId } = useTabsContext();
  const isSelected = selected === value;

  // WAI-ARIA APG tabs pattern with automatic activation: arrow keys move focus
  // to the adjacent tab (wrapping) and activate it immediately.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    const list = event.currentTarget.closest('[role="tablist"]');
    if (!list) {
      return;
    }
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex === -1) {
      return;
    }
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(currentIndex + delta + tabs.length) % tabs.length];
    next.focus();
    next.click();
  };

  return (
    <button
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-selected={isSelected}
      aria-controls={panelId(baseId, value)}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => setValue(value)}
      onKeyDown={onKeyDown}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isSelected
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabPanel({ value, children, className }: TabPanelProps) {
  const { value: selected, baseId } = useTabsContext();
  if (selected !== value) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      tabIndex={0}
      className={cn('py-3 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
}

/**
 * Hand-built tabs following the WAI-ARIA APG tabs pattern (see ADR-0013): a
 * `role="tablist"` with `role="tab"` buttons (roving `tabindex`, correct
 * `aria-selected`) controlling `role="tabpanel"` regions. Arrow keys move focus
 * and activate the newly focused tab. Compound API: `Tabs.List` / `Tabs.Tab` /
 * `Tabs.Panel`. Controlled (`value` + `onValueChange`) or uncontrolled
 * (`defaultValue`).
 */
export const Tabs = Object.assign(TabsBase, {
  List: TabsList,
  Tab,
  Panel: TabPanel,
});

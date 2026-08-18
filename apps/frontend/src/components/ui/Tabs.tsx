/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its List/Tab/Panel sub-components (plus the
   exported prop types) intentionally live in one file; the one-export-per-file
   fast-refresh rule doesn't fit this shadcn-style pattern. */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

export interface TabsProps {
  /** Uncontrolled initial selected value. */
  defaultValue: string;
  /** Controlled selected value (makes the component controlled). */
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

function TabsBase({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      // Radix's default: ArrowLeft/ArrowRight move focus AND select, wrapping
      // at the ends — the WAI-ARIA APG "automatic activation" behavior this
      // component has always had. Spelled out rather than left implicit,
      // because it is a documented part of the public contract.
      activationMode="automatic"
      className={className}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      loop
      className={cn('flex gap-1 border-b border-border', className)}
      {...props}
    />
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function Tab({ value, children, className }: TabProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      // Selected/unselected styling comes off Radix's `data-state` attribute
      // rather than a React-computed boolean, so the DOM stays the single
      // source of truth for the visual state.
      className={cn(
        '-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-primary',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabPanel({ value, children, className }: TabPanelProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      value={value}
      className={cn('py-3 focus-visible:outline-none', className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

/**
 * Tabs backed by Radix UI's Tabs primitive: `role="tablist"` › `role="tab"` ›
 * `role="tabpanel"`, roving `tabindex`, `aria-selected`/`aria-controls`/
 * `aria-labelledby` wiring and wrapping arrow-key navigation with automatic
 * activation, all owned by Radix.
 *
 * The compound slot names stay this design system's own (`Tabs.List` /
 * `Tabs.Tab` / `Tabs.Panel`, not Radix's `Trigger`/`Content`), and the
 * controlled (`value` + `onValueChange`) / uncontrolled (`defaultValue`) API is
 * unchanged — this is a drop-in replacement for the previous hand-built
 * implementation.
 */
export const Tabs = Object.assign(TabsBase, {
  List: TabsList,
  Tab,
  Panel: TabPanel,
});

/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its Header/Body/Footer sub-components (plus
   the exported prop types) intentionally live in one file; the one-export-per-
   file fast-refresh rule doesn't fit this shadcn-style pattern. */
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

function CardRoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1 border-b border-border p-4', className)}
      {...props}
    />
  );
}

function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('p-4', className)} {...props} />;
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-2 border-t border-border p-4', className)}
      {...props}
    />
  );
}

/**
 * Surface container for grouping related content (stat widgets, list rows,
 * form sections). A compound component: use `Card.Header` / `Card.Body` /
 * `Card.Footer` as slots (attached as static properties, the shadcn convention).
 * All slots are optional and are plain `<div>`s that accept native attributes.
 *
 * There is no Radix equivalent — shadcn/ui's own Card is likewise plain
 * markup. What is adopted from its reference implementation: the
 * `bg-card`/`text-card-foreground` token pair (a distinct surface role rather
 * than reusing the page background), the `flex flex-col` root so slots stack
 * predictably even when a consumer adds `grow`, and the `data-slot` styling
 * hooks. This design system keeps its own slot-separating borders and 1rem
 * padding rather than shadcn's gap-based spacing, since 15 screens depend on
 * that layout.
 */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export type CardProps = HTMLAttributes<HTMLDivElement>;

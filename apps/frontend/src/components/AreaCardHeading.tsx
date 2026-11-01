import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import type { ChildArea } from '../lib/childAreas';

export interface AreaCardHeadingProps {
  area: ChildArea;
  children: ReactNode;
  className?: string;
}

/**
 * The heading of a child-home summary card: the area's icon in an
 * area-tinted chip, then the title. Gives each card its area color without
 * repainting the whole card.
 */
export function AreaCardHeading({ area, children, className }: AreaCardHeadingProps) {
  return (
    <h2
      className={cn('flex items-center gap-2 text-base font-extrabold text-foreground', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          area.tint,
          area.ink,
        )}
      >
        <area.Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      {children}
    </h2>
  );
}

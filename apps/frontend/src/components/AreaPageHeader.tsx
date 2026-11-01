import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import type { ChildArea } from '../lib/childAreas';
import { cn } from '../lib/cn';

export interface AreaPageHeaderProps {
  area: ChildArea;
  title: string;
  subtitle?: string;
  backTo: string;
  backLabel: string;
  /** Optional primary action under the title (e.g. "add milestone"). */
  action?: ReactNode;
}

/**
 * The top of every per-child area screen: a back link, then a softly
 * area-tinted banner with the page title and the area's illustration — the
 * same picture the area has in the "more" and quick-add sheets, so each screen
 * is recognisable at a glance.
 */
export function AreaPageHeader({
  area,
  title,
  subtitle,
  backTo,
  backLabel,
  action,
}: AreaPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 self-start text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </Link>
      <div
        className={cn(
          'relative flex items-center gap-4 overflow-hidden rounded-xl p-4 sm:p-5',
          area.tint,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h1 className="text-2xl leading-tight font-black text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {action && <div className="mt-2">{action}</div>}
        </div>
        <area.Illustration className="h-20 w-20 sm:h-24 sm:w-24" />
      </div>
    </div>
  );
}

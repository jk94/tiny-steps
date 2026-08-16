import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Decorative icon/illustration shown above the heading. */
  icon?: ReactNode;
  /** Heading; defaults to a generic translated "Nothing here yet" message. */
  title?: string;
  /** Supporting explanatory text. */
  description?: string;
  /** Optional call-to-action slot (typically a `<Button>`). */
  action?: ReactNode;
}

/**
 * Centered "nothing here yet" placeholder for empty lists/collections: an
 * optional icon, a heading, optional description, and an optional action slot
 * (e.g. a "Create household" button). `title` falls back to a generic
 * translated message when omitted.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground',
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="text-muted-foreground">
          {icon}
        </span>
      )}
      <h2 className="text-lg font-semibold text-foreground">
        {title ?? t('ui.emptyState.defaultTitle')}
      </h2>
      {description && <p className="max-w-prose text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

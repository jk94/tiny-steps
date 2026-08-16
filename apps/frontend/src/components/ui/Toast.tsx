import { useTranslation } from 'react-i18next';
import { cva } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastVariant = 'info' | 'success' | 'destructive';

/** What a caller passes to `toast()`. */
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms; `0` disables auto-dismiss. Defaults to the provider's default. */
  duration?: number;
}

/** A queued toast (options plus its generated id). */
export interface ToastRecord extends ToastOptions {
  id: string;
}

const toastVariants = cva(
  'pointer-events-auto flex w-80 items-start gap-3 rounded-md border bg-background p-3 text-foreground shadow-lg',
  {
    variants: {
      variant: {
        info: 'border-border',
        success: 'border-success',
        destructive: 'border-destructive',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const iconByVariant = {
  info: Info,
  success: CheckCircle2,
  destructive: AlertTriangle,
} as const;

const iconColorByVariant: Record<ToastVariant, string> = {
  info: 'text-muted-foreground',
  success: 'text-success',
  destructive: 'text-destructive',
};

export interface ToastProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

/**
 * Presentational single toast. Info/success use `role="status"`
 * (polite announcement); destructive uses `role="alert"` (assertive). Renders a
 * variant icon, title, optional description, and a manual dismiss button with a
 * translated accessible label.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { t } = useTranslation();
  const variant = toast.variant ?? 'info';
  const Icon = iconByVariant[variant];
  const role = variant === 'destructive' ? 'alert' : 'status';

  return (
    <div role={role} className={cn(toastVariants({ variant }))}>
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 h-5 w-5 shrink-0', iconColorByVariant[variant])}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{toast.title}</p>
        {toast.description && <p className="text-sm text-muted-foreground">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('ui.toast.dismiss')}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

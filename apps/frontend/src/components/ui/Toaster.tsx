import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

/**
 * Maps Sonner's per-variant CSS custom properties onto this design system's
 * runtime color tokens, so toasts match the rest of the app instead of
 * shipping Sonner's default look. The `--rt-color-*` names are the runtime
 * variables emitted by `tokens.generated.css` (see the comment in the token
 * build script for why they are named distinctly from Tailwind's
 * `--color-*`); they already flip for dark mode, which is why no theme
 * detection is needed here.
 */
const sonnerTokenBridge = {
  '--normal-bg': 'var(--rt-color-popover)',
  '--normal-text': 'var(--rt-color-popover-foreground)',
  '--normal-border': 'var(--rt-color-border)',
  '--success-bg': 'var(--rt-color-popover)',
  '--success-text': 'var(--rt-color-popover-foreground)',
  '--success-border': 'var(--rt-color-success)',
  '--error-bg': 'var(--rt-color-popover)',
  '--error-text': 'var(--rt-color-popover-foreground)',
  '--error-border': 'var(--rt-color-destructive)',
  '--warning-bg': 'var(--rt-color-popover)',
  '--warning-text': 'var(--rt-color-popover-foreground)',
  '--warning-border': 'var(--rt-color-warning)',
} as CSSProperties;

export type { ToasterProps };

/**
 * App-level toast host. Mount once near the app root (see `main.tsx`); call
 * `toast()` / `toast.success()` / `toast.error()` from anywhere afterwards —
 * no context provider or hook needed, which is the main reason Sonner replaced
 * the previous hand-built ToastProvider/useToast pair.
 *
 * The manual dismiss (✕) button is enabled and carries a translated
 * `aria-label`, preserving the accessibility contract of the implementation
 * this replaced.
 */
export function Toaster(props: ToasterProps) {
  const { t } = useTranslation();

  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      containerAriaLabel={t('ui.toast.containerLabel')}
      toastOptions={{ closeButtonAriaLabel: t('ui.toast.dismiss') }}
      style={sonnerTokenBridge}
      {...props}
    />
  );
}

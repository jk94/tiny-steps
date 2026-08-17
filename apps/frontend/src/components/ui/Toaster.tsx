import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

/**
 * Maps Sonner's per-variant CSS custom properties onto this design system's
 * runtime color tokens, so toasts match the rest of the app instead of
 * shipping Sonner's default look. The `--rt-color-*` names are the runtime
 * variables emitted by `tokens.generated.css` (see the comment in the token
 * build script for why they are named distinctly from Tailwind's
 * `--color-*`).
 *
 * Every variant deliberately shares the neutral `popover` surface and only
 * differs in border color, matching how the rest of this design system signals
 * status. All five groups Sonner defines are covered — leaving one out would
 * silently fall back to Sonner's own hard-coded palette for that variant,
 * ignoring both the tokens and dark mode. `info` in particular is easy to miss
 * and easy to hit, since it was the default variant name in the hand-built
 * system this replaced.
 */
const sonnerTokenBridge = {
  '--normal-bg': 'var(--rt-color-popover)',
  '--normal-text': 'var(--rt-color-popover-foreground)',
  '--normal-border': 'var(--rt-color-border)',
  '--success-bg': 'var(--rt-color-popover)',
  '--success-text': 'var(--rt-color-popover-foreground)',
  '--success-border': 'var(--rt-color-success)',
  '--info-bg': 'var(--rt-color-popover)',
  '--info-text': 'var(--rt-color-popover-foreground)',
  '--info-border': 'var(--rt-color-primary)',
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
 * `toast()` / `toast.success()` / `toast.error()` / `toast.warning()` /
 * `toast.info()` from anywhere afterwards — no context provider or hook
 * needed, which is the main reason Sonner replaced the previous hand-built
 * ToastProvider/useToast pair.
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
      // Sonner defaults to `theme="light"`, which pins its description text to
      // a hard-coded near-black and only lifts it under its own
      // `[data-sonner-theme='dark']` selector — unreadable on our dark popover
      // surface. `system` follows `prefers-color-scheme`, the same mechanism
      // the generated color tokens use, so the two stay in step.
      theme="system"
      // Gates Sonner's per-type styling, without which the `--success-*` /
      // `--info-*` / `--warning-*` / `--error-*` variables bridged above are
      // inert and every toast renders with the `--normal-*` group. It also
      // switches description text to `color: inherit`, which is what actually
      // keeps it legible on both surfaces.
      richColors
      containerAriaLabel={t('ui.toast.containerLabel')}
      toastOptions={{ closeButtonAriaLabel: t('ui.toast.dismiss') }}
      style={sonnerTokenBridge}
      {...props}
    />
  );
}

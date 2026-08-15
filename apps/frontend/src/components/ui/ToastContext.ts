import { createContext } from 'react';
import type { ToastOptions } from './Toast';

export interface ToastContextValue {
  /** Enqueues a toast and returns its id. */
  toast: (options: ToastOptions) => string;
  /** Dismisses a toast (and cancels its auto-dismiss timer) by id. */
  dismiss: (id: string) => void;
}

// Split into its own file (rather than living in ToastProvider.tsx) so that
// file only exports the `ToastProvider` component — keeps React Fast Refresh
// happy (see `react-refresh/only-export-components`), mirroring AuthContext.ts.
export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

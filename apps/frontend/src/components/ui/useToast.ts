import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from './ToastContext';

/** Access the toast API (`toast()` / `dismiss()`). Must be used within a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

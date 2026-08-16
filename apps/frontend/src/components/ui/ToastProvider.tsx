import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Toast, type ToastOptions, type ToastRecord } from './Toast';
import { ToastContext, type ToastContextValue } from './ToastContext';

/** Default auto-dismiss delay (ms). Overridable per-toast or per-provider. */
const DEFAULT_DURATION = 5000;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Default auto-dismiss delay in ms for toasts that don't set their own. */
  duration?: number;
}

/**
 * App-level toast host: provides the `useToast()` API, keeps the toast queue,
 * runs per-toast auto-dismiss timers, and renders the stack into a
 * `document.body` portal so toasts float above the app regardless of where
 * `toast()` was called. See ADR-0013.
 */
export function ToastProvider({ children, duration = DEFAULT_DURATION }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback<ToastContextValue['dismiss']>((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    (options: ToastOptions) => {
      const id = createId();
      setToasts((prev) => [...prev, { id, ...options }]);
      const delay = options.duration ?? duration;
      if (delay > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), delay),
        );
      }
      return id;
    },
    [dismiss, duration],
  );

  // Clear any outstanding timers on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
          {toasts.map((record) => (
            <Toast key={record.id} toast={record} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

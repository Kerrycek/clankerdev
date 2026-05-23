import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { clsx } from '../components/ui/clsx';
import { Button } from '../components/ui/Button';
import { useI18n } from './i18n';

export type ToastVariant = 'neutral' | 'ok' | 'warn' | 'danger';

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Optional test id suffix for the action button (useful for E2E) */
  testId?: string;
}

export interface ToastSpec {
  variant?: ToastVariant;
  title: string;
  body?: string;
  action?: ToastAction;
  /** Auto-dismiss timeout in ms. Default: 8000. Set to `false` to disable. */
  autoDismissMs?: number | false;
}

export interface Toast extends Omit<ToastSpec, 'variant' | 'autoDismissMs'> {
  id: number;
  variant: ToastVariant;
  title: string;
  body: string;
  action?: ToastAction;
  createdAt: number;
  autoDismissMs: number | false;
}

export interface ToastsContextValue {
  toasts: Toast[];
  pushToast: (spec: ToastSpec) => number;
  /** Backward-compatible alias used across older pages. */
  push: (spec: ToastSpec) => number;
  dismissToast: (toastId: number) => void;
  clearToasts: () => void;
}

const ToastsContext = createContext<ToastsContextValue | null>(null);

export function ToastsProvider(props: { children: React.ReactNode }) {
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((toastId: number) => {
    const id = Number(toastId);
    if (!Number.isFinite(id) || id <= 0) return;

    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }

    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    for (const t of timers.current.values()) window.clearTimeout(t);
    timers.current.clear();
    setToasts([]);
  }, []);

  const pushToast = useCallback(
    (spec: ToastSpec) => {
      const id = nextId.current++;
      const toast: Toast = {
        id,
        variant: spec.variant ?? 'neutral',
        title: spec.title,
        body: spec.body ?? '',
        action: spec.action,
        createdAt: Date.now(),
        autoDismissMs: spec.autoDismissMs === undefined ? 8000 : spec.autoDismissMs,
      };

      setToasts((prev) => {
        const next = [toast, ...prev];
        // Keep the stack small and predictable.
        return next.slice(0, 5);
      });

      if (typeof window !== 'undefined' && toast.autoDismissMs !== false) {
        const handle = window.setTimeout(() => dismissToast(id), toast.autoDismissMs);
        timers.current.set(id, handle);
      }

      return id;
    },
    [dismissToast]
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const ctx = useMemo<ToastsContextValue>(
    () => ({ toasts, pushToast, push: pushToast, dismissToast, clearToasts }),
    [toasts, pushToast, dismissToast, clearToasts]
  );

  return (
    <ToastsContext.Provider value={ctx}>
      {props.children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastsContext.Provider>
  );
}

export function useToasts() {
  const ctx = useContext(ToastsContext);
  if (!ctx) throw new Error('useToasts must be used within ToastsProvider');
  return ctx;
}

function ToastViewport(props: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (typeof document === 'undefined') return null;
  if (!props.toasts.length) return null;

  return createPortal(
    <div
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 p-4',
        'pointer-events-none',
        'sm:inset-auto sm:bottom-4 sm:right-4 sm:w-drawer-md'
      )}
      data-testid="toast.viewport"
    >
      {props.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => props.onDismiss(t.id)} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem(props: { toast: Toast; onDismiss: () => void }) {
  const t = props.toast;
  const { t: tx } = useI18n();

  const styles =
    t.variant === 'danger'
      ? 'border-danger-border bg-danger-bg'
      : t.variant === 'warn'
        ? 'border-warn-border bg-warn-bg'
        : t.variant === 'ok'
          ? 'border-ok-border bg-ok-bg'
          : 'border-border bg-overlay-surface';

  const role = t.variant === 'danger' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={clsx(
        'pointer-events-auto rounded-lg border p-3 shadow-panel',
        'text-fg',
        styles
      )}
      data-testid={`toast.item.${t.id}`}
      data-overlay="toast"
      data-overlay-surface="overlay"
      data-toast-id={t.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t.title}</div>
          {t.body ? <div className="mt-1 text-sm text-muted">{t.body}</div> : null}
        </div>

        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2"
          aria-label={tx('common.close')}
          onClick={props.onDismiss}
          data-testid={`toast.item.${t.id}.close`}
        >
          <span aria-hidden>×</span>
        </button>
      </div>

      {t.action ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              t.action?.onClick();
              props.onDismiss();
            }}
            testId={t.action.testId ?? `toast.item.${t.id}.action`}
          >
            {t.action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

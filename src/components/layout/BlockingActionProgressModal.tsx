import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { useI18n } from '../../app/i18n';
import { fetchActionState } from '../../lib/api/actionStates';
import { actionStateProgressLabel, actionStateProgressPercent } from '../../lib/taskStatus';
import { useFastPollIntervalMs } from '../../lib/refreshTiers';
import type { TrackedActionState } from './ChromeContext';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

export function BlockingActionProgressModal(props: {
  actionStateId: number | null;
  tracked?: TrackedActionState | null;
  onClose: () => void;
  onOpenTasks: () => void;
}) {
  const { t } = useI18n();
  const actionStateId = props.actionStateId;

  const fastPollMs = useFastPollIntervalMs();

  const q = useQuery({
    queryKey: ['action_state', 'show', { id: actionStateId ?? -1 }],
    queryFn: async () => (await fetchActionState(actionStateId!)).data,
    enabled: actionStateId !== null,
    refetchInterval: (data) => {
      if (!data) return fastPollMs;
      return (data as any)?.finished ? false : fastPollMs;
    },
  });

  useEffect(() => {
    if (actionStateId === null) return;
    if (!q.data) return;
    if (!(q.data as any).finished) return;
    props.onClose();
  }, [actionStateId, q.data, props.onClose]);

  useEffect(() => {
    if (actionStateId === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      props.onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actionStateId, props.onClose]);

  const title = useMemo(() => {
    const key = props.tracked?.progressTitleKey;
    return key ? t(key) : t('modal.progress.title');
  }, [props.tracked?.progressTitleKey, t]);

  const actionLabel = useMemo(() => {
    if (props.tracked?.actionLabelKey) return t(props.tracked.actionLabelKey as any);
    if (props.tracked?.actionLabel) return String(props.tracked.actionLabel);
    return t('toast.unknown_action');
  }, [props.tracked?.actionLabel, props.tracked?.actionLabelKey, t]);

  const objectLabel = props.tracked?.objectLabel ? String(props.tracked.objectLabel) : null;

  const pct = q.data ? actionStateProgressPercent(q.data as any) : null;
  const progressLabel = q.data ? actionStateProgressLabel(q.data as any) : null;

  if (actionStateId === null) return null;

  return (
    <div
      className="fixed left-3 right-3 top-16 z-40 rounded-lg border border-border bg-overlay-surface shadow-panel sm:left-auto sm:right-4 sm:w-drawer-md md:top-20"
      data-testid="modal.action_progress"
      data-overlay="popover"
      data-overlay-surface="overlay"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fg">{title}</div>
          <p className="mt-0.5 text-xs text-muted">{t('modal.progress.body')}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          onClick={props.onClose}
          aria-label={t('common.close')}
          data-testid="modal.action_progress.close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="px-4 pt-3 text-sm">
          <span className="font-medium text-fg">{actionLabel}</span>
          {objectLabel ? <span className="text-faint">{` · ${objectLabel}`}</span> : null}
          {props.tracked?.id ? <span className="text-faint">{` · #${props.tracked.id}`}</span> : null}
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-2 px-4 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : null}

        {q.isError ? (
          <div className="mx-4 rounded-md border border-border bg-surface-2 p-3 text-sm text-muted">
            {t('tasks.error.load_action_states')}
          </div>
        ) : null}

        {pct !== null ? (
          <div className="space-y-1 px-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{progressLabel ?? t('common.progress')}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full rounded bg-surface-2">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : q.data ? (
          <div className="px-4 text-xs text-muted">{progressLabel ?? t('common.loading')}</div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              props.onClose();
              props.onOpenTasks();
            }}
            testId="modal.action_progress.open_tasks"
          >
            {t('common.open_tasks')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={props.onClose}
            testId="modal.action_progress.continue"
          >
            {t('common.continue_in_background')}
          </Button>
        </div>
      </div>
    </div>
  );
}

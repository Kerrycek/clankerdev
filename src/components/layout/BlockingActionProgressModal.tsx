import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { fetchActionState } from '../../lib/api/actionStates';
import { actionStateProgressLabel, actionStateProgressPercent } from '../../lib/taskStatus';
import { useFastPollIntervalMs } from '../../lib/refreshTiers';
import type { TrackedActionState } from './ChromeContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
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

  return (
    <Modal
      open={actionStateId !== null}
      onClose={props.onClose}
      title={title}
      size="sm"
      testId="modal.action_progress"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={props.onOpenTasks} testId="modal.action_progress.open_tasks">
            {t('common.open_tasks')}
          </Button>
          <Button
            variant="secondary"
            onClick={props.onClose}
            testId="modal.action_progress.continue"
          >
            {t('common.continue_in_background')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">{t('modal.progress.body')}</p>

        <div className="text-sm">
          <span className="font-medium text-fg">{actionLabel}</span>
          {objectLabel ? <span className="text-faint">{` · ${objectLabel}`}</span> : null}
          {props.tracked?.id ? <span className="text-faint">{` · #${props.tracked.id}`}</span> : null}
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : null}

        {q.isError ? (
          <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted">
            {t('tasks.error.load_action_states')}
          </div>
        ) : null}

        {pct !== null ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{progressLabel ?? t('common.progress')}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full rounded bg-surface-2">
              <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : q.data ? (
          <div className="text-xs text-muted">{progressLabel ?? t('common.loading')}</div>
        ) : null}
      </div>
    </Modal>
  );
}

import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';

import { cancelActionState, fetchActionState, type ActionState } from '../../lib/api/actionStates';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { DetailShell } from '../../components/layout/DetailShell';
import { useChrome } from '../../components/layout/ChromeContext';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ObjectHeader } from '../../components/ui/ObjectHeader';
import { formatDateTime } from '../../lib/format';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFinishedActionState,
} from '../../lib/taskStatus';
import { useActionStatePollIntervalMs } from '../../lib/refreshTiers';

export function ActionStateDetailPage() {
  const { basePath } = useAppMode();
  const chrome = useChrome();
  const { t } = useI18n();

  const actionPollMs = useActionStatePollIntervalMs();
  const params = useParams();
  const id = Number(params['actionStateId']);

  const q = useQuery({
    queryKey: ['action_state', 'show', { id }],
    queryFn: async () => (await fetchActionState(id)).data,
    enabled: Number.isFinite(id) && id > 0,
    refetchInterval: (data) => (data && isFinishedActionState(data as any) ? false : actionPollMs),
  });

  const s = q.data as any as ActionState | undefined;

  const tracked = useMemo(
    () => chrome.trackedActionStates.some((x) => x.id === id),
    [chrome.trackedActionStates, id]
  );
  const pinned = useMemo(() => chrome.pinnedActionStates.includes(id), [chrome.pinnedActionStates, id]);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelM = useMutation({
    mutationFn: async () => cancelActionState(id),
    onMutate: () => setCancelError(null),
    onSuccess: () => {
      setConfirmCancel(false);
      setCancelError(null);
      void q.refetch();
    },
    onError: (err: any) => {
      setCancelError(String(err?.message ?? err));
    },
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.invalid_id"
          kindOverride="not_found"
          title={t('action_state.invalid_id.title')}
          body={t('action_state.invalid_id.body')}
          backTo={`${basePath}/action-states`}
          showStatusLink={false}
          showDetails={false}
          detailsExtra={{ page: 'action_state.detail', actionStateId: params['actionStateId'] }}
        />
      </DetailShell>
    );
  }

  if (q.isLoading && !s) {
    return (
      <DetailShell testId="action_state.detail">
        <LoadingState testId="action_state.detail.loading" />
      </DetailShell>
    );
  }

  if (q.isError) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.error"
          title={t('action_state.load_error.title')}
          error={q.error}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/action-states`}
          detailsExtra={{ page: 'action_state.detail', actionStateId: id }}
        />
      </DetailShell>
    );
  }

  if (!s) {
    return (
      <DetailShell testId="action_state.detail">
        <ErrorState
          testId="action_state.detail.not_found"
          kindOverride="not_found"
          title={t('action_state.not_found.title')}
          body={t('action_state.not_found.body')}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/action-states`}
          showDetails={false}
          detailsExtra={{ page: 'action_state.detail', actionStateId: id }}
        />
      </DetailShell>
    );
  }

  const badge = actionStateBadge(s);
  const pct = actionStateProgressPercent(s);
  const pLabel = actionStateProgressLabel(s);

  const relatedChainId = extractRelatedTransactionChainIdFromActionState(s);

  const pinLabel = pinned ? t('tasks.action.unpin') : t('tasks.action.pin');

  const createdAt = (s as any).created_at ? formatDateTime(String((s as any).created_at)) : null;
  const updatedAt = (s as any).updated_at ? formatDateTime(String((s as any).updated_at)) : null;

  return (
    <DetailShell testId="action_state.detail">
      <ObjectHeader
        testId="action_state.detail.header"
        title={s.label ? String(s.label) : t('action_state.title_fallback', { id })}
        kicker={
          <>
            <Link className="underline" to={`${basePath}/action-states`}>
              {t('nav.action_states')}
            </Link>
            {` / #${id}`}
          </>
        }
        badges={<Badge variant={badge.variant}>{badge.label}</Badge>}
        meta={
          <>
            {createdAt ? <span>{t('tasks.meta.created', { time: createdAt })}</span> : null}
            {createdAt && updatedAt ? <span> · </span> : null}
            {updatedAt ? <span>{t('tasks.meta.updated', { time: updatedAt })}</span> : null}
            <span className="ml-2 text-faint">· {t('tasks.meta.auto_refreshing')}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => q.refetch()} testId="action_state.detail.refresh">
              {t('common.refresh')}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => chrome.togglePinnedActionState(id)}
              title={pinLabel}
              ariaLabel={pinLabel}
              testId="action_state.detail.pin"
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </Button>

            {tracked ? (
              <Button variant="secondary" onClick={() => chrome.dismissActionState(id)} testId="action_state.detail.dismiss">
                {t('tasks.action.dismiss')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => chrome.trackActionState(id)} testId="action_state.detail.track">
                {t('tasks.action.track')}
              </Button>
            )}

            <Button variant="secondary" onClick={() => chrome.openTasks()} testId="action_state.detail.open_tasks">
              {t('common.open_tasks')}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader
          title={t('common.details')}
          subtitle={
            relatedChainId ? (
              <>
                {t('action_state.field.transaction_chain')}: {' '}
                <Link className="underline" to={`${basePath}/transactions/${relatedChainId}`}>
                  #{relatedChainId}
                </Link>
              </>
            ) : undefined
          }
        />
        <CardBody>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted">{t('common.id')}:</span> <span className="font-medium">#{id}</span>
            </div>
            <div>
              <span className="text-muted">{t('action_state.field.can_cancel')}:</span>{' '}
              {Boolean((s as any).can_cancel) ? t('common.yes') : t('common.no')}
            </div>
            {createdAt ? (
              <div>
                <span className="text-muted">{t('common.created')}:</span> {createdAt}
              </div>
            ) : null}
            {updatedAt ? (
              <div>
                <span className="text-muted">{t('common.updated')}:</span> {updatedAt}
              </div>
            ) : null}
            {pLabel ? (
              <div className="sm:col-span-2">
                <span className="text-muted">{t('common.progress')}:</span> {pLabel}
              </div>
            ) : null}
          </div>

          {pct !== null ? (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-surface-2">
                <div className="h-2 rounded-full bg-fg/60" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-faint">{pct}%</div>
            </div>
          ) : null}

          {Boolean((s as any).can_cancel) && !isFinishedActionState(s) ? (
            <div className="pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  setCancelError(null);
                  setConfirmCancel(true);
                }}
                loading={cancelM.isPending}
                testId="action_state.detail.cancel"
              >
                {t('tasks.action.cancel')}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <ConfirmDialog
        testId="tasks.cancel_dialog"
        open={confirmCancel}
        title={t('tasks.cancel_dialog.title')}
        description={s.label ? String(s.label) : t('tasks.cancel_dialog.description_default')}
        danger
        confirmLabel={t('tasks.cancel_dialog.confirm')}
        confirmLoading={cancelM.isPending}
        onCancel={() => {
          setConfirmCancel(false);
          setCancelError(null);
        }}
        onConfirm={() => cancelM.mutate()}
      >
        {cancelError ? (
          <Alert variant="danger" title={t('tasks.cancel_dialog.failed_title')}>
            {cancelError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </DetailShell>
  );
}

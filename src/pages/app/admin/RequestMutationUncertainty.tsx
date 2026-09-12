import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { fetchChangeRequest, fetchRegistrationRequest } from '../../../lib/api/requests';
import type { LocalLock } from '../../../lib/localLocks';
import type { ObjectRef } from '../../../lib/objectRef';
import { isResolvedRequestReviewState, requestMatchesReviewTarget } from './RequestDetailModel';
import type { RequestReviewType } from './RequestReviewTypes';

export function RequestMutationUncertainty(props: {
  requestRef: ObjectRef;
  lock: LocalLock;
  reqType: RequestReviewType;
  reqId: number;
  onResolved?: () => void | Promise<void>;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();
  const [tasksReviewed, setTasksReviewed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    setTasksReviewed(false);
    setChecking(false);
    setConfirmOpen(false);
    setCheckFailed(false);
  }, [props.lock.uncertaintyId, props.reqId]);

  const clearExactLock = () => {
    chrome.acknowledgeUncertainLocalLock(props.requestRef, props.lock.uncertaintyId);
    void qc.invalidateQueries({ queryKey: ['user_request'] });
  };

  const checkState = async () => {
    if (!tasksReviewed || checking) return;
    setChecking(true);
    setCheckFailed(false);
    try {
      const loaded = props.reqType === 'registration'
        ? (await fetchRegistrationRequest(props.reqId)).data
        : (await fetchChangeRequest(props.reqId)).data;
      if (!requestMatchesReviewTarget(loaded, props.reqType, props.reqId)) {
        throw new Error('request target mismatch');
      }

      const state = String(loaded.state ?? '').trim();
      if (isResolvedRequestReviewState(state)) {
        clearExactLock();
        toasts.pushToast({ variant: 'ok', title: t('requests.resolve.uncertain.resolved') });
        await props.onResolved?.();
      } else if (state === 'awaiting') {
        setConfirmOpen(true);
      } else {
        throw new Error('unknown request state');
      }
    } catch {
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Alert
        variant="warn"
        title={t('requests.resolve.uncertain.title')}
        testId={`${props.testIdPrefix}.uncertain`}
      >
        <div>{t('requests.resolve.uncertain.body')}</div>
        {checkFailed ? (
          <div className="mt-2 text-danger" data-testid={`${props.testIdPrefix}.uncertain.error`}>
            {t('requests.resolve.uncertain.check_failed')}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setTasksReviewed(true);
              chrome.openTasks();
            }}
            testId={`${props.testIdPrefix}.uncertain.open_tasks`}
          >
            {t('common.open_tasks')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!tasksReviewed || checking}
            loading={checking}
            onClick={() => void checkState()}
            testId={`${props.testIdPrefix}.uncertain.check`}
          >
            {t('requests.resolve.uncertain.check')}
          </Button>
        </div>
      </Alert>

      <ConfirmDialog
        open={confirmOpen}
        title={t('requests.resolve.uncertain.confirm.title')}
        description={t('requests.resolve.uncertain.confirm.body')}
        confirmLabel={t('requests.resolve.uncertain.confirm.clear')}
        confirmVariant="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          clearExactLock();
          setConfirmOpen(false);
        }}
        testId={`${props.testIdPrefix}.uncertain.confirm`}
      />
    </>
  );
}

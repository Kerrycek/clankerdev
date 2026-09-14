import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useChrome } from '../../../components/layout/ChromeContext';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { getMetaActionStateId, isAmbiguousMutationError } from '../../../lib/api/haveapi';
import { isLocalLockPersistenceError, type LocalMutationGeneration } from '../../../lib/localLocks';
import { objectRef, objectRefKey } from '../../../lib/objectRef';
import type { ResolveUserRequestAction } from '../../../lib/api/requests';

import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { LinkButton } from '../../../components/ui/LinkButton';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { RequestApproveOptions } from './RequestApproveOptions';
import { RequestResolveReview } from './RequestResolveReview';
import { RequestResolveOverridesForm } from './RequestResolveOverridesForm';
import { RequestMutationUncertainty } from './RequestMutationUncertainty';
import {
  fetchAwaitingReviewTarget,
  invalidNumericResolveOverrideKeys,
  RequestReviewPreconditionError,
  resolveReviewedRequest,
  type TouchedRequestOverrides,
} from './RequestResolveMutation';
import { useRequestResolveResources } from './RequestResolveResources';
import type { RequestResolveOverrides, RequestReviewType, ReviewableRequest } from './RequestReviewTypes';
import {
  emptyRequestOverrides,
  requestActionNeedsReason,
  requestActionVariant,
  requestMissingRequiredUser,
  requestOperationalLinks,
  requestOverrides,
  requestReviewActions,
  resourceId,
  safePositiveInteger,
} from './RequestReviewModel';

export type { RequestReviewType, ReviewableRequest } from './RequestReviewTypes';
export {
  firstResourceId,
  requestOperationalLinks,
  requestReviewActions,
  resourceId,
} from './RequestReviewModel';

export function RequestOperationalLinks(props: {
  request: ReviewableRequest | undefined;
  basePath: string;
  compact?: boolean;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const { actionStateId, transactionChainId, transactionId } = requestOperationalLinks(props.request);
  if (!actionStateId && !transactionChainId && !transactionId) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid={`${props.testIdPrefix}.ops`}>
      {actionStateId ? (
        <LinkButton
          to={`${props.basePath}/action-states/${actionStateId}`}
          variant="secondary"
          size={props.compact ? 'sm' : undefined}
          testId={`${props.testIdPrefix}.ops.action_state`}
        >
          {t('common.action_state')} #{actionStateId}
        </LinkButton>
      ) : null}
      {transactionChainId ? (
        <LinkButton
          to={`${props.basePath}/transactions/${transactionChainId}`}
          variant="secondary"
          size={props.compact ? 'sm' : undefined}
          testId={`${props.testIdPrefix}.ops.chain`}
        >
          {t('common.open_chain')}
        </LinkButton>
      ) : null}
      {transactionId ? (
        <LinkButton
          to={`${props.basePath}/transactions/items/${transactionId}`}
          variant="secondary"
          size={props.compact ? 'sm' : undefined}
          testId={`${props.testIdPrefix}.ops.transaction`}
        >
          {t('common.open_transaction')}
        </LinkButton>
      ) : null}
    </div>
  );
}

export function RequestReviewActions(props: {
  request: ReviewableRequest;
  reqType: RequestReviewType;
  reqId: number;
  isAdmin: boolean;
  basePath: string;
  testIdPrefix: string;
  compact?: boolean;
  showDetailLink?: boolean;
  onResolved?: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();
  const requestRef = useMemo(() => objectRef('UserRequest', props.reqId), [props.reqId]);
  const requestLock = chrome.localLocks.find((lock) => lock.key === objectRefKey(requestRef));

  const actions = useMemo(
    () => requestReviewActions(props.reqType, props.request, props.isAdmin),
    [props.isAdmin, props.reqType, props.request],
  );
  const ownerMissing = requestMissingRequiredUser(props.reqType, props.request);
  const historicalUserId = safePositiveInteger(String(props.request.raw_user_id ?? ''));
  const [resolveOpen, setResolveOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<ResolveUserRequestAction>('approve');
  const [resolveReason, setResolveReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [overrides, setOverrides] = useState<RequestResolveOverrides>(() => emptyRequestOverrides());
  const [touchedOverrides, setTouchedOverrides] = useState<TouchedRequestOverrides>(() => new Set());

  const [approveCreateVps, setApproveCreateVps] = useState(true);
  const [approveActivate, setApproveActivate] = useState(true);
  const [approveNode, setApproveNode] = useState('');
  const requestLocationId = resourceId(props.request.location) ?? undefined;
  const showOverrides = resolveAction === 'approve' || resolveAction === 'request_correction';
  const overrideLocationId = safePositiveInteger(overrides.location);
  const effectiveLocationId = overrideLocationId ?? requestLocationId;
  const overrideTemplateId = safePositiveInteger(overrides.osTemplate);
  const requestTemplateId = resourceId(props.request.os_template) ?? undefined;
  const effectiveTemplateId = overrideTemplateId ?? requestTemplateId;

  const resources = useRequestResolveResources({
    resolveOpen,
    overridesOpen,
    reqType: props.reqType,
    resolveAction,
    approveCreateVps,
    effectiveLocationId,
    effectiveTemplateId,
    request: props.request,
  });
  const requiresReason = requestActionNeedsReason(resolveAction);
  const reasonMissing = requiresReason && !resolveReason.trim();
  const invalidNumericOverrides = invalidNumericResolveOverrideKeys(resolveAction, overrides, touchedOverrides);
  const invalidNumericOverride = invalidNumericOverrides.size > 0;
  const actionStillAllowed = props.isAdmin && actions.includes(resolveAction);
  const canSubmit = !submitting && !requestLock && actionStillAllowed && !reasonMissing && !invalidNumericOverride;

  useEffect(() => {
    if (!resolveOpen || submitting || actionStillAllowed) return;
    setResolveOpen(false);
  }, [actionStillAllowed, resolveOpen, submitting]);

  useEffect(() => {
    if (!approveNode || resources.nodes.some((node) => String(node.id) === approveNode)) return;
    setApproveNode('');
  }, [approveNode, resources.nodes]);

  function openAction(action: ResolveUserRequestAction) {
    setResolveAction(action);
    setResolveReason('');
    setOverridesOpen(false);
    setApproveCreateVps(true);
    setApproveActivate(true);
    setApproveNode('');
    setTouchedOverrides(new Set());
    setOverrides(
      action === 'approve' || action === 'request_correction'
        ? requestOverrides(props.reqType, props.request)
        : emptyRequestOverrides(),
    );

    setResolveOpen(true);
  }

  async function submitResolveAction(
    action: ResolveUserRequestAction,
    options: {
      reason: string | undefined;
      overrides: RequestResolveOverrides;
      touchedOverrides: TouchedRequestOverrides;
      approveCreateVps: boolean;
      approveActivate: boolean;
      approveNode: string;
    }
  ) {
    setSubmitting(true);
    let mutationGeneration: LocalMutationGeneration | undefined;
    let mutationStarted = false;
    let settleError: unknown;

    try {
      await fetchAwaitingReviewTarget(props.reqType, props.reqId);
      mutationGeneration = await chrome.acquireLocalLock(requestRef, { durable: true });
      mutationStarted = true;
      const res = await resolveReviewedRequest(props.reqType, props.reqId, action, options);
      const asId = getMetaActionStateId(res.meta);
      if (asId) chrome.trackActionState(asId, {
        object: requestRef,
        mutationGeneration,
        objectLabel: `#${props.reqId}`,
      });

      toasts.pushToast({
        variant: 'ok',
        title: t('requests.resolve.toast.title'),
        body: t('requests.resolve.toast.message'),
      });

      setResolveOpen(false);
      void qc.invalidateQueries({ queryKey: ['user_request'] });
      await props.onResolved?.();
    } catch (e: unknown) {
      settleError = e;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof RequestReviewPreconditionError) {
        setResolveOpen(false);
        void qc.invalidateQueries({ queryKey: ['user_request'] });
        toasts.pushToast({
          variant: 'warn',
          title: t('requests.resolve.toast.stale.title'),
          body: t('requests.resolve.toast.stale.body'),
          autoDismissMs: false,
        });
      } else if (mutationStarted && isAmbiguousMutationError(e)) {
        setResolveOpen(false);
        void qc.invalidateQueries({ queryKey: ['user_request'] });
        toasts.pushToast({
          variant: 'warn',
          title: t('requests.resolve.toast.uncertain.title'),
          body: t('requests.resolve.toast.uncertain.body'),
          autoDismissMs: false,
        });
      } else if (isLocalLockPersistenceError(e)) {
        setResolveOpen(false);
        toasts.pushToast({
          variant: 'warn',
          title: t('requests.resolve.toast.blocked.title'),
          body: message,
          autoDismissMs: false,
        });
      } else {
        toasts.pushToast({
          variant: 'danger',
          title: t('requests.resolve.toast.error.title'),
          body: message,
          autoDismissMs: false,
        });
      }
    } finally {
      if (mutationGeneration) chrome.settleLocalLock(requestRef, settleError, mutationGeneration);
      setSubmitting(false);
    }
  }

  async function submitResolve() {
    if (!canSubmit) return;

    await submitResolveAction(resolveAction, {
      reason: resolveReason.trim() || undefined,
      overrides,
      touchedOverrides,
      approveCreateVps,
      approveActivate,
      approveNode,
    });
  }

  if (requestLock?.uncertain && !submitting) {
    return (
      <RequestMutationUncertainty
        requestRef={requestRef}
        lock={requestLock}
        reqType={props.reqType}
        reqId={props.reqId}
        onResolved={props.onResolved}
        testIdPrefix={props.testIdPrefix}
      />
    );
  }

  if (requestLock && !submitting) {
    return (
      <Alert variant="info" title={t('requests.resolve.in_progress.title')} testId={`${props.testIdPrefix}.in_progress`}>
        <div>{t('requests.resolve.in_progress.body')}</div>
        <Button className="mt-3" size="sm" variant="secondary" onClick={() => chrome.openTasks()}>
          {t('common.open_tasks')}
        </Button>
      </Alert>
    );
  }

  if (props.isAdmin && ownerMissing) {
    return (
      <Alert variant="warn" title={t('requests.resolve.owner_missing.title')} testId={`${props.testIdPrefix}.owner_missing`}>
        {historicalUserId
          ? t('requests.resolve.owner_missing.body', { id: `#${historicalUserId}` })
          : t('requests.resolve.owner_missing.body_unknown')}
      </Alert>
    );
  }

  if (!actions.length) {
    return props.isAdmin ? (
      <div className="text-sm text-muted" data-testid={`${props.testIdPrefix}.actions.none`}>
        {t('requests.resolve.unavailable')}
      </div>
    ) : null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid={`${props.testIdPrefix}.actions`}>
        {actions.map((action) => (
          <Button
            key={action}
            variant={requestActionVariant(action)}
            size={props.compact ? 'sm' : undefined}
            onClick={() => openAction(action)}
            disabled={submitting}
            testId={`${props.testIdPrefix}.action.${action}`}
          >
            {t(`requests.resolve.action.${action}`)}
          </Button>
        ))}
        {props.showDetailLink ? (
          <Link className="text-sm text-accent hover:underline" to={`${props.basePath}/requests/${props.reqType}/${props.reqId}`}>
            {t('requests.detail.open_full')}
          </Link>
        ) : null}
      </div>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title={t(`requests.resolve.modal.title.${resolveAction}`)}
        size="lg"
        mobileFullScreen
        testId={`${props.testIdPrefix}.modal`}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setResolveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant={requestActionVariant(resolveAction)}
              onClick={submitResolve}
              loading={submitting}
              disabled={!canSubmit}
              testId={`${props.testIdPrefix}.submit`}
            >
              {t(`requests.resolve.modal.submit.${resolveAction}`)}
            </Button>
          </div>
        }
      >
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          {t(`requests.resolve.modal.description.${resolveAction}`)}
        </div>

        <div className="mt-4">
          <Textarea
            value={resolveReason}
            onChange={(e) => setResolveReason(e.target.value)}
            rows={3}
            maxLength={500}
            label={requiresReason ? t('requests.resolve.reason.required') : t('requests.resolve.reason.optional')}
            ariaInvalid={reasonMissing}
            ariaDescribedBy={reasonMissing ? `${props.testIdPrefix}.reason.error` : undefined}
            testId={`${props.testIdPrefix}.reason`}
          />
          {reasonMissing ? (
            <div id={`${props.testIdPrefix}.reason.error`} className="mt-1 text-xs text-danger">
              {t('requests.resolve.reason_required')}
            </div>
          ) : null}
        </div>

        {props.reqType === 'registration' && resolveAction === 'approve' ? (
          <RequestApproveOptions
            createVps={approveCreateVps}
            activate={approveActivate}
            node={approveNode}
            nodes={resources.nodes}
            nodesLoading={resources.nodeResourcesLoading}
            nodesError={resources.nodeResourcesError}
            onCreateVpsChange={(value) => {
              setApproveCreateVps(value);
              if (!value) setApproveNode('');
            }}
            onActivateChange={setApproveActivate}
            onNodeChange={setApproveNode}
            onRetryNodes={resources.retryNodeResources}
            testIdPrefix={props.testIdPrefix}
          />
        ) : null}

        {showOverrides ? (
          <RequestResolveOverridesForm
            open={overridesOpen}
            onToggle={setOverridesOpen}
            reqType={props.reqType}
            values={overrides}
            onChange={(key, value) => {
              setOverrides((current) => ({ ...current, [key]: value }));
              setTouchedOverrides((current) => new Set(current).add(key));
              if (key === 'location' || key === 'osTemplate') setApproveNode('');
            }}
            locations={resources.locations}
            templates={resources.templates}
            languages={resources.languages}
            invalidNumericKeys={invalidNumericOverrides}
            resourcesLoading={resources.overrideResourcesLoading}
            resourcesError={resources.overrideResourcesError}
            onRetryResources={resources.retryOverrideResources}
            testIdPrefix={props.testIdPrefix}
          />
        ) : null}
        {invalidNumericOverride ? (
          <div
            id={`${props.testIdPrefix}.override.numeric.error`}
            className="mt-2 text-sm text-danger"
            data-testid={`${props.testIdPrefix}.override.numeric.error`}
          >
            {t('requests.resolve.override.invalid_id')}
          </div>
        ) : null}

        <RequestResolveReview
          request={props.request}
          reqType={props.reqType}
          reqId={props.reqId}
          action={resolveAction}
          reason={resolveReason}
          requiresReason={requiresReason}
          approveCreateVps={approveCreateVps}
          approveActivate={approveActivate}
          approveNode={approveNode}
          overrides={overrides}
          touchedOverrides={touchedOverrides}
          testIdPrefix={props.testIdPrefix}
        />
      </Modal>
    </>
  );
}

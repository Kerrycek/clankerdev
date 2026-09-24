import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import {
  fetchChangeRequest,
  fetchRegistrationRequest,
  type ChangeRequest,
  type RegistrationRequest,
} from '../../../lib/api/requests';
import { fetchUser, type User } from '../../../lib/api/users';
import { formatDateTime } from '../../../lib/format';
import {
  fraudRiskBadge,
  requestStateBadgeVariant,
  requestStateLabelKey,
  requestTypeLabelKey,
} from '../../../lib/requestsBadges';
import { dotVariantFromBadgeVariant } from '../../../lib/variantMap';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusDot } from '../../../components/ui/StatusDot';
import { RequestAddressMapLink } from './RequestAddressMapLink';
import {
  isDefinitiveRequestNotFound,
  parseRequestReviewQueue,
  requestMatchesReviewTarget,
  requestResourceLabel,
  safeRequestsReturnTo,
} from './RequestDetailModel';
import { RequestFraudChecks, RequestFraudSummary } from './RequestFraudChecks';
import {
  RequestOperationalLinks,
  RequestReviewActions,
  requestOperationalLinks,
} from './RequestReviewActions';
import { fetchAwaitingReviewTarget, RequestReviewPreconditionError } from './RequestResolveMutation';
import { requestLinkedUserId, requestMissingRequiredUser, safePositiveInteger } from './RequestReviewModel';

class RequestTypeMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTypeMismatchError';
  }
}

function userLabel(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'object') {
    const user = value as Record<string, unknown>;
    if (typeof user['login'] === 'string' && user['login']) return user['login'];
    if (typeof user['label'] === 'string' && user['label']) return user['label'];
    if (typeof user['id'] === 'number' || typeof user['id'] === 'string') return `#${user['id']}`;
  }
  return String(value);
}

function stringValue(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function DetailField(props: { label: React.ReactNode; value: unknown; wide?: boolean; testId?: string }) {
  return (
    <div className={props.wide ? 'md:col-span-2' : undefined} data-testid={props.testId}>
      <dt className="text-xs text-muted">{props.label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{stringValue(props.value)}</dd>
    </div>
  );
}

function RegistrationDetails(props: { request: RegistrationRequest }) {
  const { t } = useI18n();
  const request = props.request;

  return (
    <dl className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="admin.requests.detail.registration.fields">
      <DetailField label={t('requests.field.login')} value={request.login} />
      <DetailField label={t('requests.field.full_name')} value={request.full_name} />
      <DetailField label={t('requests.field.org')} value={request.org_name} />
      <DetailField label={t('requests.detail.org_id')} value={request.org_id} />
      <DetailField label={t('requests.field.email')} value={request.email} />
      <DetailField label={t('requests.field.year_of_birth')} value={request.year_of_birth} />
      <div className="md:col-span-2">
        <dt className="text-xs text-muted">{t('requests.field.address')}</dt>
        <dd className="mt-1">
          <RequestAddressMapLink
            address={request.address}
            testId="admin.requests.detail.registration.address.map"
          />
        </dd>
      </div>
      <DetailField label={t('requests.field.how')} value={request.how} />
      <DetailField label={t('requests.field.note')} value={request.note} />
      <DetailField label={t('requests.field.os_template')} value={requestResourceLabel(request.os_template)} />
      <DetailField label={t('requests.field.location')} value={requestResourceLabel(request.location)} />
      <DetailField label={t('requests.field.currency')} value={request.currency?.toUpperCase()} />
      <DetailField label={t('requests.field.language')} value={requestResourceLabel(request.language)} />
      <DetailField label={t('requests.field.time_zone')} value={request.time_zone} wide />
    </dl>
  );
}

function embeddedUser(request: ChangeRequest): Partial<User> | undefined {
  if (!request.user || typeof request.user !== 'object') return undefined;
  return request.user as Partial<User>;
}

function ChangeDetails(props: {
  request: ChangeRequest;
  currentUser?: User;
  currentLoading: boolean;
  currentUnavailable: boolean;
  ownerMissing: boolean;
}) {
  const { t } = useI18n();
  const current = props.currentUser ?? embeddedUser(props.request);
  const rows = [
    { key: 'full_name', label: t('requests.field.full_name'), current: current?.full_name, requested: props.request.full_name },
    { key: 'email', label: t('requests.field.email'), current: current?.email, requested: props.request.email },
    { key: 'address', label: t('requests.field.address'), current: current?.address, requested: props.request.address },
  ];

  const currentValue = (value: unknown) => {
    if (props.currentLoading) return t('common.loading');
    if (value == null && props.currentUnavailable) return t('requests.detail.change.current_unavailable');
    if (value == null || value === '') return t('requests.detail.change.empty_value');
    return String(value);
  };

  const requestedValue = (key: string, value: unknown) => {
    if (!Object.prototype.hasOwnProperty.call(props.request, key) || value == null) {
      return { text: t('requests.detail.change.no_change'), className: 'text-muted' };
    }
    if (value === '') {
      return { text: t('requests.detail.change.clear_value'), className: 'text-danger' };
    }
    return { text: String(value), className: 'font-medium' };
  };

  return (
    <div className="space-y-4" data-testid="admin.requests.detail.change.comparison">
      {props.currentUnavailable && !props.ownerMissing ? (
        <Alert variant="warn" testId="admin.requests.detail.change.current_fallback">
          {t('requests.detail.change.fallback')}
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t('requests.detail.change.field')}</th>
              <th className="px-3 py-2 font-medium">{t('requests.detail.change.current')}</th>
              <th className="px-3 py-2 font-medium">{t('requests.detail.change.requested')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              (() => {
                const requested = requestedValue(row.key, row.requested);
                return (
                  <tr key={row.key} data-testid={`admin.requests.detail.change.${row.key}`}>
                    <th className="px-3 py-3 text-left align-top font-medium">{row.label}</th>
                    <td
                      className="max-w-xs whitespace-pre-wrap break-words px-3 py-3 align-top text-muted"
                      data-testid={`admin.requests.detail.change.${row.key}.current`}
                    >
                      {currentValue(row.current)}
                    </td>
                    <td
                      className={`max-w-xs whitespace-pre-wrap break-words px-3 py-3 align-top ${requested.className}`}
                      data-testid={`admin.requests.detail.change.${row.key}.requested`}
                    >
                      {requested.text}
                    </td>
                  </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>

      <dl>
        <DetailField label={t('requests.field.change_reason')} value={props.request.change_reason} wide />
      </dl>
    </div>
  );
}

export function RequestDetailPage() {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const isAdmin = mode === 'admin' && auth.role === 'admin';
  const canResolve = isAdmin;
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const typeParam = String(params['type'] ?? '').trim();
  const reqType = typeParam === 'registration' || typeParam === 'change' ? typeParam : null;
  const reqId = safePositiveInteger(params['requestId']);
  const locationState = location.state && typeof location.state === 'object'
    ? location.state as Record<string, unknown>
    : undefined;
  const reviewQueue = useMemo(
    () => parseRequestReviewQueue(locationState?.['reviewQueue']),
    [locationState],
  );
  const reviewQueueActive = locationState?.['reviewQueueActive'] === true;
  const [continueReviewQueue, setContinueReviewQueue] = useState(reviewQueueActive);
  const queryReturnTo = new URLSearchParams(location.search).get('returnTo');
  const returnTo = safeRequestsReturnTo(locationState?.['returnTo'] ?? queryReturnTo, basePath);

  useEffect(() => {
    setContinueReviewQueue(reviewQueueActive);
  }, [reqId, reviewQueueActive]);

  async function afterResolved() {
    if (!continueReviewQueue) {
      navigate(returnTo, { replace: true });
      return;
    }

    for (const [index, target] of reviewQueue.entries()) {
      try {
        await fetchAwaitingReviewTarget(target.type, target.id);
      } catch (error: unknown) {
        if (error instanceof RequestReviewPreconditionError) continue;
        // A transient preflight failure should not silently discard the queue.
        // Open the target and let its retryable detail state explain the problem.
      }

      const detailParams = new URLSearchParams({ returnTo });
      navigate(`${basePath}/requests/${target.type}/${target.id}?${detailParams.toString()}`, {
        replace: true,
        state: {
          returnTo,
          reviewQueueActive: true,
          reviewQueue: reviewQueue.slice(index + 1),
        },
      });
      return;
    }

    navigate(returnTo, { replace: true });
  }

  const requestQ = useQuery({
    queryKey: ['user_request', reqType, 'show', reqId],
    enabled: Boolean(isAdmin && reqType && reqId),
    retry: false,
    queryFn: async () => {
      if (!reqType || !reqId) throw new Error('invalid request');
      const loaded = reqType === 'registration'
        ? (await fetchRegistrationRequest(reqId)).data
        : (await fetchChangeRequest(reqId)).data;
      if (!requestMatchesReviewTarget(loaded, reqType, reqId)) {
        throw new RequestTypeMismatchError(t('requests.detail.type_mismatch'));
      }
      return loaded;
    },
  });

  const request = requestQ.data as RegistrationRequest | ChangeRequest | undefined;
  const requestUserId = requestLinkedUserId(request);
  const changeUserId = reqType === 'change' ? requestUserId : null;
  const historicalUserId = safePositiveInteger(String(request?.raw_user_id ?? ''));
  const currentUserQ = useQuery({
    queryKey: ['users', 'show', changeUserId, 'request-comparison'],
    enabled: Boolean(isAdmin && reqType === 'change' && request && changeUserId),
    queryFn: async () => (await fetchUser(changeUserId as number)).data,
    retry: false,
  });

  const state = String(request?.state ?? '').trim();
  const stateVariant = requestStateBadgeVariant(state);
  const dotVariant = dotVariantFromBadgeVariant(stateVariant);
  const risk = useMemo(() => {
    if (!request || reqType !== 'registration') return null;
    return fraudRiskBadge(request as RegistrationRequest);
  }, [reqType, request]);
  const { actionStateId, transactionChainId, transactionId } = requestOperationalLinks(request);
  const hasOperationalLinks = Boolean(actionStateId || transactionChainId || transactionId);

  if (!reqType || !reqId) {
    return (
      <ListShell>
        <ErrorState
          testId="admin.requests.detail.invalid"
          title={t('requests.detail.invalid')}
          body={t('requests.detail.invalid.body')}
          showDetails={false}
          actions={{
            primary: { label: t('common.back'), to: returnTo },
          }}
        />
      </ListShell>
    );
  }

  if (!isAdmin) return <Navigate to="/app" replace />;
  if (requestQ.isLoading || (requestQ.isFetching && !requestQ.data)) {
    return <ListShell><LoadingState /></ListShell>;
  }

  if (requestQ.isError) {
    const mismatch = requestQ.error instanceof RequestTypeMismatchError;
    const notFound = isDefinitiveRequestNotFound(requestQ.error);
    return (
      <ListShell>
        {mismatch || notFound ? (
          <ErrorState
            testId={mismatch ? 'admin.requests.detail.mismatch' : 'admin.requests.detail.not_found'}
            kindOverride="not_found"
            title={mismatch ? t('requests.detail.type_mismatch') : t('requests.detail.load_error.title')}
            body={mismatch ? undefined : t('requests.detail.not_found')}
            error={requestQ.error}
            actions={{
              primary: { label: t('common.back'), to: returnTo },
            }}
          />
        ) : (
          <ErrorState
            testId="admin.requests.detail.error"
            title={t('requests.detail.load_error.title')}
            error={requestQ.error}
            onRetry={() => void requestQ.refetch()}
            backTo={returnTo}
          />
        )}
      </ListShell>
    );
  }

  if (!request) {
    return (
      <ListShell>
        <ErrorState
          testId="admin.requests.detail.not_found"
          kindOverride="not_found"
          title={t('requests.detail.load_error.title')}
          body={t('requests.detail.not_found')}
          showDetails={false}
          actions={{
            primary: { label: t('common.back'), to: returnTo },
          }}
        />
      </ListShell>
    );
  }

  return (
    <ListShell>
      <PageHeader
        title={`${t(requestTypeLabelKey(reqType))} #${reqId}`}
        description={(
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusDot variant={dotVariant} testId={`admin.requests.detail.${reqType}.${reqId}.dot`} />
            <Badge variant={stateVariant}>{t(requestStateLabelKey(state))}</Badge>
            {risk ? (
              <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                {t(risk.labelKey)} {risk.score}
              </Badge>
            ) : null}
          </span>
        )}
        actions={(
          <Link className="text-sm text-accent hover:underline" to={returnTo} data-testid="admin.requests.detail.back">
            {t('common.back')}
          </Link>
        )}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <aside className="min-w-0 space-y-3 lg:col-start-3 lg:row-start-1" data-testid="admin.requests.detail.review">
          {reqType === 'registration' ? <RequestFraudSummary request={request as RegistrationRequest} /> : null}
          <Card testId="admin.requests.detail.decision">
            <CardHeader title={t('requests.detail.decision.title')} subtitle={t('requests.detail.decision.subtitle')} />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusDot variant={dotVariant} />
                <Badge variant={stateVariant}>{t(requestStateLabelKey(state))}</Badge>
              </div>
              {request.admin_response ? (
                <div>
                  <div className="text-xs text-muted">{t('requests.detail.admin_response')}</div>
                  <div className="mt-1 whitespace-pre-line text-sm">{request.admin_response}</div>
                </div>
              ) : null}
              {reviewQueueActive ? (
                <div className="rounded-lg border border-border bg-surface-2 p-3" data-testid="admin.requests.review.queue">
                  <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
                    <input
                      className="mt-0.5 h-4 w-4 rounded border-border"
                      type="checkbox"
                      checked={continueReviewQueue}
                      onChange={(event) => setContinueReviewQueue(event.target.checked)}
                      data-testid="admin.requests.review.continue"
                    />
                    <span>{t('requests.review.continue')}</span>
                  </label>
                  <div className="mt-1 text-xs text-muted">
                    {t('requests.review.remaining', { count: String(reviewQueue.length + 1) })}
                  </div>
                </div>
              ) : null}
              <RequestReviewActions
                request={request}
                reqType={reqType}
                reqId={reqId}
                isAdmin={canResolve}
                basePath={basePath}
                testIdPrefix="admin.requests.resolve"
                onResolved={afterResolved}
              />
            </CardBody>
          </Card>
          {reqType === 'registration' ? <RequestFraudChecks request={request as RegistrationRequest} /> : null}
        </aside>

        <section className="space-y-3 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardHeader
              title={reqType === 'registration' ? t('requests.detail.registration.title') : t('requests.detail.change.title')}
              subtitle={reqType === 'registration' ? t('requests.detail.registration.subtitle') : t('requests.detail.change.subtitle')}
            />
            <CardBody>
              {reqType === 'registration' ? (
                <RegistrationDetails request={request as RegistrationRequest} />
              ) : (
                <ChangeDetails
                  request={request as ChangeRequest}
                  currentUser={currentUserQ.data}
                  currentLoading={currentUserQ.isLoading}
                  currentUnavailable={!changeUserId || currentUserQ.isError}
                  ownerMissing={requestMissingRequiredUser('change', request)}
                />
              )}
            </CardBody>
          </Card>

          <Card testId="admin.requests.detail.metadata">
            <details key={`${reqType}:${reqId}`} className="group" open={reqType === 'change'}>
              <summary
                className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold"
                data-testid="admin.requests.detail.metadata.toggle"
              >
                <ChevronRight
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden
                  data-testid="admin.requests.detail.metadata.chevron"
                />
                <span>
                  {t('requests.detail.metadata.title')}
                  <span className="ml-2 text-sm font-normal text-muted">{t('requests.detail.metadata.subtitle')}</span>
                </span>
              </summary>
              <CardBody className="border-t border-border">
                <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">{t('common.user')}</dt>
                    <dd className="mt-0.5 text-sm" data-testid="admin.requests.detail.metadata.user">
                      {requestUserId ? (
                        <Link className="text-accent hover:underline" to={`${basePath}/users/${requestUserId}`}>
                          {userLabel(request.user)}
                        </Link>
                      ) : historicalUserId
                        ? `${t('requests.resolve.owner_missing.label')} #${historicalUserId}`
                        : userLabel(request.user)}
                    </dd>
                  </div>
                  <DetailField label={t('requests.detail.admin')} value={userLabel(request.admin)} />
                  <DetailField label={t('common.created')} value={formatDateTime(request.created_at)} />
                  <DetailField label={t('common.updated')} value={formatDateTime(request.updated_at)} />
                  <div>
                    <dt className="text-xs text-muted">{t('requests.detail.api_ip')}</dt>
                    <dd className="mt-0.5 text-sm">{stringValue(request.api_ip_addr)}</dd>
                    {request.api_ip_ptr ? <dd className="text-xs text-muted">{request.api_ip_ptr}</dd> : null}
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t('requests.detail.client_ip')}</dt>
                    <dd className="mt-0.5 text-sm">{stringValue(request.client_ip_addr)}</dd>
                    {request.client_ip_ptr ? <dd className="text-xs text-muted">{request.client_ip_ptr}</dd> : null}
                  </div>
                </dl>
                {hasOperationalLinks ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-2 text-xs text-muted">{t('requests.detail.card.operations')}</div>
                    <RequestOperationalLinks request={request} basePath={basePath} compact testIdPrefix="admin.requests.detail" />
                  </div>
                ) : null}
              </CardBody>
            </details>
          </Card>
        </section>
      </div>
    </ListShell>
  );
}

import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';

import {
  fetchChangeRequest,
  fetchRegistrationRequest,
  type ChangeRequest,
  type RegistrationRequest,
} from '../../../lib/api/requests';

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

import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LinkButton } from '../../../components/ui/LinkButton';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusDot } from '../../../components/ui/StatusDot';
import {
  RequestOperationalLinks,
  RequestReviewActions,
  requestOperationalLinks,
} from './RequestReviewActions';

function safeNumber(value: string | undefined): number | undefined {
  const t = String(value ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

function userLabel(u: any): string {
  if (!u) return '—';
  if (typeof u.login === 'string') return u.login;
  if (typeof u.label === 'string') return u.label;
  if (typeof u.id === 'number') return `#${u.id}`;
  return String(u);
}

export function RequestDetailPage() {
  const { basePath, mode } = useAppMode();
  const isAdmin = mode === 'admin';
  const { t } = useI18n();

  const boolLabel = (v: any): string => {
    if (v === true) return t('common.yes');
    if (v === false) return t('common.no');
    return '—';
  };
  const params = useParams();
  const typeParam = String(params['type'] ?? '').trim();
  const reqType = typeParam === 'registration' || typeParam === 'change' ? typeParam : null;
  const reqId = safeNumber(params['requestId']);

  const q = useQuery({
    queryKey: ['user_request', reqType, 'show', reqId],
    enabled: Boolean(reqType && reqId),
    queryFn: async () => {
      if (!reqType || !reqId) throw new Error('invalid request');
      if (reqType === 'registration') return (await fetchRegistrationRequest(reqId)).data;
      return (await fetchChangeRequest(reqId)).data;
    },
  });

  const request = q.data as RegistrationRequest | ChangeRequest | undefined;

  const state = String(request?.state ?? '').trim();
  const stateVar = requestStateBadgeVariant(state);
  const dotVar = dotVariantFromBadgeVariant(stateVar);

  const risk = useMemo(() => {
    if (!request || reqType !== 'registration') return null;
    return fraudRiskBadge(request as any);
  }, [reqType, request]);

  const { actionStateId, transactionChainId, transactionId } = requestOperationalLinks(request);
  const hasOperationalLinks = Boolean(actionStateId || transactionChainId || transactionId);

  if (!reqType || !reqId) {
    return (
      <ListShell>
        <ErrorState title={t('requests.detail.invalid')} error={{ message: t('requests.detail.invalid.body') } as any} />
      </ListShell>
    );
  }

  if (q.isLoading) {
    return (
      <ListShell>
        <LoadingState />
      </ListShell>
    );
  }

  if (q.isError) {
    return (
      <ListShell>
        <ErrorState title={t('requests.detail.load_error.title')} error={q.error as any} />
      </ListShell>
    );
  }

  if (!request) {
    return (
      <ListShell>
        <ErrorState title={t('requests.detail.load_error.title')} error={{ message: t('requests.detail.not_found') } as any} />
      </ListShell>
    );
  }

  return (
    <ListShell>
      <PageHeader
        title={`${t(requestTypeLabelKey(reqType))} #${reqId}`}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusDot variant={dotVar} testId={`admin.requests.detail.${reqType}.${reqId}.dot`} />
            <Badge variant={stateVar}>{t(requestStateLabelKey(state))}</Badge>
            {isAdmin && risk ? (
              <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                {t(risk.labelKey)} {risk.score}
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link className="text-sm text-accent hover:underline" to={`${basePath}/requests`}>
              {t('common.back')}
            </Link>
            {isAdmin && actionStateId ? (
              <LinkButton to={`${basePath}/action-states/${actionStateId}`} variant="secondary" testId="admin.requests.detail.open_action_state">
                {t('common.action_state')} #{actionStateId}
              </LinkButton>
            ) : null}
            {isAdmin && transactionChainId ? (
              <LinkButton to={`${basePath}/transactions/${transactionChainId}`} variant="secondary" testId="admin.requests.detail.open_chain">
                {t('common.chain')} #{transactionChainId}
              </LinkButton>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('requests.detail.card.request')} />
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted">{t('common.user')}</div>
                <div className="text-sm">
                  {request.user ? (
                    isAdmin ? (
                      <Link className="text-accent hover:underline" to={`${basePath}/users/${(request.user as any).id}`}>
                        {userLabel(request.user)}
                      </Link>
                    ) : (
                      userLabel(request.user)
                    )
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted">{t('requests.detail.admin')}</div>
                <div className="text-sm">{userLabel((request as any).admin)}</div>
              </div>

              <div>
                <div className="text-xs text-muted">{t('common.created')}</div>
                <div className="text-sm">{formatDateTime((request as any).created_at)}</div>
              </div>

              <div>
                <div className="text-xs text-muted">{t('common.updated')}</div>
                <div className="text-sm">{formatDateTime((request as any).updated_at)}</div>
              </div>

              <div>
                <div className="text-xs text-muted">{t('requests.detail.api_ip')}</div>
                <div className="text-sm">{String((request as any).api_ip_addr ?? '—')}</div>
                <div className="text-xs text-muted">{String((request as any).api_ip_ptr ?? '')}</div>
              </div>

              <div>
                <div className="text-xs text-muted">{t('requests.detail.client_ip')}</div>
                <div className="text-sm">{String((request as any).client_ip_addr ?? '—')}</div>
                <div className="text-xs text-muted">{String((request as any).client_ip_ptr ?? '')}</div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {isAdmin && reqType === 'registration' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.login')}</div>
                    <div className="text-sm">{String((request as any).login ?? '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.full_name')}</div>
                    <div className="text-sm">{String((request as any).full_name ?? '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.org')}</div>
                    <div className="text-sm">
                      {String((request as any).org_name ?? '—')} {String((request as any).org_id ?? '')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.email')}</div>
                    <div className="text-sm">{String((request as any).email ?? '—')}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted">{t('requests.field.address')}</div>
                    <div className="text-sm whitespace-pre-line">{String((request as any).address ?? '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.how')}</div>
                    <div className="text-sm">{String((request as any).how ?? '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.note')}</div>
                    <div className="text-sm">{String((request as any).note ?? '—')}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.full_name')}</div>
                    <div className="text-sm">{String((request as any).full_name ?? '—')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('requests.field.email')}</div>
                    <div className="text-sm">{String((request as any).email ?? '—')}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted">{t('requests.field.address')}</div>
                    <div className="text-sm whitespace-pre-line">{String((request as any).address ?? '—')}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-muted">{t('requests.field.change_reason')}</div>
                    <div className="text-sm whitespace-pre-line">{String((request as any).change_reason ?? '—')}</div>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title={t('requests.detail.card.state')} />
            <CardBody>
              <div className="flex items-center gap-2">
                <StatusDot variant={dotVar} testId={`admin.requests.detail.${reqType}.${reqId}.dot`} />
                <Badge variant={stateVar}>{t(requestStateLabelKey(state))}</Badge>
              </div>
              {(request as any).admin_response ? (
                <div className="mt-3">
                  <div className="text-xs text-muted">{t('requests.detail.admin_response')}</div>
                  <div className="mt-1 whitespace-pre-line text-sm">{String((request as any).admin_response)}</div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {isAdmin && hasOperationalLinks ? (
            <Card testId="admin.requests.detail.ops">
              <CardHeader title={t('requests.detail.card.operations')} />
              <CardBody>
                <RequestOperationalLinks request={request} basePath={basePath} compact testIdPrefix="admin.requests.detail" />
              </CardBody>
            </Card>
          ) : null}

          {isAdmin ? (
            <Card>
              <CardHeader title={t('requests.detail.card.actions')} />
              <CardBody>
                <RequestReviewActions
                  request={request}
                  reqType={reqType}
                  reqId={reqId}
                  isAdmin={isAdmin}
                  basePath={basePath}
                  testIdPrefix="admin.requests.resolve"
                  onResolved={async () => {
                    await q.refetch();
                  }}
                />
              </CardBody>
            </Card>
          ) : null}

          {reqType === 'registration' ? (
            <>
              <div className="grid grid-cols-1 gap-3">
                <StatCard
                  title={t('requests.detail.risk.ip_fraud')}
                  value={
                    typeof (request as any).ip_fraud_score === 'number'
                      ? String((request as any).ip_fraud_score)
                      : '—'
                  }
                  description={t('requests.detail.risk.ip_flags')}
                  footer={
                    <div className="space-y-1">
                      <div>
                        {t('requests.detail.risk.ip_proxy')}: {boolLabel((request as any).ip_proxy)} / {t('requests.detail.risk.ip_vpn')}: {boolLabel((request as any).ip_vpn)} / {t('requests.detail.risk.ip_tor')}:
                        {' '}{boolLabel((request as any).ip_tor)}
                      </div>
                      <div>{t('requests.detail.risk.ip_recent_abuse')}: {boolLabel((request as any).ip_recent_abuse)}</div>
                    </div>
                  }
                  variant="compact"
                />

                <StatCard
                  title={t('requests.detail.risk.mail_fraud')}
                  value={
                    typeof (request as any).mail_fraud_score === 'number'
                      ? String((request as any).mail_fraud_score)
                      : '—'
                  }
                  description={t('requests.detail.risk.mail_flags')}
                  footer={
                    <div className="space-y-1">
                      <div>{t('requests.detail.risk.mail_valid')}: {boolLabel((request as any).mail_valid)} / {t('requests.detail.risk.mail_disposable')}: {boolLabel((request as any).mail_disposable)}</div>
                      <div>{t('requests.detail.risk.mail_deliverability')}: {String((request as any).mail_deliverability ?? '—')}</div>
                      <div>{t('requests.detail.risk.mail_leaked')}: {boolLabel((request as any).mail_leaked)} / {t('requests.detail.risk.mail_suspect')}: {boolLabel((request as any).mail_suspect)}</div>
                    </div>
                  }
                  variant="compact"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>

    </ListShell>
  );
}

import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';

import {
  fetchChangeRequest,
  fetchRegistrationRequest,
  resolveChangeRequest,
  resolveRegistrationRequest,
  type ChangeRequest,
  type RegistrationRequest,
  type ResolveUserRequestAction,
} from '../../../lib/api/requests';
import { fetchNodes, type Node } from '../../../lib/api/nodes';
import { getMetaActionStateId } from '../../../lib/api/haveapi';

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
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusDot } from '../../../components/ui/StatusDot';
import { Textarea } from '../../../components/ui/Textarea';

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
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();

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

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<ResolveUserRequestAction>('approve');
  const [resolveReason, setResolveReason] = useState('');

  // Optional overrides
  const [oLogin, setOLogin] = useState('');
  const [oFullName, setOFullName] = useState('');
  const [oOrgName, setOOrgName] = useState('');
  const [oOrgId, setOOrgId] = useState('');
  const [oEmail, setOEmail] = useState('');
  const [oAddress, setOAddress] = useState('');
  const [oChangeReason, setOChangeReason] = useState('');

  // Approve options (registration only)
  const [approveCreateVps, setApproveCreateVps] = useState(true);
  const [approveActivate, setApproveActivate] = useState(true);
  const [approveNode, setApproveNode] = useState('');

  const nodesQ = useQuery({
    queryKey: ['nodes', 'index', { limit: 200 }],
    enabled: resolveOpen && reqType === 'registration' && resolveAction === 'approve',
    queryFn: async () => (await fetchNodes({ limit: 200 })).data,
  });

  const nodes = nodesQ.data ?? [];

  const risk = useMemo(() => {
    if (!request || reqType !== 'registration') return null;
    return fraudRiskBadge(request as any);
  }, [reqType, request]);

  async function submitResolve() {
    if (!reqType || !reqId) return;

    const reason = resolveReason.trim() || undefined;

    try {
      if (reqType === 'registration') {
        const p: any = {
          action: resolveAction,
          reason,
        };

        // overrides
        if (oLogin.trim()) p.login = oLogin.trim();
        if (oFullName.trim()) p.full_name = oFullName.trim();
        if (oOrgName.trim()) p.org_name = oOrgName.trim();
        if (oOrgId.trim()) p.org_id = oOrgId.trim();
        if (oEmail.trim()) p.email = oEmail.trim();
        if (oAddress.trim()) p.address = oAddress.trim();

        if (resolveAction === 'approve') {
          p.create_vps = approveCreateVps;
          p.activate = approveActivate;
          const nodeId = safeNumber(approveNode);
          if (nodeId) p.node = nodeId;
        }

        const res = await resolveRegistrationRequest(reqId, p);
        const asId = getMetaActionStateId(res.meta);
        if (asId) chrome.trackActionState(asId);
      } else {
        const p: any = {
          action: resolveAction,
          reason,
        };

        if (oFullName.trim()) p.full_name = oFullName.trim();
        if (oEmail.trim()) p.email = oEmail.trim();
        if (oAddress.trim()) p.address = oAddress.trim();
        if (oChangeReason.trim()) p.change_reason = oChangeReason.trim();

        const res = await resolveChangeRequest(reqId, p);
        const asId = getMetaActionStateId(res.meta);
        if (asId) chrome.trackActionState(asId);
      }

      toasts.pushToast({
        variant: 'ok',
        title: t('requests.resolve.toast.title'),
        body: t('requests.resolve.toast.message'),
      });

      setResolveOpen(false);
      setResolveReason('');

      await qc.invalidateQueries({ queryKey: ['user_request'] });
      q.refetch();
    } catch (e: any) {
      toasts.pushToast({
        variant: 'danger',
        title: t('requests.resolve.toast.error.title'),
        body: e?.message ?? String(e),
      });
    }
  }

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
            {isAdmin ? (
              <Button variant="primary" onClick={() => setResolveOpen(true)} testId="admin.requests.resolve.open">
                {t('requests.resolve.button')}
              </Button>
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

      {isAdmin ? (
      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title={t('requests.resolve.modal.title')}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setResolveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submitResolve} testId="admin.requests.resolve.submit">
              {t('requests.resolve.modal.submit')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium">{t('requests.resolve.action')}</div>
            <Select value={resolveAction} onChange={(e) => setResolveAction(e.target.value as ResolveUserRequestAction)}>
              <option value="approve">{t('requests.resolve.action.approve')}</option>
              <option value="deny">{t('requests.resolve.action.deny')}</option>
              <option value="ignore">{t('requests.resolve.action.ignore')}</option>
              <option value="request_correction">{t('requests.resolve.action.request_correction')}</option>
            </Select>
          </div>

          <div>
            <div className="text-sm font-medium">{t('requests.resolve.reason')}</div>
            <Textarea value={resolveReason} onChange={(e) => setResolveReason(e.target.value)} rows={3} />
          </div>
        </div>

        {reqType === 'registration' && resolveAction === 'approve' ? (
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-sm font-medium">{t('requests.resolve.approve.options')}</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={approveCreateVps}
                  onChange={(e) => setApproveCreateVps(e.target.checked)}
                />
                {t('requests.resolve.approve.create_vps')}
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={approveActivate} onChange={(e) => setApproveActivate(e.target.checked)} />
                {t('requests.resolve.approve.activate')}
              </label>

              <div className="md:col-span-2">
                <div className="text-xs text-muted">{t('requests.resolve.approve.node')}</div>
                <Select value={approveNode} onChange={(e) => setApproveNode(e.target.value)}>
                  <option value="">{t('common.auto')}</option>
                  {nodes.map((n: Node) => (
                    <option key={n.id} value={String(n.id)}>
                      #{n.id} {n.domain_name ?? n.name ?? ''}
                    </option>
                  ))}
                </Select>
                {nodesQ.isError ? <div className="mt-1 text-xs text-danger">{t('requests.resolve.nodes_load_error')}</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-accent">{t('requests.resolve.overrides')}</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {reqType === 'registration' ? (
              <>
                <Input value={oLogin} onChange={(e) => setOLogin(e.target.value)} placeholder={t('requests.override.login')} />
                <Input value={oFullName} onChange={(e) => setOFullName(e.target.value)} placeholder={t('requests.override.full_name')} />
                <Input value={oOrgName} onChange={(e) => setOOrgName(e.target.value)} placeholder={t('requests.override.org_name')} />
                <Input value={oOrgId} onChange={(e) => setOOrgId(e.target.value)} placeholder={t('requests.override.org_id')} />
                <Input value={oEmail} onChange={(e) => setOEmail(e.target.value)} placeholder={t('requests.override.email')} />
                <Input value={oAddress} onChange={(e) => setOAddress(e.target.value)} placeholder={t('requests.override.address')} />
              </>
            ) : (
              <>
                <Input value={oFullName} onChange={(e) => setOFullName(e.target.value)} placeholder={t('requests.override.full_name')} />
                <Input value={oEmail} onChange={(e) => setOEmail(e.target.value)} placeholder={t('requests.override.email')} />
                <Input value={oAddress} onChange={(e) => setOAddress(e.target.value)} placeholder={t('requests.override.address')} />
                <Input
                  value={oChangeReason}
                  onChange={(e) => setOChangeReason(e.target.value)}
                  placeholder={t('requests.override.change_reason')}
                />
              </>
            )}
          </div>
        </details>
      </Modal>
      ) : null}
    </ListShell>
  );
}

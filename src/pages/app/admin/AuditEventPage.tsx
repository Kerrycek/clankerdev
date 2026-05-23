import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';

import { DetailShell } from '../../../components/layout/DetailShell';

import { fetchObjectHistoryEvent } from '../../../lib/api/audit';
import { formatDateTime } from '../../../lib/format';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { JsonPanel } from '../../../components/ui/JsonPanel';
import { LinkButton } from '../../../components/ui/LinkButton';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';

function parseId(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function refId(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && typeof v.id === 'number') return v.id;
  return null;
}

function refLabel(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object') {
    if (typeof v.label === 'string' && v.label.trim()) return v.label.trim();
    if (typeof v.login === 'string' && v.login.trim()) return v.login.trim();
    if (typeof v.api_ip_addr === 'string' && v.api_ip_addr.trim()) return v.api_ip_addr.trim();
  }
  return null;
}

function trackedObjectLink(basePath: string, ev: any): string | null {
  const t = typeof ev?.object === 'string' ? String(ev.object).toLowerCase() : '';
  const id = typeof ev?.object_id === 'number' ? ev.object_id : null;
  if (!t || !id) return null;

  // Best-effort mapping; avoids coupling to backend class names.
  if (t.includes('vps')) return `${basePath}/vps/${id}`;
  if (t.includes('dataset')) return `${basePath}/datasets/${id}`;
  if (t.includes('dns') && t.includes('zone')) return `${basePath}/dns/zones/${id}`;
  if (t.includes('user')) return `${basePath}/users/${id}`;
  if (t.includes('ipaddress') || t.includes('ip_address')) return `${basePath}/ip-addresses/${id}`;
  if (t.includes('transactionchain')) return `${basePath}/transactions/${id}`;
  if (t.includes('transaction')) return `${basePath}/transactions/items/${id}`;
  if (t.includes('actionstate') || t.includes('action_state')) return `${basePath}/action-states/${id}`;

  return null;
}

export function AuditEventPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const params = useParams();
  const historyId = parseId(params['historyId']);

  const q = useQuery({
    queryKey: ['object_history', 'show', historyId],
    enabled: Boolean(historyId),
    queryFn: async () => (await fetchObjectHistoryEvent(historyId as number)).data,
  });

  const ev = q.data as any;
  const createdAt = typeof ev?.created_at === 'string' ? ev.created_at : undefined;

  const userId = refId(ev?.user);
  const sessionId = refId(ev?.user_session);

  const userLabelStr = refLabel(ev?.user) ?? (userId ? `#${userId}` : t('common.na'));
  const sessionLabelStr = refLabel(ev?.user_session) ?? (sessionId ? `#${sessionId}` : t('common.na'));

  const objType = typeof ev?.object === 'string' ? String(ev.object).trim() : '';
  const objId = typeof ev?.object_id === 'number' ? ev.object_id : undefined;
  const objLabel = objType && objId ? `${objType} #${objId}` : objType ? objType : objId ? `#${objId}` : t('common.na');

  const objLink = useMemo(() => trackedObjectLink(basePath, ev), [basePath, ev]);

  const title = ev?.event_type ? String(ev.event_type) : t('audit.event.title_fallback');

  return (
    <DetailShell testId="admin.audit.detail" variant="wide">
      <ObjectHeader
        boxed
        testId="admin.audit.detail.header"
        title={title}
        kicker={
          <Link className="text-accent hover:underline" to={`${basePath}/audit`}>
            {t('audit.title')}
          </Link>
        }
        meta={historyId ? `#${historyId}` : undefined}
        titleAfter={createdAt ? <Badge variant="neutral">{formatDateTime(createdAt)}</Badge> : null}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {historyId ? <CopyButton text={String(historyId)} testId="admin.audit.detail.copy.id" /> : null}
            {objLink ? (
              <LinkButton to={objLink} variant="secondary" size="sm" testId="admin.audit.detail.open_object">
                {t('audit.event.open_object')}
              </LinkButton>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching} testId="admin.audit.detail.refresh">
              {t('common.refresh')}
            </Button>
          </div>
        }
      />

      {!historyId ? (
        <ErrorState
          testId="admin.audit.detail.invalid"
          kindOverride="not_found"
          title={t('audit.event.invalid_title')}
          body={t('audit.event.invalid_body')}
          backTo={`${basePath}/audit`}
          showStatusLink={false}
          showDetails={false}
          detailsExtra={{ page: 'admin.audit.detail', historyId: null }}
        />
      ) : q.isLoading ? (
        <LoadingState testId="admin.audit.detail.loading" />
      ) : q.isError ? (
        <ErrorState
          testId="admin.audit.detail.error"
          title={t('audit.event.load_failed')}
          error={q.error}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/audit`}
          detailsExtra={{ page: 'admin.audit.detail', historyId }}
        />
      ) : ev ? (
        <>
          <Card testId="admin.audit.detail.summary">
            <CardHeader title={t('audit.event.section.summary')} />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs text-muted">{t('common.created')}</div>
                  <div className="mt-1 text-sm tabular-nums">{createdAt ? formatDateTime(createdAt) : t('common.na')}</div>
                </div>

                <div>
                  <div className="text-xs text-muted">{t('common.user')}</div>
                  <div className="mt-1 text-sm">
                    {userId ? (
                      <Link className="text-accent hover:underline" to={`${basePath}/users/${userId}`}>
                        {userLabelStr}
                      </Link>
                    ) : (
                      <span className="text-muted">{userLabelStr}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted">{t('audit.event.session')}</div>
                  <div className="mt-1 text-sm">{sessionLabelStr}</div>
                </div>

                <div>
                  <div className="text-xs text-muted">{t('audit.event.object')}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 truncate text-sm" title={objLabel}>
                      {objLabel}
                    </div>
                    <CopyButton text={objLabel} testId="admin.audit.detail.copy.object" />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted">{t('audit.event.event_type')}</div>
                  <div className="mt-1 text-sm">{String(ev.event_type ?? t('common.na'))}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card testId="admin.audit.detail.data">
            <CardHeader title={t('audit.event.section.data')} />
            <CardBody>
              <JsonPanel
                title={t('audit.event.data')}
                value={ev.event_data}
                emptyLabel={t('audit.event.data_empty')}
                maxHeightClass="max-h-scroll-lg"
                testId="admin.audit.detail.json"
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </DetailShell>
  );
}

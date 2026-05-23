import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { DetailShell } from '../../../components/layout/DetailShell';
import { fetchIpAddress } from '../../../lib/api/ipAddresses';
import { formatDateTime } from '../../../lib/format';

import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { LinkButton } from '../../../components/ui/LinkButton';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';

function parseIdParam(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function idFromResourceRef(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    if (typeof v.id === 'number') return v.id;
    if (typeof v.id === 'string') {
      const n = Number(v.id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function IpAddressDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const params = useParams();
  const ipId = parseIdParam(params['ipAddressId']);

  const q = useQuery({
    queryKey: ['ip_addresses', ipId],
    queryFn: async () => {
      if (!ipId) throw new Error(t('admin.ip.invalid_id'));
      return (await fetchIpAddress(ipId)).data;
    },
    enabled: Boolean(ipId),
    staleTime: 30_000,
  });

  const ip = q.data ?? null;
  const isLoading = Boolean(ipId) && q.isLoading;
  const isError = Boolean(ipId) && (q.isError || !ip);

  return (
    <DetailShell testId="admin.ip_address.page">
      {!ipId ? (
        <ErrorState
          testId="admin.ip_address.invalid_id"
          kindOverride="not_found"
          title={t('admin.ip.invalid_id')}
          body={t('error.not_found.body')}
          backTo={`${basePath}/ip-addresses`}
          showStatusLink={false}
          showDetails={false}
          detailsExtra={{ page: 'admin.ip_address.detail', ipId: null }}
        />
      ) : isLoading ? (
        <LoadingState testId="admin.ip_address.loading" />
      ) : isError ? (
        <ErrorState
          testId="admin.ip_address.error"
          title={t('admin.ip.load_error')}
          error={q.error}
          onRetry={() => void q.refetch()}
          backTo={`${basePath}/ip-addresses`}
          detailsExtra={{ page: 'admin.ip_address.detail', ipId }}
        />
      ) : ip ? (
        <>
          {(() => {
            const addr = String((ip as any).addr ?? '').trim() || `#${(ip as any).id}`;
            const prefix = typeof (ip as any).prefix === 'number' ? (ip as any).prefix : undefined;
            const network = (ip as any).network;
            const networkStr =
              network && (network.address || network.id)
                ? `${network.address ?? ''}${network.prefix ? '/' + network.prefix : ''}`.trim()
                : undefined;

            const vpsId = idFromResourceRef((ip as any).vps);
            const userId = idFromResourceRef((ip as any).user);

            const title = `${addr}${prefix ? `/${prefix}` : ''}`;

            return (
              <>
                <ObjectHeader
                  testId="admin.ip_address.header"
                  title={title}
                  titleAfter={
                    <>
                      <Badge variant="neutral">#{(ip as any).id}</Badge>
                      {(ip as any).routed ? <Badge variant="black">{t('admin.ip.routed_badge')}</Badge> : null}
                    </>
                  }
                  kicker={
                    <>
                      <Link className="underline" to={`${basePath}/ip-addresses`}>
                        {t('admin.ip_addresses.title')}
                      </Link>
                      <span className="text-faint"> · </span>
                      <span>#{(ip as any).id}</span>
                    </>
                  }
                  meta={networkStr ? networkStr : ' '}
                  actions={
                    <>
                      <CopyButton text={title} />
                      {vpsId ? (
                        <LinkButton
                          to={`${basePath}/vps/${vpsId}`}
                          variant="secondary"
                          testId="admin.ip.action.vps"
                          title={t('common.open_vps')}
                        >
                          {t('object_kind.vps')} #{vpsId}
                        </LinkButton>
                      ) : null}
                      {userId ? (
                        <LinkButton
                          to={`${basePath}/users/${userId}`}
                          variant="secondary"
                          testId="admin.ip.action.user"
                          title={t('admin.ip.open_user')}
                        >
                          {t('admin.ip.open_user')} #{userId}
                        </LinkButton>
                      ) : null}
                      <Button testId="admin.ip_address.refresh" variant="secondary" onClick={() => void q.refetch()}>
                        {t('common.refresh')}
                      </Button>
                    </>
                  }
                />

                <Card testId="admin.ip_address.details.card">
                  <CardHeader title={t('common.details')} />
                  <CardBody>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-muted">{t('admin.ip.field.network')}</div>
                        <div className="text-sm">{networkStr || t('common.na')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">{t('admin.ip.field.routed')}</div>
                        <div className="text-sm">{(ip as any).routed ? t('common.yes') : t('common.no')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">{t('admin.ip.field.user_id')}</div>
                        <div className="text-sm">{userId ?? t('common.na')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">{t('admin.ip.field.vps_id')}</div>
                        <div className="text-sm">{vpsId ?? t('common.na')}</div>
                      </div>
                      {(ip as any).created_at ? (
                        <div>
                          <div className="text-xs text-muted">{t('admin.ip.field.created')}</div>
                          <div className="text-sm">{formatDateTime((ip as any).created_at)}</div>
                        </div>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              </>
            );
          })()}
        </>
      ) : null}
    </DetailShell>
  );
}

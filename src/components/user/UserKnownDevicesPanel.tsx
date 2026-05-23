import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  deleteUserKnownDevice,
  fetchUserKnownDevices,
  type UserKnownDevice,
} from '../../lib/api/userDossier';

import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { useTierCIntervalMs } from '../../lib/refreshTiers';
import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

function deviceSearchHaystack(d: UserKnownDevice): string {
  return [
    String(d.id ?? ''),
    String(d.api_ip_addr ?? ''),
    String(d.api_ip_ptr ?? ''),
    String(d.client_ip_addr ?? ''),
    String(d.client_ip_ptr ?? ''),
    String(d.user_agent ?? ''),
  ]
    .join(' ')
    .toLowerCase();
}

function uaShort(ua: string | undefined): string {
  const s = String(ua ?? '').trim();
  if (!s) return '';
  if (s.length <= 90) return s;
  return s.slice(0, 87) + '…';
}

function parseUserAgent(ua: string | undefined): { os: string; browser: string } {
  const s = String(ua ?? '').trim();
  if (!s) return { os: '—', browser: '—' };

  const m = (re: RegExp) => {
    const mm = s.match(re);
    return mm && mm[1] ? String(mm[1]) : null;
  };

  // Browser detection (order matters)
  let browser = 'Unknown';
  const edge = m(/Edg\/([0-9.]+)/);
  const opera = m(/OPR\/([0-9.]+)/);
  const firefox = m(/Firefox\/([0-9.]+)/);
  const chrome = m(/Chrome\/([0-9.]+)/);
  const safari = m(/Version\/([0-9.]+).*Safari\//);
  const curl = m(/curl\/([0-9.]+)/);
  const wget = m(/Wget\/([0-9.]+)/);

  if (edge) browser = `Edge ${edge}`;
  else if (opera) browser = `Opera ${opera}`;
  else if (firefox) browser = `Firefox ${firefox}`;
  else if (chrome && !s.includes('Edg/') && !s.includes('OPR/')) browser = `Chrome ${chrome}`;
  else if (safari && !s.includes('Chrome/') && !s.includes('Edg/') && !s.includes('OPR/')) browser = `Safari ${safari}`;
  else if (curl) browser = `curl ${curl}`;
  else if (wget) browser = `Wget ${wget}`;

  // OS detection
  let os = 'Unknown';
  const windows = m(/Windows NT ([0-9.]+)/);
  const mac = m(/Mac OS X ([0-9_]+)/);
  const android = m(/Android ([0-9.]+)/);
  const iphone = m(/iPhone OS ([0-9_]+)/);
  const ipad = m(/CPU OS ([0-9_]+)/);

  if (android) os = `Android ${android}`;
  else if (iphone) os = `iOS ${iphone.replaceAll('_', '.')}`;
  else if (ipad && s.includes('iPad')) os = `iPadOS ${ipad.replaceAll('_', '.')}`;
  else if (windows) os = `Windows NT ${windows}`;
  else if (mac) os = `macOS ${mac.replaceAll('_', '.')}`;
  else if (s.includes('Linux')) os = 'Linux';

  return { os, browser };
}

export function UserKnownDevicesPanel(props: {
  userId: number;
  /** Test id prefix, e.g. "profile.security" or "admin.user.security" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = q.trim();
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');

    // pagination params handled by useKeysetPagination
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [q, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: `${props.testIdPrefix}.known_devices.pagination`,
    filterKey: JSON.stringify({ userId: props.userId, q: q.trim() }),
    searchParams,
    setSearchParams,
    defaultLimit: 25,
    allowedLimits: [25, 50, 100],
  });

  const interval = useTierCIntervalMs();

  const devicesQ = useQuery({
    queryKey: [
      'users',
      props.userId,
      'known_devices',
      { fromId: pagination.fromId ?? null, limit: pagination.limit },
    ],
    queryFn: async () => {
      const res = await fetchUserKnownDevices(props.userId, {
        fromId: pagination.fromId ?? undefined,
        limit: pagination.limit,
      });
      return res.data;
    },
    refetchInterval: interval,
  });

  const pageCursor = useMemo(() => cursorFromDescendingPage(devicesQ.data as any), [devicesQ.data]);
  const hasMore = (devicesQ.data ?? []).length >= pagination.limit;

  const devices = useMemo(() => {
    const raw = devicesQ.data ?? [];
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return raw;
    return raw.filter((d) => deviceSearchHaystack(d).includes(trimmed));
  }, [devicesQ.data, q]);

  const [removeId, setRemoveId] = useState<number | null>(null);

  const removeM = useMutation({
    mutationFn: async (id: number) => deleteUserKnownDevice(props.userId, id),
    onSuccess: async () => {
      setRemoveId(null);
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'known_devices'] });
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.known_devices.card`}>
        <CardHeader
          title={t('profile.security.known_devices.title')}
          subtitle={t('profile.security.known_devices.subtitle')}
          actions={
            <Button
              variant="secondary"
              onClick={() => void devicesQ.refetch()}
              disabled={devicesQ.isFetching}
              testId={`${prefix}.known_devices.refresh`}
            >
              {t('common.refresh')}
            </Button>
          }
        />

        <CardBody>
          <div className="mb-3">
            <div className="text-xs font-medium text-muted">{t('common.find')}</div>
            <div className="mt-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('profile.security.known_devices.search.placeholder')}
                testId={`${prefix}.known_devices.search`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.security.known_devices.search.hint')}</div>
          </div>

          {devicesQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : devicesQ.isError ? (
            <Alert variant="danger" title={t('profile.security.known_devices.load_failed')}>
              {formatErrorMessage(devicesQ.error)}
            </Alert>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.known_devices.empty`}>
              {t('profile.security.known_devices.empty')}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {devices.map((d) => {
                  const ua = parseUserAgent(d.user_agent);

                  return (
                  <div
                    key={d.id}
                    data-testid={`${prefix}.known_devices.row.${d.id}`}
                    className="rounded-md border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">#{d.id}</div>
                        <div className="mt-1 text-xs text-muted">
                          {t('profile.security.known_devices.field.last_seen')}: {d.last_seen_at ? formatDateTime(d.last_seen_at) : '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {t('profile.security.known_devices.field.api_ip')}: {d.api_ip_addr ?? '—'}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {t('profile.security.known_devices.field.client_ip')}: {d.client_ip_addr ?? '—'}
                        </div>
                        <div className="mt-2" title={d.user_agent ?? ""}>
                          <div className="text-sm font-medium">{ua.browser}</div>
                          <div className="text-xs text-faint">{ua.os}</div>
                          {d.user_agent ? (
                            <div className="mt-1 text-xs text-muted break-words">{uaShort(d.user_agent)}</div>
                          ) : null}
                        </div>
                        {d.skip_multi_factor_auth_until ? (
                          <div className="mt-2 text-xs text-muted">
                            {t('profile.security.known_devices.field.skip_mfa_until')}: {formatDateTime(d.skip_multi_factor_auth_until)}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setRemoveId(d.id)}
                          testId={`${prefix}.known_devices.forget.${d.id}`}
                        >
                          {t('profile.security.known_devices.action.forget')}
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table minWidth="lg" testId={`${prefix}.known_devices.table`}>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('profile.security.known_devices.field.last_seen')}</th>
                      <th className="px-4 py-2">{t('profile.security.known_devices.field.api_ip')}</th>
                      <th className="px-4 py-2">{t('profile.security.known_devices.field.client_ip')}</th>
                      <th className="px-4 py-2">{t('profile.security.known_devices.field.user_agent')}</th>
                      <th className="px-4 py-2">{t('profile.security.known_devices.field.skip_mfa_until')}</th>
                      <th className="px-4 py-2 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => {
                      const ua = parseUserAgent(d.user_agent);

                      return (
                      <tr
                        key={d.id}
                        className="border-b border-border/60 last:border-b-0"
                        data-testid={`${prefix}.known_devices.row.${d.id}`}
                      >
                        <td className="px-4 py-2 text-sm tabular-nums">
                          {d.last_seen_at ? formatDateTime(d.last_seen_at) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm">
                            <div className="font-medium tabular-nums">{d.api_ip_addr ?? '—'}</div>
                            {d.api_ip_ptr ? <div className="text-xs text-faint">{d.api_ip_ptr}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm">
                            <div className="font-medium tabular-nums">{d.client_ip_addr ?? '—'}</div>
                            {d.client_ip_ptr ? <div className="text-xs text-faint">{d.client_ip_ptr}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm" title={d.user_agent ?? ""}>
                            <div className="font-medium">{ua.browser}</div>
                            <div className="text-xs text-faint">{ua.os}</div>
                            {d.user_agent ? <div className="mt-1 text-xs text-muted">{uaShort(d.user_agent)}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm tabular-nums">
                          {d.skip_multi_factor_auth_until ? formatDateTime(d.skip_multi_factor_auth_until) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setRemoveId(d.id)}
                            testId={`${prefix}.known_devices.forget.${d.id}`}
                          >
                            {t('profile.security.known_devices.action.forget')}
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>

        <KeysetPagination
          testId={`${prefix}.known_devices.pagination`}
          page={pagination.page}
          pageCount={pagination.stack.length}
          onGoToPage={(p) => pagination.goToPage(p)}
          canPrev={pagination.canPrev}
          onPrev={() => pagination.goPrev()}
          canNext={pagination.hasForward || (hasMore && pageCursor !== null)}
          onNext={() => pagination.goNext(pageCursor)}
          limit={pagination.limit}
          allowedLimits={pagination.allowedLimits}
          onLimitChange={(l) => pagination.setLimit(l)}
        />
      </Card>

      <ConfirmDialog
        open={removeId !== null}
        title={t('profile.security.known_devices.forget.title')}
        description={t('profile.security.known_devices.forget.body')}
        confirmLabel={t('profile.security.known_devices.action.forget')}
        danger
        confirmLoading={removeM.isPending}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId === null) return;
          removeM.mutate(removeId);
        }}
        testId={`${prefix}.known_devices.forget.confirm`}
      >
        {removeM.isError ? (
          <div className="mt-2">
            <Alert variant="danger">{formatErrorMessage(removeM.error)}</Alert>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

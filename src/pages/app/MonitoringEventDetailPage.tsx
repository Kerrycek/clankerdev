import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acknowledgeMonitoredEvent,
  fetchMonitoredEvent,
  fetchMonitoredEventLogs,
  ignoreMonitoredEvent,
  type MonitoredEvent,
  type MonitoredEventLog,
  type MonitoredEventLogOrder,
} from '../../lib/api/monitoring';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { formatErrorMessage } from '../../lib/errors';
import { formatDateTime, formatDurationSeconds } from '../../lib/format';
import { monitoredEventBadgeVariant, monitoredEventRowVariant, monitoredEventStateLabelKey, isMonitoredEventAckable } from '../../lib/monitoringBadges';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { cursorFromAscendingPage, cursorFromDescendingPage } from '../../lib/lockIndex';
import { useTierAIntervalMs } from '../../lib/refreshTiers';
import { dotVariantFromRowVariant } from '../../lib/variantMap';

import { PageContainer } from '../../components/layout/PageContainer';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LinkButton } from '../../components/ui/LinkButton';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { KeysetPagination } from '../../components/ui/KeysetPagination';
import { LoadingState } from '../../components/ui/LoadingState';
import { PassFailSparkline, type PassFailPoint } from '../../components/ui/PassFailSparkline';
import { Select } from '../../components/ui/Select';
import { StatusDot } from '../../components/ui/StatusDot';
import { TableCard } from '../../components/ui/TableCard';
import { TableRowLink } from '../../components/ui/TableRowLink';
import { clsx } from '../../components/ui/clsx';
import { MiniLink } from '../../components/ui/ChipLink';

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function objectLink(basePath: string, objName?: string, objId?: number): string | null {
  if (!objName || !objId) return null;
  if (objName === 'Vps') return `${basePath}/vps/${objId}`;
  if (objName === 'Node' && basePath === '/admin') return `${basePath}/nodes/${objId}`;
  return null;
}

type UntilPreset = 'forever' | '1h' | '6h' | '1d' | '1w' | 'custom';

function untilIso(preset: UntilPreset, customLocal: string): { iso?: string; valid: boolean } {
  if (preset === 'forever') return { iso: undefined, valid: true };

  const now = Date.now();
  const ms =
    preset === '1h'
      ? 60 * 60 * 1000
      : preset === '6h'
        ? 6 * 60 * 60 * 1000
        : preset === '1d'
          ? 24 * 60 * 60 * 1000
          : preset === '1w'
            ? 7 * 24 * 60 * 60 * 1000
            : 0;

  if (preset !== 'custom') {
    return { iso: new Date(now + ms).toISOString(), valid: true };
  }

  const t = customLocal.trim();
  if (!t) return { iso: undefined, valid: false };
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return { iso: undefined, valid: false };
  return { iso: d.toISOString(), valid: true };
}

function logOrderFromSearch(sp: URLSearchParams): MonitoredEventLogOrder {
  const raw = (sp.get('log_order') ?? '').trim();
  return raw === 'latest' ? 'latest' : 'oldest';
}

function logPassedFromSearch(sp: URLSearchParams): '' | '1' | '0' {
  const raw = (sp.get('log_passed') ?? '').trim();
  if (raw === '1' || raw === '0') return raw;
  return '';
}

export function MonitoringEventDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const tierARefetchMs = useTierAIntervalMs();

  const params = useParams();
  const id = parseId(params['eventId']);
  const [sp, setSp] = useSearchParams();

  const logOrder = useMemo(() => logOrderFromSearch(sp), [sp]);
  const logPassed = useMemo(() => logPassedFromSearch(sp), [sp]);

  const logPagination = useKeysetPagination({
    id: 'monitoring.event.logs',
    filterKey: JSON.stringify({ id, logOrder, logPassed, scope: basePath }),
    searchParams: sp,
    setSearchParams: setSp,
    paramPrefix: 'log_',
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const eventQ = useQuery({
    queryKey: ['monitored_events', 'show', { id }],
    queryFn: async () => (await fetchMonitoredEvent(id as number)).data,
    enabled: Boolean(id),
    refetchInterval: tierARefetchMs,
  });

  const logsQ = useQuery({
    queryKey: [
      'monitored_events',
      'logs',
      {
        id,
        limit: logPagination.limit,
        fromId: logPagination.fromId,
        order: logOrder,
        passed: logPassed,
      },
    ],
    queryFn: async () =>
      (
        await fetchMonitoredEventLogs(id as number, {
          limit: logPagination.limit,
          fromId: logPagination.fromId,
          order: logOrder,
          passed: logPassed === '' ? undefined : logPassed === '1',
        })
      ).data,
    enabled: Boolean(id),
    refetchInterval: tierARefetchMs,
  });

  const event = eventQ.data as any as MonitoredEvent | undefined;
  const stateVal = String((event as any)?.state ?? '');
  const badgeV = monitoredEventBadgeVariant(stateVal);
  const rowV = monitoredEventRowVariant(stateVal);
  const dotV = dotVariantFromRowVariant(rowV);
  const stateLabelKey = monitoredEventStateLabelKey(stateVal);
  const stateLabel = stateLabelKey ? t(stateLabelKey) : stateVal || t('common.unknown');

  const objName = (event as any)?.object_name as string | undefined;
  const objId = Number((event as any)?.object_id);
  const objLink = objectLink(basePath, objName, Number.isFinite(objId) ? objId : undefined);

  const savedUntilIso = (event as any)?.saved_until as string | null | undefined;
  const savedUntilLabel = savedUntilIso
    ? formatDateTime(savedUntilIso)
    : stateVal === 'acknowledged' || stateVal === 'ignored'
      ? t('monitoring.saved_until.forever')
      : t('common.na');

  const durationLabel =
    typeof (event as any)?.duration === 'number' && Number.isFinite((event as any).duration)
      ? formatDurationSeconds((event as any).duration)
      : t('common.na');

  const ackable = isMonitoredEventAckable(stateVal);

  const [ackOpen, setAckOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [untilPreset, setUntilPreset] = useState<UntilPreset>('1d');
  const [untilCustom, setUntilCustom] = useState('');

  const until = useMemo(() => untilIso(untilPreset, untilCustom), [untilCustom, untilPreset]);

  const ackMut = useMutation({
    mutationFn: async () =>
      await acknowledgeMonitoredEvent(id as number, {
        until: until.iso,
      }),
    onSuccess: () => {
      setAckOpen(false);
      toasts.pushToast({ variant: 'ok', title: t('monitoring.ack.success.title'), body: t('monitoring.ack.success.body') });
      void qc.invalidateQueries({ queryKey: ['monitored_events'] });
    },
    onError: (err) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('monitoring.ack.error.title'),
        body: formatErrorMessage(err),
        autoDismissMs: false,
      });
    },
  });

  const ignoreMut = useMutation({
    mutationFn: async () =>
      await ignoreMonitoredEvent(id as number, {
        until: until.iso,
      }),
    onSuccess: () => {
      setIgnoreOpen(false);
      toasts.pushToast({ variant: 'ok', title: t('monitoring.ignore.success.title'), body: t('monitoring.ignore.success.body') });
      void qc.invalidateQueries({ queryKey: ['monitored_events'] });
    },
    onError: (err) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('monitoring.ignore.error.title'),
        body: formatErrorMessage(err),
        autoDismissMs: false,
      });
    },
  });

  const logs = (logsQ.data ?? []) as any as MonitoredEventLog[];

  const logCursor = useMemo(() => {
    return logOrder === 'latest' ? cursorFromDescendingPage(logs as any) : cursorFromAscendingPage(logs as any);
  }, [logOrder, logs]);

  const canNextLogs = logs.length >= logPagination.limit;

  const sparklinePoints: PassFailPoint[] = useMemo(() => {
    // Only show when we are looking at the "recent" view (latest, first page).
    if (logOrder !== 'latest') return [];
    if (logPagination.fromId) return [];

    const pts: PassFailPoint[] = [];
    for (const l of logs) {
      const ts = (l as any).created_at ? Date.parse(String((l as any).created_at)) : NaN;
      if (!Number.isFinite(ts)) continue;
      const ok = Boolean((l as any).passed);
      const title = `${formatDateTime(String((l as any).created_at))} • ${ok ? t('monitoring.log.passed') : t('monitoring.log.failed')}`;
      pts.push({ ts: Math.floor(ts / 1000), ok, title });
    }
    return pts;
  }, [logOrder, logPagination.fromId, logs, t]);

  if (!id) {
    return (
      <PageContainer testId="monitoring.event.invalid">
        <ErrorState
          title={t('monitoring.detail.invalid_id.title')}
          body={t('monitoring.detail.invalid_id.body')}
          kindOverride="unexpected"
          showBack
          testId="monitoring.event.invalid.error"
          showDetails={false}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer testId="monitoring.event.detail">
      <PageHeader
        title={t('monitoring.detail.title', { id })}
        description={t('monitoring.detail.description')}
        testId="monitoring.event.detail.header"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {ackable ? (
              <>
                <Button
                  variant="warn"
                  size="sm"
                  onClick={() => {
                    setUntilPreset('1d');
                    setUntilCustom('');
                    setAckOpen(true);
                  }}
                  testId="monitoring.event.ack.open"
                >
                  {t('monitoring.action.acknowledge')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setUntilPreset('1w');
                    setUntilCustom('');
                    setIgnoreOpen(true);
                  }}
                  testId="monitoring.event.ignore.open"
                >
                  {t('monitoring.action.ignore')}
                </Button>
              </>
            ) : null}
            <LinkButton to={`${basePath}/monitoring`} variant="ghost" size="sm" testId="monitoring.event.back">
              {t('common.back')}
            </LinkButton>
          </div>
        }
      />

      {eventQ.isLoading ? (
        <LoadingState testId="monitoring.event.loading" />
      ) : eventQ.isError ? (
        <ErrorState
          testId="monitoring.event.error"
          title={t('monitoring.detail.load_error.title')}
          error={eventQ.error}
          onRetry={() => void eventQ.refetch()}
          showBack
          detailsExtra={{ page: 'monitoring.event.detail', id, scope: basePath }}
        />
      ) : !event ? (
        <EmptyState
          testId="monitoring.event.not_found"
          title={t('monitoring.detail.not_found.title')}
          body={t('monitoring.detail.not_found.body')}
        />
      ) : (
        <div className="space-y-6">
          <Card testId="monitoring.event.summary">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <StatusDot variant={dotV} ariaLabel={stateLabel} />
                  <span className="truncate">{(event as any).label ?? (event as any).monitor ?? t('common.unknown')}</span>
                </div>
              }
              subtitle={(event as any).issue ?? ''}
              actions={
                <Badge variant={badgeV}>
                  {stateLabel}
                </Badge>
              }
            />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted">{t('monitoring.field.monitor_name')}</div>
                  <div className="mt-1 text-sm">{(event as any).monitor ?? t('common.na')}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('monitoring.field.object')}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {objName ? `${objName} #${Number.isFinite(objId) ? objId : '?'}` : t('common.na')}
                    </span>
                    {objLink ? (
                      <MiniLink to={objLink} data-testid="monitoring.event.object.open">
                        {t('common.open')}
                      </MiniLink>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('common.created')}</div>
                  <div className="mt-1 text-sm">{formatDateTime((event as any).created_at)}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('common.updated')}</div>
                  <div className="mt-1 text-sm">{formatDateTime((event as any).updated_at)}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('monitoring.field.duration')}</div>
                  <div className="mt-1 text-sm">{durationLabel}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('monitoring.field.saved_until')}</div>
                  <div className="mt-1 text-sm">{savedUntilLabel}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card testId="monitoring.event.logs">
            <CardHeader
              title={t('monitoring.logs.title')}
              subtitle={t('monitoring.logs.subtitle')}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-32">
                    <Select
                      value={logOrder}
                      onChange={(e) => {
                        const v = e.target.value as MonitoredEventLogOrder;
                        setSp((prev) => {
                          const next = new URLSearchParams(prev);
                          if (v !== 'oldest') next.set('log_order', v);
                          else next.delete('log_order');
                          // Reset log pagination cursors when order changes.
                          next.delete('log_from_id');
                          next.delete('log_page');
                          return next;
                        });
                      }}
                      testId="monitoring.event.logs.order"
                    >
                      <option value="oldest">{t('monitoring.logs.order.oldest')}</option>
                      <option value="latest">{t('monitoring.logs.order.latest')}</option>
                    </Select>
                  </div>

                  <div className="w-36">
                    <Select
                      value={logPassed}
                      onChange={(e) => {
                        const v = e.target.value as '' | '1' | '0';
                        setSp((prev) => {
                          const next = new URLSearchParams(prev);
                          if (v === '') next.delete('log_passed');
                          else next.set('log_passed', v);
                          // Reset pagination on filter change.
                          next.delete('log_from_id');
                          next.delete('log_page');
                          return next;
                        });
                      }}
                      testId="monitoring.event.logs.passed"
                    >
                      <option value="">{t('monitoring.logs.passed.all')}</option>
                      <option value="1">{t('monitoring.logs.passed.only_passed')}</option>
                      <option value="0">{t('monitoring.logs.passed.only_failed')}</option>
                    </Select>
                  </div>
                </div>
              }
            />

            <CardBody>
              {sparklinePoints.length ? (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted">{t('monitoring.logs.sparkline')}</div>
                  <PassFailSparkline
                    points={sparklinePoints}
                    ariaLabel={t('monitoring.logs.sparkline')}
                    statsLabels={{ ok: t('monitoring.log.passed'), failed: t('monitoring.log.failed') }}
                    className="mt-2"
                    testId="monitoring.event.logs.sparkline"
                  />
                </div>
              ) : null}

              {logsQ.isLoading ? (
                <LoadingState testId="monitoring.event.logs.loading" />
              ) : logsQ.isError ? (
                <ErrorState
                  testId="monitoring.event.logs.error"
                  title={t('monitoring.logs.load_error.title')}
                  error={logsQ.error}
                  onRetry={() => void logsQ.refetch()}
                  showBack={false}
                  detailsExtra={{ page: 'monitoring.event.logs', id, scope: basePath }}
                />
              ) : logs.length === 0 ? (
                <EmptyState
                  testId="monitoring.event.logs.empty"
                  title={t('monitoring.logs.empty.title')}
                  body={t('monitoring.logs.empty.body')}
                />
              ) : (
                <TableCard
                  testId="monitoring.event.logs.table"
                  minWidth="md"
                  footer={
                    <KeysetPagination
                      page={logPagination.page}
                      pageCount={logPagination.stack.length}
                      canPrev={logPagination.canPrev}
                      canNext={canNextLogs}
                      onPrev={logPagination.goPrev}
                      onNext={() => logPagination.goNext(logCursor)}
                      onGoToPage={logPagination.goToPage}
                      limit={logPagination.limit}
                      allowedLimits={logPagination.allowedLimits}
                      onLimitChange={logPagination.setLimit}
                      testId="monitoring.event.logs.pagination"
                    />
                  }
                >
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-3 py-2">
                        <span className="sr-only">{t('common.state')}</span>
                      </th>
                      <th className="px-4 py-2">{t('common.id')}</th>
                      <th className="px-4 py-2">{t('monitoring.logs.column.result')}</th>
                      <th className="px-4 py-2">{t('monitoring.logs.column.value')}</th>
                      <th className="px-4 py-2">{t('monitoring.logs.column.time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l: MonitoredEventLog) => {
                      const lid = Number((l as any).id);
                      const passed = Boolean((l as any).passed);
                      const rowVariant = passed ? 'ok' : 'danger';
                      const dotVariant = passed ? 'ok' : 'danger';
                      const created = (l as any).created_at ? formatDateTime((l as any).created_at) : '';
                      const value = (l as any).value;
                      const valueLabel =
                        value == null
                          ? t('common.na')
                          : typeof value === 'string'
                            ? value
                            : JSON.stringify(value);

                      return (
                        <TableRowLink
                          key={lid}
                          // Logs do not have a standalone detail page; keep rows non-clickable.
                          variant={rowVariant}
                          testId={`monitoring.event.logs.row.${lid}`}
                        >
                          <td className="px-3 py-2">
                            <StatusDot
                              variant={dotVariant}
                              ariaLabel={passed ? t('monitoring.log.passed') : t('monitoring.log.failed')}
                            />
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{lid}</td>
                          <td className="px-4 py-2">
                            <Badge variant={passed ? 'ok' : 'danger'}>
                              {passed ? t('monitoring.log.passed') : t('monitoring.log.failed')}
                            </Badge>
                          </td>
                          <td className={clsx('px-4 py-2', 'font-mono text-xs')}>{valueLabel}</td>
                          <td className="px-4 py-2 text-sm text-muted">{created}</td>
                        </TableRowLink>
                      );
                    })}
                  </tbody>
                </TableCard>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={ackOpen}
        title={t('monitoring.ack.title')}
        description={t('monitoring.ack.description')}
        confirmLabel={t('monitoring.action.acknowledge')}
        confirmLoading={ackMut.isPending}
        confirmDisabled={!until.valid}
        onCancel={() => setAckOpen(false)}
        onConfirm={() => ackMut.mutate()}
        testId="monitoring.event.ack"
      >
        <div className="space-y-3">
          <div className="text-sm text-muted">{t('monitoring.until.label')}</div>

          <Select
            value={untilPreset}
            onChange={(e) => setUntilPreset(e.target.value as UntilPreset)}
            testId="monitoring.event.ack.until_preset"
          >
            <option value="1h">{t('monitoring.until.1h')}</option>
            <option value="6h">{t('monitoring.until.6h')}</option>
            <option value="1d">{t('monitoring.until.1d')}</option>
            <option value="1w">{t('monitoring.until.1w')}</option>
            <option value="forever">{t('monitoring.until.forever')}</option>
            <option value="custom">{t('monitoring.until.custom')}</option>
          </Select>

          {untilPreset === 'custom' ? (
            <div>
              <Input
                type="datetime-local"
                value={untilCustom}
                onChange={(e) => setUntilCustom(e.target.value)}
                testId="monitoring.event.ack.until_custom"
              />
              {!until.valid ? <div className="mt-1 text-xs text-danger">{t('monitoring.until.invalid')}</div> : null}
            </div>
          ) : null}

          {until.iso ? (
            <div className="text-xs text-muted">{t('monitoring.until.preview', { until: formatDateTime(until.iso) })}</div>
          ) : (
            <div className="text-xs text-muted">{t('monitoring.until.preview_forever')}</div>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={ignoreOpen}
        title={t('monitoring.ignore.title')}
        description={t('monitoring.ignore.description')}
        confirmLabel={t('monitoring.action.ignore')}
        confirmLoading={ignoreMut.isPending}
        confirmDisabled={!until.valid}
        danger
        onCancel={() => setIgnoreOpen(false)}
        onConfirm={() => ignoreMut.mutate()}
        testId="monitoring.event.ignore"
      >
        <div className="space-y-3">
          <div className="text-sm text-muted">{t('monitoring.until.label')}</div>

          <Select
            value={untilPreset}
            onChange={(e) => setUntilPreset(e.target.value as UntilPreset)}
            testId="monitoring.event.ignore.until_preset"
          >
            <option value="1h">{t('monitoring.until.1h')}</option>
            <option value="6h">{t('monitoring.until.6h')}</option>
            <option value="1d">{t('monitoring.until.1d')}</option>
            <option value="1w">{t('monitoring.until.1w')}</option>
            <option value="forever">{t('monitoring.until.forever')}</option>
            <option value="custom">{t('monitoring.until.custom')}</option>
          </Select>

          {untilPreset === 'custom' ? (
            <div>
              <Input
                type="datetime-local"
                value={untilCustom}
                onChange={(e) => setUntilCustom(e.target.value)}
                testId="monitoring.event.ignore.until_custom"
              />
              {!until.valid ? <div className="mt-1 text-xs text-danger">{t('monitoring.until.invalid')}</div> : null}
            </div>
          ) : null}

          {until.iso ? (
            <div className="text-xs text-muted">{t('monitoring.until.preview', { until: formatDateTime(until.iso) })}</div>
          ) : (
            <div className="text-xs text-muted">{t('monitoring.until.preview_forever')}</div>
          )}
        </div>
      </ConfirmDialog>
    </PageContainer>
  );
}

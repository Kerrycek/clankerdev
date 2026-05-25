import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { fetchTransactionChains } from '../../../lib/api/transactions';
import { fetchVpsStatuses, type VpsStatus } from '../../../lib/api/vps';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { LifecyclePanel } from '../../../components/lifetimes/LifecyclePanel';
import { ChipLink } from '../../../components/ui/ChipLink';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { GaugeRing } from '../../../components/ui/GaugeRing';
import { UsageBar } from '../../../components/ui/UsageBar';
import { TimeSeriesChart } from '../../../components/ui/TimeSeriesChart';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { formatDateTime, formatDurationSeconds, formatMiB } from '../../../lib/format';
import { formatErrorMessage } from '../../../lib/errors';
import { chainBadgeFromState, chainProgressLabel, chainProgressPercent, isFailedChainState } from '../../../lib/taskStatus';
import { useVps } from './VpsContext';
import { useTierBIntervalMs, useTierSlowIntervalMs } from '../../../lib/refreshTiers';

function field(label: React.ReactNode, value: React.ReactNode) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      <div className="text-sm text-faint">{label}</div>
      <div className="col-span-2 text-sm text-fg">{value ?? '—'}</div>
    </div>
  );
}

function usageValue(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function formatLoadavg(vps: any): string {
  const a1 = typeof vps.loadavg1 === 'number' ? vps.loadavg1 : undefined;
  const a5 = typeof vps.loadavg5 === 'number' ? vps.loadavg5 : undefined;
  const a15 = typeof vps.loadavg15 === 'number' ? vps.loadavg15 : undefined;

  if (a1 == null && a5 == null && a15 == null) return '—';

  const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toFixed(2) : '—');
  return `${fmt(a1)} / ${fmt(a5)} / ${fmt(a15)}`;
}

function fmtLoad(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function safePercent(num: unknown, den: unknown): number | null {
  const n = typeof num === 'number' ? num : Number.NaN;
  const d = typeof den === 'number' ? den : Number.NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return (n / d) * 100;
}

type MetricsWindow = '24h' | '7d' | '30d';

function parseMetricsWindow(raw: string | null | undefined): MetricsWindow {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '7d') return '7d';
  if (v === '30d') return '30d';
  return '24h';
}

function metricsWindowMs(w: MetricsWindow): number {
  switch (w) {
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function metricsLimitForWindow(w: MetricsWindow): number {
  // VPS statuses are sampled roughly once per hour (plus state changes).
  // Keep point counts reasonable for an internal SVG chart.
  switch (w) {
    case '30d':
      return 900;
    case '7d':
      return 240;
    default:
      return 80;
  }
}

function sortStatusesByTimeAsc(list: VpsStatus[]): VpsStatus[] {
  return list
    .slice()
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : Number.NaN;
      const tb = b.created_at ? new Date(b.created_at).getTime() : Number.NaN;
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
      if (!Number.isFinite(ta)) return -1;
      if (!Number.isFinite(tb)) return 1;
      return ta - tb;
    });
}

export function VpsOverviewPage() {
  const { vps, refetch } = useVps();
  const { basePath, mode } = useAppMode();
  const { t } = useI18n();

  const [searchParams, setSearchParams] = useSearchParams();


  const metricsWindow = parseMetricsWindow(searchParams.get('metrics_window'));
  const metricsLimit = metricsLimitForWindow(metricsWindow);

  const tierBRefetchMs = useTierBIntervalMs();
  const tierSlowRefetchMs = useTierSlowIntervalMs();

  const setMetricsWindow = (w: MetricsWindow) => {
    const next = new URLSearchParams(searchParams);
    next.set('metrics_window', w);
    setSearchParams(next, { replace: true });
  };

  const osLabel = (vps.os_template as any)?.label ?? (vps.os_template as any)?.name;
  const dnsLabel = (vps.dns_resolver as any)?.label ?? (vps.dns_resolver as any)?.name;
  const owner = (vps.user as any)?.login ?? (vps.user as any)?.id;
  const ownerId = typeof (vps.user as any)?.id === 'number' ? (vps.user as any).id : null;

  const chainsQ = useQuery({
    queryKey: ['transaction_chains', 'list', { className: 'Vps', rowId: vps.id, limit: 5 }],
    queryFn: async () => (await fetchTransactionChains({ limit: 5, className: 'Vps', rowId: vps.id })).data,
    refetchInterval: tierBRefetchMs,
  });

  const chainsSorted = useMemo(() => {
    const rows = (chainsQ.data ?? []).slice();
    return rows.sort((a, b) => {
      const aErr = isFailedChainState(a.state);
      const bErr = isFailedChainState(b.state);
      if (aErr !== bErr) return aErr ? -1 : 1;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [chainsQ.data]);

  const metricsQ = useQuery({
    queryKey: ['vps', 'metrics', { vpsId: vps.id, window: metricsWindow, limit: metricsLimit }],
    queryFn: async () => {
      const now = Date.now();
      const from = new Date(now - metricsWindowMs(metricsWindow)).toISOString();
      const to = new Date(now).toISOString();

      try {
        return (await fetchVpsStatuses(vps.id, { limit: metricsLimit, from, to })).data;
      } catch {
        // Some deployments may not support `from/to`. Fallback to a limit-only fetch.
        return (await fetchVpsStatuses(vps.id, { limit: metricsLimit })).data;
      }
    },
    enabled: Number.isFinite(vps.id) && vps.id > 0,
    refetchInterval: tierSlowRefetchMs,
  });

  const metricsRows = useMemo(() => sortStatusesByTimeAsc(metricsQ.data ?? []), [metricsQ.data]);
  const metricsLast = metricsRows.length > 0 ? metricsRows[metricsRows.length - 1] : null;

  const load1Points = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (const s of metricsRows) {
      const ts = s.created_at ? new Date(s.created_at) : null;
      if (!ts || !Number.isFinite(ts.getTime())) continue;
      const y = typeof s.loadavg1 === 'number' ? s.loadavg1 : Number.NaN;
      if (!Number.isFinite(y)) continue;
      out.push({ x: ts.getTime(), y });
    }
    return out;
  }, [metricsRows]);

  const load5Points = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (const s of metricsRows) {
      const ts = s.created_at ? new Date(s.created_at) : null;
      if (!ts || !Number.isFinite(ts.getTime())) continue;
      const y = typeof s.loadavg5 === 'number' ? s.loadavg5 : Number.NaN;
      if (!Number.isFinite(y)) continue;
      out.push({ x: ts.getTime(), y });
    }
    return out;
  }, [metricsRows]);

  const memUsedPercentPoints = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (const s of metricsRows) {
      const ts = s.created_at ? new Date(s.created_at) : null;
      if (!ts || !Number.isFinite(ts.getTime())) continue;
      const total = typeof s.total_memory === 'number' ? s.total_memory : vps.memory;
      const p = safePercent(s.used_memory, total);
      if (p == null) continue;
      out.push({ x: ts.getTime(), y: p });
    }
    return out;
  }, [metricsRows, vps.memory]);

  const diskUsedPercentPoints = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (const s of metricsRows) {
      const ts = s.created_at ? new Date(s.created_at) : null;
      if (!ts || !Number.isFinite(ts.getTime())) continue;
      const total = typeof s.total_diskspace === 'number' ? s.total_diskspace : vps.diskspace;
      const p = safePercent(s.used_diskspace, total);
      if (p == null) continue;
      out.push({ x: ts.getTime(), y: p });
    }
    return out;
  }, [metricsRows, vps.diskspace]);

  function UsageMetric(props: { label: string; used: unknown; max: unknown; testId?: string }) {
    const used = usageValue(props.used);
    const max = usageValue(props.max);

    if (used == null || max == null || max <= 0) {
      return (
        <div className="flex items-center justify-between gap-3" data-testid={props.testId}>
          <div className="text-sm text-faint">{props.label}</div>
          <div className="text-sm text-muted">—</div>
        </div>
      );
    }

    const ratio = used / max;
    const pct = Number.isFinite(ratio) ? Math.max(0, Math.min(100, Math.round(ratio * 100))) : null;
    const pctLabel = pct == null ? '—' : `${pct}%`;
    return <UsageBar testId={props.testId} label={props.label} used={used} max={max} formatValue={formatMiB} />;
  }

  const metricsBody = (() => {
    if (metricsQ.isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> {t('common.loading')}
        </div>
      );
    }

    if (metricsQ.isError) {
      return (
        <Alert title={t('vps.overview.metrics.error')} variant="danger">
          {formatErrorMessage(metricsQ.error)}
        </Alert>
      );
    }

    if (metricsRows.length === 0) {
      return <div className="text-sm text-muted">{t('vps.overview.metrics.empty')}</div>;
    }

    const memUsedNow = (metricsLast as any)?.used_memory ?? (vps as any).used_memory;
    const memTotal = (metricsLast as any)?.total_memory ?? (vps as any).memory;
    const memPct = safePercent(memUsedNow, memTotal);

    const diskUsedNow = (metricsLast as any)?.used_diskspace ?? (vps as any).used_diskspace;
    const diskTotal = (metricsLast as any)?.total_diskspace ?? (vps as any).diskspace;
    const diskPct = safePercent(diskUsedNow, diskTotal);

    const loadNow1 = (metricsLast as any)?.loadavg1 ?? (vps as any).loadavg1;
    const loadNow5 = (metricsLast as any)?.loadavg5 ?? (vps as any).loadavg5;

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4" data-testid="vps.overview.metrics.grid">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">{t('vps.overview.metrics.chart.load1')}</div>
            <div className="text-xs text-muted">{fmtLoad(loadNow1)}</div>
          </div>
          <TimeSeriesChart
            testId="vps.overview.metrics.chart.load1"
            ariaLabel={t('vps.overview.chart.loadavg1_aria', { window: metricsWindow })}
            points={load1Points}
            variant="cpu"
            formatValue={(n) => n.toFixed(2)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">{t('vps.overview.metrics.chart.load5')}</div>
            <div className="text-xs text-muted">{fmtLoad(loadNow5)}</div>
          </div>
          <TimeSeriesChart
            testId="vps.overview.metrics.chart.load5"
            ariaLabel={t('vps.overview.chart.loadavg5_aria', { window: metricsWindow })}
            points={load5Points}
            variant="cpu"
            formatValue={(n) => n.toFixed(2)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">{t('vps.overview.metrics.chart.mem_used')}</div>
            <div className="text-xs text-muted">
              {formatMiB(memUsedNow)} <span className="text-faint">/ {formatMiB(memTotal)}</span>
              {memPct != null ? ` (${memPct.toFixed(1)}%)` : ''}
            </div>
          </div>
          <TimeSeriesChart
            testId="vps.overview.metrics.chart.mem_used"
            ariaLabel={t('vps.overview.chart.memory_used_percent_aria', { window: metricsWindow })}
            points={memUsedPercentPoints}
            variant="memory"
            yMin={0}
            yMax={100}
            thresholds={[
              { value: 90, label: "90%", variant: "warn" },
              { value: 98, label: "98%", variant: "danger" },
            ]}
            formatValue={(n) => `${n.toFixed(1)}%`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium">{t('vps.overview.metrics.chart.disk_used')}</div>
            <div className="text-xs text-muted">
              {formatMiB(diskUsedNow)} <span className="text-faint">/ {formatMiB(diskTotal)}</span>
              {diskPct != null ? ` (${diskPct.toFixed(1)}%)` : ''}
            </div>
          </div>
          <TimeSeriesChart
            testId="vps.overview.metrics.chart.disk_used"
            ariaLabel={t('vps.overview.chart.disk_used_percent_aria', { window: metricsWindow })}
            points={diskUsedPercentPoints}
            variant="disk"
            yMin={0}
            yMax={100}
            thresholds={[
              { value: 90, label: "90%", variant: "warn" },
              { value: 98, label: "98%", variant: "danger" },
            ]}
            formatValue={(n) => `${n.toFixed(1)}%`}
          />
        </div>
      </div>
    );
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('vps.overview.config.title')} />
        <CardBody>
          {field(t('vps.overview.config.vps_id'), <span className="font-medium">#{vps.id}</span>)}
          {field(t('vps.overview.config.hostname'), <span className="font-medium">{vps.hostname}</span>)}
          {owner ? field(t('vps.overview.config.owner'), <span className="font-medium">{String(owner)}</span>) : null}
          {field(t('vps.overview.config.os_template'), osLabel ? String(osLabel) : '—')}
          {field(t('vps.overview.config.dns_resolver'), dnsLabel ? String(dnsLabel) : '—')}
          {field(
            t('vps.overview.config.user_namespace_map'),
            vps.user_namespace_map ? (
              <Link
                className="text-link underline"
                to={
                  mode === 'admin'
                    ? `${basePath}/user-namespaces/maps/${vps.user_namespace_map.id}`
                    : `${basePath}/profile/user-namespaces/maps/${vps.user_namespace_map.id}`
                }
              >
                #{vps.user_namespace_map.id}
                {vps.user_namespace_map.label ? ` — ${vps.user_namespace_map.label}` : ''}
              </Link>
            ) : (
              '—'
            ),
          )}
          {field(t('vps.overview.config.cpu'), typeof vps.cpu === 'number' ? `${vps.cpu} vCPU` : '—')}
          {field(t('vps.overview.config.memory'), formatMiB(vps.memory as any))}
          {field(t('vps.overview.config.swap'), formatMiB(vps.swap as any))}
          {field(t('vps.overview.config.diskspace'), formatMiB(vps.diskspace as any))}
          {field(t('vps.overview.config.created'), formatDateTime(vps.created_at as any))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('vps.overview.usage.title')} />
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-faint">{t('vps.overview.usage.uptime')}</div>
                <div className="text-sm font-medium text-fg">{formatDurationSeconds(vps.uptime as any) ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('vps.overview.usage.load')}</div>
                <div className="text-sm font-medium text-fg">{formatLoadavg(vps)}</div>
              </div>
            </div>

            <div className="space-y-4">
              <UsageMetric
                testId="vps.overview.usage.memory"
                label={t('vps.overview.usage.memory_used')}
                used={(vps as any).used_memory}
                max={(vps as any).memory}
              />
              <UsageMetric
                testId="vps.overview.usage.swap"
                label={t('vps.overview.usage.swap_used')}
                used={(vps as any).used_swap}
                max={(vps as any).swap}
              />
              <UsageMetric
                testId="vps.overview.usage.disk"
                label={t('vps.overview.usage.disk_used')}
                used={(vps as any).used_diskspace}
                max={(vps as any).diskspace}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="lg:col-span-2">
        <LifecyclePanel
          kind="vps"
          id={vps.id}
          objectLabel={vps.hostname}
          objectState={(vps as any).object_state as any}
          expirationDate={(vps as any).expiration_date as any}
          remindAfterDate={(vps as any).remind_after_date as any}
          onUpdated={refetch}
          testId="vps.overview.lifecycle"
        />
      </div>

      {mode === 'admin' ? (
        <Card className="lg:col-span-2" testId="vps.overview.admin_actions.card">
          <CardHeader title={t('vps.overview.admin_actions.title')} subtitle={t('vps.overview.admin_actions.subtitle')} />
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <ChipLink to={`${basePath}/vps/${vps.id}/console`} title={t('vps.overview.admin_actions.remote_console_title')}>
                {t('vps.overview.admin_actions.remote_console')}
              </ChipLink>
              <ChipLink to={`${basePath}/vps/${vps.id}/storage`} title={t('vps.overview.admin_actions.backups_title')}>
                {t('vps.overview.admin_actions.backups')}
              </ChipLink>
              <ChipLink to={`${basePath}/migration-plans`} title={t('vps.overview.admin_actions.migrate_title')}>
                {t('vps.overview.admin_actions.migrate')}
              </ChipLink>
              <ChipLink to={`${basePath}/vps/${vps.id}/config`} title={t('vps.overview.admin_actions.change_owner_title')}>
                {t('vps.overview.admin_actions.change_owner')}
              </ChipLink>
              <ChipLink to={`${basePath}/vps/${vps.id}/lifecycle`} title={t('vps.overview.admin_actions.lifecycle_title')}>
                {t('vps.overview.admin_actions.lifecycle')}
              </ChipLink>
              <ChipLink to={`${basePath}/oom-reports?vps=${vps.id}`} title={t('vps.overview.admin_actions.oom_reports_title')}>
                {t('vps.overview.admin_actions.oom_reports')}
              </ChipLink>
              <ChipLink to={`${basePath}/oom-reports/rules/${vps.id}`} title={t('vps.overview.admin_actions.oom_rules_title')}>
                {t('vps.overview.admin_actions.oom_rules')}
              </ChipLink>
              <ChipLink to={`${basePath}/incidents?vps=${vps.id}`} title={t('vps.overview.admin_actions.incidents_title')}>
                {t('vps.overview.admin_actions.incidents')}
              </ChipLink>
              <ChipLink to={`${basePath}/incidents/new?vps=${vps.id}`} title={t('vps.overview.admin_actions.report_incident_title')}>
                {t('vps.overview.admin_actions.report_incident')}
              </ChipLink>
              <ChipLink to={`/outages`} title={t('vps.overview.admin_actions.outages_title')}>
                {t('vps.overview.admin_actions.outages')}
              </ChipLink>
              <ChipLink to={`${basePath}/transactions?class_name=Vps&row_id=${vps.id}`} title={t('vps.overview.admin_actions.transaction_log_title')}>
                {t('vps.overview.admin_actions.transaction_log')}
              </ChipLink>
              {ownerId ? (
                <ChipLink to={`${basePath}/users/${ownerId}/user-data`} title={t('vps.overview.admin_actions.user_data_title')}>
                  {t('vps.overview.admin_actions.user_data')}
                </ChipLink>
              ) : null}
              <ChipLink to={`${basePath}/user-namespaces`} title={t('vps.overview.admin_actions.user_namespaces_title')}>
                {t('vps.overview.admin_actions.user_namespaces')}
              </ChipLink>
              <ChipLink to={`${basePath}/vps/${vps.id}/storage`} title={t('vps.overview.admin_actions.create_dataset_title')}>
                {t('vps.overview.admin_actions.create_dataset')}
              </ChipLink>
            </div>
            <div className="mt-2 text-xs text-faint">{t('vps.overview.admin_actions.hint')}</div>
          </CardBody>
        </Card>
      ) : null}

      <Card className="lg:col-span-2" testId="vps.overview.diagnostics.card">
        <CardHeader title={t('vps.overview.diagnostics.title')} subtitle={t('vps.overview.diagnostics.subtitle')} />
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <ChipLink to={`${basePath}/oom-reports?vps=${vps.id}`} title={t('vps.overview.diagnostics.oom_reports_title')}>
              {t('vps.overview.diagnostics.oom_reports')}
            </ChipLink>
            <ChipLink to={`${basePath}/oom-reports/rules/${vps.id}`} title={t('vps.overview.diagnostics.oom_rules_title')}>
              {t('vps.overview.diagnostics.oom_rules')}
            </ChipLink>
            <ChipLink to={`${basePath}/incidents?vps=${vps.id}`} title={t('vps.overview.diagnostics.incidents_title')}>
              {t('vps.overview.diagnostics.incidents')}
            </ChipLink>
          </div>
          <div className="mt-2 text-xs text-faint">{t('vps.overview.diagnostics.hint')}</div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2" testId="vps.overview.metrics.card">
        <CardHeader
          title={t('vps.overview.metrics.title')}
          subtitle={t('vps.overview.metrics.subtitle', { window: metricsWindow, samples: metricsRows.length })}
          actions={(
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {(['24h', '7d', '30d'] as const).map((w) => (
                    <Button
                      key={w}
                      testId={`vps.overview.metrics.window.${w}`}
                      size="sm"
                      variant={metricsWindow === w ? 'primary' : 'secondary'}
                      onClick={() => setMetricsWindow(w)}
                    >
                      {w}
                    </Button>
                  ))}
                </div>
                <Button
                  testId="vps.overview.metrics.refresh"
                  variant="secondary"
                  size="sm"
                  onClick={() => metricsQ.refetch()}
                  disabled={metricsQ.isFetching}
                >
                  {t('common.refresh')}
                </Button>
              </div>
          )}
        />
        <CardBody>
          {metricsBody}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title={t('vps.overview.tx.title')}
          subtitle={t('vps.overview.tx.subtitle')}
          actions={
            <>
              <ChipLink
                to={`${basePath}/transactions/items?vps=${vps.id}`}
                title={t('vps.overview.tx.tx_items_title')}
              >
                {t('vps.overview.tx.tx_items')}
              </ChipLink>
              <ChipLink
                to={`${basePath}/transactions?class_name=Vps&row_id=${vps.id}`}
                title={t('vps.overview.tx.chains_title')}
              >
                {t('vps.overview.tx.chains')}
              </ChipLink>
            </>
          }
        />
        <CardBody>
          {chainsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> {t('common.loading')}
            </div>
          ) : chainsQ.isError ? (
            <div className="text-sm text-muted">{t('vps.overview.tx.error')}</div>
          ) : (chainsQ.data ?? []).length === 0 ? (
            <div className="text-sm text-muted">{t('vps.overview.tx.empty')}</div>
          ) : (
            <ul className="divide-y divide-border">
              {chainsSorted.map((c) => {
                const b = chainBadgeFromState(c.state);
                const label = c.label ? String(c.label) : `#${c.id}`;
                const isError = isFailedChainState(c.state);

                const pct = chainProgressPercent(c);
                const lbl = chainProgressLabel(c);

                return (
                  <li
                    key={c.id}
                    className={
                      'flex flex-wrap items-center justify-between gap-3 py-3 ' +
                      (isError ? 'bg-danger-row px-2 -mx-2 rounded-md' : '')
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        <Link className="underline" to={`${basePath}/transactions/${c.id}`}>
                          {label}
                        </Link>
                      </div>
                      <div className="mt-1 text-xs text-faint">
                        #{c.id} · {formatDateTime(c.created_at)}
                        {lbl ? <> · {lbl}</> : null}
                        {pct != null ? <> · {pct}%</> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChipLink
                        to={`${basePath}/transactions/items?transaction_chain=${c.id}&vps=${vps.id}`}
                        title={t('vps.overview.tx.tx_items_for_chain_title', { id: c.id })}
                      >
                        {t('vps.overview.tx.tx_items')}
                      </ChipLink>
                      <Badge variant={b.variant}>{b.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

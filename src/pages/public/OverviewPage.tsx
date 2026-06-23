import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchNews,
  fetchOutages,
  fetchPublicNodeStatus,
  fetchPublicStats,
} from '../../lib/api/public';
import type { Outage } from '../../lib/api/public';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { categorizeOutage, sortOutagesNewestFirst } from '../../lib/outage';
import { formatDateTime } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';
import { useI18n } from '../../app/i18n';
import { getRuntimeConfig } from '../../app/config';
import { Table } from '../../components/ui/Table';
import { StatusDot } from '../../components/ui/StatusDot';
import { outageBadges } from '../../lib/outageBadges';

function CompactMetric(props: {
  title: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={props.testId} className="min-w-0 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{props.title}</div>
      <div className="mt-1 text-xl font-semibold text-fg">{props.value}</div>
      {props.detail ? <div className="mt-1 text-xs text-muted">{props.detail}</div> : null}
    </div>
  );
}

function compactPlainText(value: string): string {
  return value
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function OverviewPage() {
  const i18n = useI18n();
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const [searchParams] = useSearchParams();
  const showSessionExpired = searchParams.get('session') === 'expired';

  const unknownLocationLabel = i18n.t('public.nodes.location_unknown');

  const statsQ = useQuery({
    queryKey: ['cluster', 'public_stats'],
    queryFn: async () => (await fetchPublicStats()).data,
  });

  const nodesQ = useQuery({
    queryKey: ['nodes', 'public_status'],
    queryFn: async () => (await fetchPublicNodeStatus()).data,
  });

  const outagesQ = useQuery({
    queryKey: ['outages', 'index'],
    queryFn: async () => (await fetchOutages()).data,
  });

  const newsQ = useQuery({
    queryKey: ['news_logs', 'index'],
    queryFn: async () => (await fetchNews()).data,
  });

  const outagesByCategory = useMemo(() => {
    const list = (outagesQ.data ?? []).slice().sort(sortOutagesNewestFirst);
    const now = new Date();

    const current: Outage[] = [];
    const planned: Outage[] = [];
    const resolved: Outage[] = [];
    const unknown: Outage[] = [];

    for (const o of list) {
      switch (categorizeOutage(o, now)) {
        case 'current':
          current.push(o);
          break;
        case 'planned':
          planned.push(o);
          break;
        case 'resolved':
          resolved.push(o);
          break;
        default:
          unknown.push(o);
      }
    }

    return { current, planned, resolved, unknown };
  }, [outagesQ.data]);

  const nodesByLocation = useMemo(() => {
    const groups: Record<string, { ok: number; down: number; total: number; nodes: any[] }> = {};

    const nodesList: any[] = Array.isArray(nodesQ.data)
      ? (nodesQ.data as any[])
      : (((nodesQ.data as any) && (nodesQ.data as any).nodes) ? (nodesQ.data as any).nodes : []);

    for (const n of nodesList) {
      const loc =
        n.location && (n.location.label || n.location.id)
          ? String(n.location.label ?? n.location.id)
          : unknownLocationLabel;
      groups[loc] ??= { ok: 0, down: 0, total: 0, nodes: [] };
      groups[loc].total += 1;
      groups[loc].nodes.push(n);
      if (n.status) groups[loc].ok += 1;
      else groups[loc].down += 1;
    }

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [nodesQ.data, unknownLocationLabel]);

  const nodeSummary = useMemo(() => {
    let ok = 0;
    let down = 0;
    let total = 0;

    for (const [, g] of nodesByLocation) {
      ok += g.ok;
      down += g.down;
      total += g.total;
    }

    return { ok, down, total };
  }, [nodesByLocation]);

  const nodeRows = useMemo(
    () => nodesByLocation.flatMap(([location, group]) => group.nodes.map((node) => ({ location, node }))),
    [nodesByLocation],
  );

  const visibleOutages = useMemo(() => {
    if (outagesByCategory.current.length > 0) return outagesByCategory.current.slice(0, 5);
    if (outagesByCategory.planned.length > 0) return outagesByCategory.planned.slice(0, 5);
    return outagesByCategory.resolved.slice(0, 5);
  }, [outagesByCategory]);

  const ipv4Left: number | null =
    statsQ.data && typeof (statsQ.data as any).ipv4_left === 'number'
      ? Number((statsQ.data as any).ipv4_left)
      : null;

  const ipv4WarnThreshold = cfg.publicStatus.ipv4Warn;
  const ipv4CriticalThreshold = cfg.publicStatus.ipv4Critical;

  const ipv4Level: 'ok' | 'warn' | 'critical' =
    ipv4Left == null
      ? 'ok'
      : ipv4Left <= ipv4CriticalThreshold
        ? 'critical'
        : ipv4Left <= ipv4WarnThreshold
          ? 'warn'
          : 'ok';

  const ipv4BadgeVariant =
    ipv4Left == null ? 'neutral' : ipv4Level === 'critical' ? 'danger' : ipv4Level === 'warn' ? 'warn' : 'neutral';

  return (
    <div className="space-y-5" data-testid="public.overview.page">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight">{i18n.t('public.overview.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{i18n.t('public.overview.subtitle')}</p>
      </div>

      <div className="space-y-3">
        {showSessionExpired ? (
          <Alert title={i18n.t('auth.session_expired.title')} variant="warn" testId="auth.session-expired.notice">
            {i18n.t('auth.session_expired.body')}
          </Alert>
        ) : null}

        <div
          className={
            outagesByCategory.current.length > 0
              ? 'rounded-md border border-danger-border bg-danger-bg px-3 py-2'
              : 'rounded-md border border-ok-border bg-ok-bg px-3 py-2'
          }
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold">
              <StatusDot
                variant={outagesByCategory.current.length > 0 ? 'danger' : 'ok'}
                ariaLabel={
                  outagesByCategory.current.length > 0
                    ? i18n.tc('public.overview.outage_alert.title', outagesByCategory.current.length)
                    : i18n.t('public.overview.nominal.title')
                }
              />
              {outagesByCategory.current.length > 0
                ? i18n.tc('public.overview.outage_alert.title', outagesByCategory.current.length)
                : i18n.t('public.overview.nominal.title')}
            </span>
            <span className="text-muted">
              {outagesByCategory.current.length > 0
                ? i18n.tc('public.overview.outage_alert.body', outagesByCategory.current.length)
                : i18n.t('public.overview.nominal.body')}
            </span>
            {outagesByCategory.current.length > 0 ? (
              <Link to="/outages" className="underline">
                {i18n.t('public.overview.outage_alert.link')}
              </Link>
            ) : null}
          </div>
        </div>

        {ipv4Level === 'critical' ? (
          <Alert title={i18n.t('public.overview.ipv4_critical.title')} variant="danger" testId="public.ipv4.alert">
            {i18n.t('public.overview.ipv4_critical.body', { count: ipv4Left ?? 0 })}
          </Alert>
        ) : null}
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <CompactMetric
              testId="public.stats.members"
              title={i18n.t('public.overview.stats.members.title')}
              value={statsQ.isLoading ? <span className="text-muted">…</span> : statsQ.isError ? '—' : statsQ.data?.user_count ?? '—'}
              detail={i18n.t('public.overview.stats.members.subtitle')}
            />
            <CompactMetric
              testId="public.stats.vps"
              title={i18n.t('public.overview.stats.vps.title')}
              value={statsQ.isLoading ? <span className="text-muted">…</span> : statsQ.isError ? '—' : statsQ.data?.vps_count ?? '—'}
              detail={i18n.t('public.overview.stats.vps.subtitle')}
            />
            <CompactMetric
              testId="public.stats.nodes"
              title={i18n.t('public.overview.stats.nodes.title')}
              value={nodesQ.isLoading ? <span className="text-muted">…</span> : nodesQ.isError ? '—' : nodeSummary.total}
              detail={
                nodesQ.isLoading || nodesQ.isError || nodeSummary.total <= 0
                  ? i18n.t('public.overview.stats.nodes.footer.none')
                  : i18n.t('public.overview.stats.nodes.footer', {
                      ok: nodeSummary.ok,
                      down: nodeSummary.down,
                      total: nodeSummary.total,
                    })
              }
            />
            <CompactMetric
              title={i18n.t('public.overview.stats.vps.ipv4_free')}
              value={<Badge variant={ipv4BadgeVariant}>{ipv4Left == null ? '—' : ipv4Left}</Badge>}
              detail={ipv4Level === 'warn' ? i18n.t('public.overview.ipv4_warn.hint') : null}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div data-testid="public.outages.card">
          <Card>
            <CardHeader
              title={i18n.t('public.overview.outages.title')}
              subtitle={i18n.t('public.overview.outages.subtitle', {
                current: outagesByCategory.current.length,
                planned: outagesByCategory.planned.length,
                resolved: outagesByCategory.resolved.length,
              })}
              actions={<Link to="/outages" className="text-sm underline">{i18n.t('public.overview.outages.all')}</Link>}
            />
            <CardBody className="p-0">
              {outagesQ.isLoading ? (
                <div className="p-4"><Spinner label={i18n.t('public.overview.outages.loading')} /></div>
              ) : outagesQ.isError ? (
                <div className="p-4"><Alert title={i18n.t('public.overview.outages.error')} variant="danger" /></div>
              ) : visibleOutages.length === 0 ? (
                <div className="p-4 text-sm text-muted">{i18n.t('public.overview.outages.empty')}</div>
              ) : (
                <>
                  <div className="divide-y divide-border md:hidden">
                    {visibleOutages.map((o) => {
                      const summary = pickTranslation(o as any, 'summary', i18n.preferredLanguageCodes);
                      const badges = outageBadges(o, i18n.t);
                      return (
                        <div key={o.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted">{formatDateTime(o.begins_at)}</div>
                            <Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge>
                          </div>
                          <Link to={`/outages/${o.id}`} className="mt-1 block text-sm font-medium hover:underline">
                            {summary ?? i18n.t('public.outage.fallback_title', { id: o.id })}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-auto md:block">
                    <Table minWidth="md" testId="public.outages.table">
                    <tbody>
                      {visibleOutages.map((o) => {
                        const summary = pickTranslation(o as any, 'summary', i18n.preferredLanguageCodes);
                        const badges = outageBadges(o, i18n.t);
                        return (
                          <tr key={o.id} className="border-t border-border first:border-t-0">
                            <td className="w-32 px-4 py-3 text-xs text-muted">{formatDateTime(o.begins_at)}</td>
                            <td className="w-24 px-3 py-3"><Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge></td>
                            <td className="px-3 py-3 text-sm">
                              <Link to={`/outages/${o.id}`} className="font-medium hover:underline">
                                {summary ?? i18n.t('public.outage.fallback_title', { id: o.id })}
                              </Link>
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
          </Card>
        </div>

        <div data-testid="public.news.card">
          <Card>
            <CardHeader
              title={i18n.t('public.overview.news.title')}
              subtitle={i18n.t('public.overview.news.subtitle')}
              actions={<Link to="/news" className="text-sm underline">{i18n.t('public.overview.news.all')}</Link>}
            />
            <CardBody className="p-0">
              {newsQ.isLoading ? (
                <div className="p-4"><Spinner label={i18n.t('public.overview.news.loading')} /></div>
              ) : newsQ.isError ? (
                <div className="p-4"><Alert title={i18n.t('public.overview.news.error')} variant="danger" /></div>
              ) : (newsQ.data?.length ?? 0) === 0 ? (
                <div className="p-4 text-sm text-muted">{i18n.t('public.overview.news.empty')}</div>
              ) : (
                <div className="divide-y divide-border">
                  {newsQ.data?.slice(0, 5).map((n) => (
                    <div key={n.id} className="px-4 py-3">
                      <div className="text-xs text-muted">{formatDateTime(n.published_at)}</div>
                      <div className="mt-1 line-clamp-2 text-sm">{compactPlainText(n.message)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div data-testid="public.nodes.section">
        <Card>
          <CardHeader title={i18n.t('public.overview.nodes.title')} subtitle={i18n.t('public.overview.nodes.subtitle')} />
          <CardBody className="p-0">
          {nodesQ.isLoading ? (
            <div className="p-4"><Spinner label={i18n.t('public.overview.nodes.loading')} /></div>
          ) : nodesQ.isError ? (
            <div className="p-4"><Alert title={i18n.t('public.overview.nodes.error')} variant="danger" /></div>
          ) : nodesByLocation.length === 0 ? (
            <div className="p-4 text-sm text-muted">{i18n.t('public.overview.nodes.empty')}</div>
          ) : (
            <>
              <div className="divide-y divide-border md:hidden">
                {nodeRows.map(({ location, node }: any) => (
                  <div key={`${location}-${node.name}`} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{node.name}</div>
                        <div className="mt-0.5 text-xs text-muted">{location}</div>
                      </div>
                      {node.status ? <Badge variant="ok">{i18n.t('state.up')}</Badge> : <Badge variant="danger">{i18n.t('state.down')}</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted">
                      {i18n.t('public.overview.nodes.vps')}: {typeof node.vps_count === 'number' ? node.vps_count : '—'}
                      {typeof node.cpu_idle === 'number' ? ` · ${i18n.t('public.overview.nodes.cpu_idle')}: ${node.cpu_idle.toFixed(1)}%` : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-auto md:block">
                <Table minWidth="lg" testId="public.nodes.table">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">{i18n.t('public.overview.nodes.table.node')}</th>
                    <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.location')}</th>
                    <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.status')}</th>
                    <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.last_report')}</th>
                    <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.vps')}</th>
                    <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.cpu_idle')}</th>
                  </tr>
                </thead>
                <tbody>
                  {nodeRows.map(({ location, node }: any) => (
                    <tr key={`${location}-${node.name}`} className="border-t border-border" data-row-variant={node.status ? undefined : 'danger'}>
                      <td className="px-4 py-2 font-medium">{node.name}</td>
                      <td className="px-3 py-2 text-muted">{location}</td>
                      <td className="px-3 py-2">
                        {node.status ? <Badge variant="ok">{i18n.t('state.up')}</Badge> : <Badge variant="danger">{i18n.t('state.down')}</Badge>}
                      </td>
                      <td className="px-3 py-2 text-muted">{formatDateTime(node.last_report)}</td>
                      <td className="px-3 py-2 text-muted">
                        {typeof node.vps_count === 'number' ? node.vps_count : '—'}
                        {typeof node.vps_free === 'number'
                          ? ` · ${i18n.t('public.overview.nodes.vps_free', { count: node.vps_free })}`
                          : null}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {typeof node.cpu_idle === 'number' ? `${node.cpu_idle.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </Table>
              </div>
            </>
          )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

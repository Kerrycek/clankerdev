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
import { GaugeRing } from '../../components/ui/GaugeRing';
import { StackedBar } from '../../components/ui/StackedBar';
import { StatCard } from '../../components/ui/StatCard';
import { Spinner } from '../../components/ui/Spinner';
import { StatusLandingMark } from '../../components/branding/StatusLandingMark';
import { categorizeOutage, sortOutagesNewestFirst } from '../../lib/outage';
import { formatDateTime } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';
import { useI18n } from '../../app/i18n';
import { SummaryGrid } from '../../components/layout/SummaryGrid';
import { getRuntimeConfig } from '../../app/config';
import { Table } from '../../components/ui/Table';
import { StatusDot } from '../../components/ui/StatusDot';
import { outageBadges } from '../../lib/outageBadges';
import { dotVariantFromBadgeVariant } from '../../lib/variantMap';

function OutageSummary(props: { outage: Outage }) {
  const i18n = useI18n();
  const summary = pickTranslation(props.outage as any, 'summary', i18n.preferredLanguageCodes);
  const badges = outageBadges(props.outage, i18n.t);
  const dotVariant = dotVariantFromBadgeVariant(badges.primaryVariant);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <StatusDot variant={dotVariant} ariaLabel={badges.lifecycle.label} />
        <div className="font-medium">
          <Link to={`/outages/${props.outage.id}`} className="hover:underline">
            {summary ?? i18n.t('public.outage.fallback_title', { id: props.outage.id })}
          </Link>
        </div>
        <Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge>
      </div>
      <div className="text-xs text-muted">
        {i18n.t('public.outage.field.begins')}: {formatDateTime(props.outage.begins_at)}
        {props.outage.finished_at
          ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(props.outage.finished_at as any)}`
          : null}
      </div>
    </div>
  );
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
    <div className="space-y-6" data-testid="public.overview.page">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <StatusLandingMark className="text-accent/80" title={i18n.t('public.overview.title')} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('public.overview.title')}</h1>
          <p className="mt-1 text-sm text-muted">{i18n.t('public.overview.subtitle')}</p>
        </div>
      </div>

      {showSessionExpired ? (
        <Alert title={i18n.t('auth.session_expired.title')} variant="warn" testId="auth.session-expired.notice">
          {i18n.t('auth.session_expired.body')}
        </Alert>
      ) : null}

      {outagesByCategory.current.length > 0 ? (
        <Alert title={i18n.tc('public.overview.outage_alert.title', outagesByCategory.current.length)} variant="danger">
          {i18n.tc('public.overview.outage_alert.body', outagesByCategory.current.length)}
          <span className="ml-2">
            <Link to="/outages" className="underline">
              {i18n.t('public.overview.outage_alert.link')}
            </Link>
          </span>
        </Alert>
      ) : (
        <Alert title={i18n.t('public.overview.nominal.title')} variant="info">
          {i18n.t('public.overview.nominal.body')}
        </Alert>
      )}

      {ipv4Level === 'critical' ? (
        <Alert title={i18n.t('public.overview.ipv4_critical.title')} variant="danger" testId="public.ipv4.alert">
          {i18n.t('public.overview.ipv4_critical.body', { count: ipv4Left ?? 0 })}
        </Alert>
      ) : null}

      <SummaryGrid testId="public.summary-grid">
        <div className="md:col-span-6">
          <StatCard
            testId="public.stats.members"
            variant="featured"
            title={i18n.t('public.overview.stats.members.title')}
            subtitle={i18n.t('public.overview.stats.members.subtitle')}
            value={
              statsQ.isLoading ? (
                <span className="text-muted">…</span>
              ) : statsQ.isError ? (
                '—'
              ) : (
                statsQ.data?.user_count ?? '—'
              )
            }
          />
        </div>

        <div className="md:col-span-3">
          <StatCard
            testId="public.stats.nodes"
            title={i18n.t('public.overview.stats.nodes.title')}
            subtitle={i18n.t('public.overview.stats.nodes.subtitle')}
            value={
              nodesQ.isLoading ? (
                <span className="text-muted">…</span>
              ) : nodesQ.isError ? (
                '—'
              ) : nodeSummary.total > 0 ? (
                `${Math.round((nodeSummary.ok / nodeSummary.total) * 100)}%`
              ) : (
                '—'
              )
            }
            footer={
              nodesQ.isLoading || nodesQ.isError
                ? null
                : nodeSummary.total > 0
                  ? i18n.t('public.overview.stats.nodes.footer', {
                      ok: nodeSummary.ok,
                      down: nodeSummary.down,
                      total: nodeSummary.total,
                    })
                  : i18n.t('public.overview.stats.nodes.footer.none')
            }
            visual={
              nodesQ.isLoading || nodesQ.isError || nodeSummary.total <= 0 ? null : (
                <GaugeRing
                  ariaLabel={i18n.t('public.overview.stats.nodes.gauge_aria')}
                  value={nodeSummary.ok}
                  max={nodeSummary.total}
                  variant={nodeSummary.down > 0 ? 'danger' : 'ok'}
                  center={`${Math.round((nodeSummary.ok / nodeSummary.total) * 100)}%`}
                />
              )
            }
          />
        </div>

        <div className="md:col-span-3">
          <StatCard
            testId="public.stats.vps"
            title={i18n.t('public.overview.stats.vps.title')}
            subtitle={i18n.t('public.overview.stats.vps.subtitle')}
            value={
              statsQ.isLoading ? (
                <span className="text-muted">…</span>
              ) : statsQ.isError ? (
                '—'
              ) : (
                statsQ.data?.vps_count ?? '—'
              )
            }
            footer={
              <span className="inline-flex items-center gap-2">
                <span>{i18n.t('public.overview.stats.vps.ipv4_free')}</span>
                <Badge variant={ipv4BadgeVariant}>
                  {ipv4Left == null ? '—' : ipv4Left}
                </Badge>
                {ipv4Level === 'warn' ? (
                  <span className="hidden sm:inline text-warn">{i18n.t('public.overview.ipv4_warn.hint')}</span>
                ) : null}
              </span>
            }
          />
        </div>
      </SummaryGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <CardBody>
            {outagesQ.isLoading ? (
              <Spinner label={i18n.t('public.overview.outages.loading')} />
            ) : outagesQ.isError ? (
              <Alert title={i18n.t('public.overview.outages.error')} variant="danger" />
            ) : (outagesQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.overview.outages.empty')}</div>
            ) : (
              <div className="space-y-4">
                <StackedBar
                  ariaLabel={i18n.t('public.overview.outages.distribution_aria')}
                  segments={[
                    {
                      value: outagesByCategory.current.length,
                      variant: 'danger',
                      title: i18n.t('public.overview.outages.segment.ongoing'),
                    },
                    {
                      value: outagesByCategory.planned.length,
                      variant: 'warn',
                      title: i18n.t('public.overview.outages.segment.planned'),
                    },
                    {
                      value: outagesByCategory.resolved.length,
                      variant: 'ok',
                      title: i18n.t('public.overview.outages.segment.resolved'),
                    },
                    {
                      value: outagesByCategory.unknown.length,
                      variant: 'neutral',
                      title: i18n.t('public.overview.outages.segment.other'),
                    },
                  ]}
                />

                {outagesByCategory.current.slice(0, 3).map((o) => (
                  <OutageSummary key={o.id} outage={o} />
                ))}

                {outagesByCategory.current.length === 0 && outagesByCategory.planned.slice(0, 3).map((o) => (
                  <OutageSummary key={o.id} outage={o} />
                ))}

                {outagesByCategory.current.length === 0 && outagesByCategory.planned.length === 0 && outagesByCategory.resolved.slice(0, 3).map((o) => (
                  <OutageSummary key={o.id} outage={o} />
                ))}
              </div>
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
          <CardBody>
            {newsQ.isLoading ? (
              <Spinner label={i18n.t('public.overview.news.loading')} />
            ) : newsQ.isError ? (
              <Alert title={i18n.t('public.overview.news.error')} variant="danger" />
            ) : (newsQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.overview.news.empty')}</div>
            ) : (
              <div className="space-y-3">
                {newsQ.data?.slice(0, 5).map((n) => (
                  <div key={n.id} className="space-y-1">
                    <div className="text-xs text-muted">{formatDateTime(n.published_at)}</div>
                    <div className="text-sm whitespace-pre-wrap">{n.message}</div>
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
          <CardBody>
          {nodesQ.isLoading ? (
            <Spinner label={i18n.t('public.overview.nodes.loading')} />
          ) : nodesQ.isError ? (
            <Alert title={i18n.t('public.overview.nodes.error')} variant="danger" />
          ) : nodesByLocation.length === 0 ? (
            <div className="text-sm text-muted">{i18n.t('public.overview.nodes.empty')}</div>
          ) : (
            <div className="space-y-6">
              {nodesByLocation.map(([loc, g], idx) => {
                // Mobile default expansion rules:
                // - groups with down nodes: expanded
                // - otherwise: first group expanded
                const openMobile = g.down > 0 || (nodeSummary.down === 0 && idx === 0);

                const header = (
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{loc}</div>
                    <div className="flex items-center gap-3">
                      <div className="w-24">
                        <StackedBar
                          ariaLabel={i18n.t('public.overview.nodes.location_bar_aria', { location: loc })}
                          segments={[
                            { value: g.ok, variant: 'ok', title: i18n.t('state.up') },
                            { value: g.down, variant: 'danger', title: i18n.t('state.down') },
                          ]}
                        />
                      </div>
                      <div className="text-xs text-muted">
                        {i18n.t('public.overview.nodes.location_summary', { ok: g.ok, down: g.down, total: g.total })}
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div key={loc} className="space-y-2">
                    {/* Mobile: cards + accordion (avoid horizontal scroll) */}
                    <details className="rounded-lg border border-border bg-surface md:hidden" open={openMobile}>
                      <summary className="cursor-pointer select-none px-3 py-2">{header}</summary>
                      <div className="space-y-2 p-3 pt-0">
                        {g.nodes.map((n: any) => (
                          <div key={n.name} className="rounded-md border border-border bg-surface-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">{n.name}</div>
                              {n.status ? <Badge variant="ok">{i18n.t('state.up')}</Badge> : <Badge variant="danger">{i18n.t('state.down')}</Badge>}
                            </div>
                            <div className="mt-2 text-xs text-muted">{i18n.t('public.overview.nodes.last_report')}: {formatDateTime(n.last_report)}</div>
                            <div className="mt-1 text-xs text-muted">
                              {i18n.t('public.overview.nodes.vps')}: {typeof n.vps_count === 'number' ? n.vps_count : '—'}
                              {typeof n.vps_free === 'number' ? ` · ${i18n.t('public.overview.nodes.vps_free', { count: n.vps_free })}` : null}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {i18n.t('public.overview.nodes.cpu_idle')}: {typeof n.cpu_idle === 'number' ? `${n.cpu_idle.toFixed(1)}%` : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Desktop: dense table */}
                    <div className="hidden space-y-2 md:block">
                      {header}
                      <div className="overflow-auto rounded-lg border border-border">
                        <Table minWidth="md" testId={`public.nodes.table.${loc}`}>
                          <thead className="bg-surface-2 text-left text-xs text-muted">
                            <tr>
                              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.node')}</th>
                              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.status')}</th>
                              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.last_report')}</th>
                              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.vps')}</th>
                              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.cpu_idle')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.nodes.map((n: any) => (
                              <tr key={n.name} className="border-t border-border" data-row-variant={n.status ? undefined : 'danger'}>
                                <td className="px-3 py-2 font-medium">{n.name}</td>
                                <td className="px-3 py-2">
                                  {n.status ? <Badge variant="ok">{i18n.t('state.up')}</Badge> : <Badge variant="danger">{i18n.t('state.down')}</Badge>}
                                </td>
                                <td className="px-3 py-2 text-muted">{formatDateTime(n.last_report)}</td>
                                <td className="px-3 py-2 text-muted">
                                  {typeof n.vps_count === 'number' ? n.vps_count : '—'}
                                  {typeof n.vps_free === 'number'
                                    ? ` · ${i18n.t('public.overview.nodes.vps_free', { count: n.vps_free })}`
                                    : null}
                                </td>
                                <td className="px-3 py-2 text-muted">
                                  {typeof n.cpu_idle === 'number' ? `${n.cpu_idle.toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

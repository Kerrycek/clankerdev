import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchNews,
  fetchOutages,
  fetchPublicNodeStatus,
  fetchPublicStats,
} from '../../lib/api/public';
import type { Outage, PublicNodeStatus } from '../../lib/api/public';
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
import { StatusDot } from '../../components/ui/StatusDot';
import { outageBadges } from '../../lib/outageBadges';
import { dotVariantFromBadgeVariant } from '../../lib/variantMap';
import { fetchSecurityAdvisoriesWithCves } from '../../lib/api/securityAdvisories';
import { SecurityAdvisoryRow } from './SecurityAdvisoriesPage';
import { useTierSlowIntervalMs } from '../../lib/refreshTiers';

type PublicNodeLocationGroup = {
  ok: number;
  down: number;
  total: number;
  nodes: PublicNodeStatus[];
};

function nodeDisplayName(node: PublicNodeStatus): string {
  return String(node.name || node.fqdn || node.type || 'node');
}

function nodeSortKey(node: PublicNodeStatus): string {
  return nodeDisplayName(node).toLocaleLowerCase();
}

function nodeTestIdKey(node: PublicNodeStatus, index: number): string {
  return nodeDisplayName(node)
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || String(index);
}

function formatPublicNodeVps(node: PublicNodeStatus, t: ReturnType<typeof useI18n>['t']): string {
  const total = typeof node.vps_count === 'number' && Number.isFinite(node.vps_count) ? node.vps_count : undefined;
  const free = typeof node.vps_free === 'number' && Number.isFinite(node.vps_free) ? node.vps_free : undefined;

  if (total === undefined) return t('common.na');
  if (free === undefined) return String(total);
  return `${total} · ${t('public.overview.nodes.vps_free', { count: free })}`;
}

function formatPublicNodeCpuIdle(node: PublicNodeStatus, t: ReturnType<typeof useI18n>['t']): string {
  return typeof node.cpu_idle === 'number' && Number.isFinite(node.cpu_idle) ? `${node.cpu_idle}%` : t('common.na');
}

function PublicNodeCard(props: { node: PublicNodeStatus; index: number }) {
  const i18n = useI18n();
  const node = props.node;
  const isUp = node.status === true;
  const statusLabel = i18n.t(isUp ? 'state.up' : 'state.down');

  return (
    <article
      className="rounded-lg border border-border bg-surface p-3"
      data-testid={`public.node.row.${nodeTestIdKey(node, props.index)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot variant={isUp ? 'ok' : 'danger'} ariaLabel={statusLabel} />
            <h3 className="truncate text-sm font-medium">{nodeDisplayName(node)}</h3>
          </div>
          {node.fqdn && node.fqdn !== node.name ? <div className="mt-1 truncate text-xs text-muted">{node.fqdn}</div> : null}
        </div>
        <Badge variant={isUp ? 'ok' : 'danger'}>{statusLabel}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted">{i18n.t('public.overview.nodes.last_report')}</dt>
          <dd className="mt-0.5 text-fg">{node.last_report ? formatDateTime(node.last_report) : i18n.t('common.na')}</dd>
        </div>
        <div>
          <dt className="text-muted">{i18n.t('public.overview.nodes.vps')}</dt>
          <dd className="mt-0.5 text-fg">{formatPublicNodeVps(node, i18n.t)}</dd>
        </div>
        <div>
          <dt className="text-muted">{i18n.t('public.overview.nodes.cpu_idle')}</dt>
          <dd className="mt-0.5 text-fg">{formatPublicNodeCpuIdle(node, i18n.t)}</dd>
        </div>
      </dl>
    </article>
  );
}

function OutageSummary(props: { outage: Outage }) {
  const i18n = useI18n();
  const summary = pickTranslation(props.outage as LegacyAny, 'summary', i18n.preferredLanguageCodes);
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
          ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(props.outage.finished_at as LegacyAny)}`
          : null}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const i18n = useI18n();
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const tierSlowRefetchMs = useTierSlowIntervalMs();
  const [searchParams] = useSearchParams();
  const showSessionExpired = searchParams.get('session') === 'expired';

  const unknownLocationLabel = i18n.t('public.nodes.location_unknown');

  const statsQ = useQuery({
    queryKey: ['cluster', 'public_stats'],
    queryFn: async () => (await fetchPublicStats()).data,
    refetchInterval: tierSlowRefetchMs,
  });

  const nodesQ = useQuery({
    queryKey: ['nodes', 'public_status'],
    queryFn: async () => (await fetchPublicNodeStatus()).data,
    refetchInterval: tierSlowRefetchMs,
  });

  const outagesQ = useQuery({
    queryKey: ['outages', 'index'],
    queryFn: async () => (await fetchOutages()).data,
    refetchInterval: tierSlowRefetchMs,
  });

  const newsQ = useQuery({
    queryKey: ['news_logs', 'index'],
    queryFn: async () => (await fetchNews()).data,
    refetchInterval: tierSlowRefetchMs,
  });

  const securityQ = useQuery({
    queryKey: ['security_advisories', 'public', 'overview'],
    queryFn: async () => (
      await fetchSecurityAdvisoriesWithCves({
        limit: 5,
        state: 'published',
        order: 'newest',
      })
    ).data,
    refetchInterval: tierSlowRefetchMs,
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
    const groups: Record<string, PublicNodeLocationGroup> = {};

    const nodesList: PublicNodeStatus[] = Array.isArray(nodesQ.data)
      ? (nodesQ.data as PublicNodeStatus[])
      : (((nodesQ.data as LegacyAny) && (nodesQ.data as LegacyAny).nodes) ? (nodesQ.data as LegacyAny).nodes : []);

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

    for (const group of Object.values(groups)) {
      group.nodes.sort((a, b) => {
        const stateDiff = Number(a.status === true) - Number(b.status === true);
        if (stateDiff !== 0) return stateDiff;
        return nodeSortKey(a).localeCompare(nodeSortKey(b));
      });
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
    statsQ.data && typeof (statsQ.data as LegacyAny).ipv4_left === 'number'
      ? Number((statsQ.data as LegacyAny).ipv4_left)
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        <div data-testid="public.security.card">
          <Card>
          <CardHeader
            title={i18n.t('public.overview.security.title')}
            subtitle={i18n.t('public.overview.security.subtitle')}
            actions={<Link to="/security-advisories" className="text-sm underline">{i18n.t('public.overview.security.all')}</Link>}
          />
          <CardBody>
            {securityQ.isLoading ? (
              <Spinner label={i18n.t('public.overview.security.loading')} />
            ) : securityQ.isError ? (
              <Alert title={i18n.t('public.overview.security.error')} variant="danger" />
            ) : (securityQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.overview.security.empty')}</div>
            ) : (
              <div className="space-y-3">
                {securityQ.data?.slice(0, 3).map((advisory) => (
                  <SecurityAdvisoryRow key={advisory.id} advisory={advisory} compact />
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

      <Card testId="public.nodes.section">
        <CardHeader
          title={i18n.t('public.overview.nodes.title')}
          subtitle={i18n.t('public.overview.nodes.subtitle')}
        />
        <CardBody>
          {nodesQ.isLoading ? (
            <Spinner label={i18n.t('public.overview.nodes.loading')} />
          ) : nodesQ.isError ? (
            <Alert title={i18n.t('public.overview.nodes.error')} variant="danger" />
          ) : nodesByLocation.length === 0 ? (
            <div className="text-sm text-muted">{i18n.t('public.overview.nodes.empty')}</div>
          ) : (
            <div className="space-y-3">
              {nodesByLocation.map(([location, group], locationIndex) => {
                const hasProblem = group.down > 0;
                const detailsOpen = hasProblem || locationIndex === 0;

                return (
                  <details
                    key={location}
                    open={detailsOpen}
                    className="rounded-lg border border-border bg-surface-2"
                    data-testid={`public.nodes.location.${locationIndex}`}
                  >
                    <summary className="cursor-pointer list-none p-4 marker:hidden">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-semibold">{location}</h2>
                            {hasProblem ? (
                              <Badge variant="danger">{i18n.t('state.down')}: {group.down}</Badge>
                            ) : (
                              <Badge variant="ok">{i18n.t('state.up')}</Badge>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {i18n.t('public.overview.nodes.location_summary', {
                              ok: group.ok,
                              down: group.down,
                              total: group.total,
                            })}
                          </div>
                        </div>
                        <StackedBar
                          className="md:w-48 md:shrink-0"
                          ariaLabel={i18n.t('public.overview.nodes.location_bar_aria', { location })}
                          segments={[
                            { value: group.ok, variant: 'ok', title: i18n.t('state.up') },
                            { value: group.down, variant: 'danger', title: i18n.t('state.down') },
                          ]}
                        />
                      </div>
                    </summary>

                    <div className="border-t border-border p-4">
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {group.nodes.map((node, nodeIndex) => (
                          <PublicNodeCard key={`${nodeDisplayName(node)}-${nodeIndex}`} node={node} index={nodeIndex} />
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

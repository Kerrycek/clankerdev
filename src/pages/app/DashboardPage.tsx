import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../app/appMode';
import { useAuth } from '../../app/auth';
import { useI18n } from '../../app/i18n';
import { useObjectScope } from '../../app/objectScope';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageHeader } from '../../components/layout/PageHeader';
import { SummaryGrid } from '../../components/layout/SummaryGrid';
import { LinkButton } from '../../components/ui/LinkButton';
import { StatCard } from '../../components/ui/StatCard';
import { GaugeRing } from '../../components/ui/GaugeRing';

import { fetchActiveTransactionChains } from '../../lib/api/transactions';
import { fetchVpsList } from '../../lib/api/vps';
import { fetchDatasets } from '../../lib/api/datasets';
import { fetchDnsZones } from '../../lib/api/dns';
import { getMetaTotalCount } from '../../lib/api/haveapi';
import { useTierAIntervalMs } from '../../lib/refreshTiers';

function countRunning(vpses: any[]): { running: number; stopped: number; unknown: number } {
  let running = 0;
  let stopped = 0;
  let unknown = 0;

  for (const vps of vpses) {
    if ((vps as any).is_running === true) running += 1;
    else if ((vps as any).is_running === false) stopped += 1;
    else unknown += 1;
  }

  return { running, stopped, unknown };
}

async function fetchAllVpsesForSummary(opts: { user?: number; maxItems?: number }) {
  const limit = 200;
  const maxItems = opts.maxItems ?? 1000;

  let fromId: number | undefined = undefined;
  let items: any[] = [];
  let totalCount: number | undefined = undefined;

  // Keyset pagination: keep fetching pages until we either exhaust the list or hit maxItems.
  for (let i = 0; i < 50; i++) {
    const res = await fetchVpsList({ limit, fromId, user: opts.user });
    if (totalCount === undefined) {
      totalCount = getMetaTotalCount(res.meta) ?? res.data.length;
    }

    const page = res.data ?? [];
    if (page.length === 0) break;

    items = items.concat(page);
    if (items.length >= maxItems) {
      items = items.slice(0, maxItems);
      break;
    }

    const last = page[page.length - 1];
    const lastId = typeof (last as any)?.id === 'number' ? (last as any).id : undefined;
    if (!lastId || page.length < limit) break;

    // Defensive: prevent infinite loops in case the backend returns a stable last id.
    if (fromId === lastId) break;
    fromId = lastId;
  }

  const truncated = totalCount !== undefined && items.length < totalCount;

  return { items, totalCount, truncated };
}

export function DashboardPage() {
  const auth = useAuth();
  const { basePath } = useAppMode();
  const scope = useObjectScope();
  const { t } = useI18n();

  const tierARefetchMs = useTierAIntervalMs();

  const mineUserId = scope.mineUserId;

  const vpsQ = useQuery({
    queryKey: ['dashboard', 'vps_summary', { user: mineUserId ?? null }],
    queryFn: async () => fetchAllVpsesForSummary({ user: mineUserId, maxItems: 1000 }),
  });

  const datasetsQ = useQuery({
    queryKey: ['dashboard', 'datasets_count', { user: mineUserId ?? null }],
    queryFn: async () => {
      const res = await fetchDatasets({ limit: 1, user: mineUserId });
      return { totalCount: getMetaTotalCount(res.meta) ?? res.data.length };
    },
  });

  const dnsZonesQ = useQuery({
    queryKey: ['dashboard', 'dns_zones_count', { user: mineUserId ?? null }],
    queryFn: async () => {
      const res = await fetchDnsZones({ limit: 1, user: mineUserId });
      return { totalCount: getMetaTotalCount(res.meta) ?? res.data.length };
    },
  });

  const activeChainsQ = useQuery({
    queryKey: ['dashboard', 'transaction_chains', 'active', { userId: mineUserId ?? null }],
    queryFn: async () => fetchActiveTransactionChains({ limit: 100, userId: mineUserId }),
    refetchInterval: tierARefetchMs,
  });

  const runningCounts = useMemo(() => countRunning(vpsQ.data?.items ?? []), [vpsQ.data]);
  const vpsTotalCount = vpsQ.data?.totalCount ?? (vpsQ.data ? vpsQ.data.items.length : undefined);
  const vpsRunningCount = runningCounts.running;
  const vpsStoppedCount = runningCounts.stopped;
  const vpsUnknownCount = runningCounts.unknown;
  const vpsTruncated = vpsQ.data?.truncated === true;

  const activeChainsCount = activeChainsQ.data?.length ?? 0;
  const datasetsCount = datasetsQ.data?.totalCount;
  const dnsZonesCount = dnsZonesQ.data?.totalCount;

  const signedInMeta = auth.user
    ? t('dashboard.signed_in_as', { login: auth.user.login, role: auth.role })
    : t('dashboard.signed_in');

  const vpsCountsComplete = !vpsTruncated;
  const vpsRatio = vpsTotalCount && vpsTotalCount > 0 ? vpsRunningCount / vpsTotalCount : 0;
  const vpsRatioLabel = vpsCountsComplete && vpsTotalCount && vpsTotalCount > 0 ? `${Math.round(vpsRatio * 100)}%` : '—';

  return (
    <PageContainer testId="app.dashboard.page">
      <div className="space-y-6">
        <PageHeader
          testId="app.dashboard.header"
          title={t('nav.dashboard')}
          description={t('dashboard.description')}
          meta={signedInMeta}
        />

        <SummaryGrid testId="app.dashboard.summary-grid">
          <div className="md:col-span-6">
            <StatCard
              testId="app.dashboard.kpi.vps"
              variant="featured"
              title={t('nav.vps')}
              subtitle={t('dashboard.kpi.scope_hint')}
              value={vpsQ.isLoading ? '…' : vpsQ.isError ? '—' : vpsTotalCount ?? '—'}
              footer={
                vpsQ.isLoading || vpsQ.isError ? null : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>
                      {t('state.running')}: <span className="font-medium text-fg">{vpsRunningCount}</span>
                    </span>
                    <span className="text-faint">·</span>
                    <span>
                      {t('state.stopped')}: <span className="font-medium text-fg">{vpsStoppedCount}</span>
                    </span>
                    {vpsUnknownCount > 0 ? (
                      <>
                        <span className="text-faint">·</span>
                        <span>
                          {t('state.unknown')}: <span className="font-medium text-fg">{vpsUnknownCount}</span>
                        </span>
                      </>
                    ) : null}
                    {vpsTruncated ? (
                      <>
                        <span className="text-faint">·</span>
                        <span className="text-faint">{t('dashboard.kpi.vps.partial_counts', { n: vpsQ.data?.items.length ?? 0 })}</span>
                      </>
                    ) : null}
                  </span>
                )
              }
              visual={
                vpsCountsComplete && vpsTotalCount !== undefined && vpsTotalCount > 0 && !vpsQ.isLoading && !vpsQ.isError ? (
                  <GaugeRing
                    ariaLabel={t('dashboard.kpi.vps.running_ratio')}
                    value={vpsRunningCount}
                    max={vpsTotalCount}
                    center={vpsRatioLabel}
                    size="md"
                  />
                ) : null
              }
              actions={
                <LinkButton to={`${basePath}/vps`} variant="secondary" size="sm" testId="app.dashboard.kpi.vps.open">
                  {t('common.open')}
                </LinkButton>
              }
            />
          </div>

          <div className="md:col-span-2">
            <StatCard
              testId="app.dashboard.kpi.tasks"
              title={t('nav.transactions')}
              subtitle={t('dashboard.kpi.active_operations')}
              value={activeChainsQ.isLoading ? '…' : activeChainsQ.isError ? '—' : activeChainsCount}
              actions={
                <LinkButton
                  to={`${basePath}/transactions`}
                  variant="secondary"
                  size="sm"
                  testId="app.dashboard.kpi.tasks.open"
                >
                  {t('common.open')}
                </LinkButton>
              }
            />
          </div>

          <div className="md:col-span-2">
            <StatCard
              testId="app.dashboard.kpi.datasets"
              title={t('nav.datasets')}
              subtitle={t('dashboard.kpi.scope_hint')}
              value={datasetsQ.isLoading ? '…' : datasetsQ.isError ? '—' : datasetsCount}
              actions={
                <LinkButton
                  to={`${basePath}/datasets`}
                  variant="secondary"
                  size="sm"
                  testId="app.dashboard.kpi.datasets.open"
                >
                  {t('common.open')}
                </LinkButton>
              }
            />
          </div>

          <div className="md:col-span-2">
            <StatCard
              testId="app.dashboard.kpi.dns"
              title={t('nav.dns')}
              subtitle={t('dashboard.kpi.scope_hint')}
              value={dnsZonesQ.isLoading ? '…' : dnsZonesQ.isError ? '—' : dnsZonesCount}
              actions={
                <LinkButton
                  to={`${basePath}/dns`}
                  variant="secondary"
                  size="sm"
                  testId="app.dashboard.kpi.dns.open"
                >
                  {t('common.open')}
                </LinkButton>
              }
            />
          </div>
        </SummaryGrid>
      </div>
    </PageContainer>
  );
}

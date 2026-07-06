import React from 'react';

import { useI18n } from '../../app/i18n';
import { SummaryGrid } from '../../components/layout/SummaryGrid';
import { Badge } from '../../components/ui/Badge';
import { GaugeRing } from '../../components/ui/GaugeRing';
import { StatCard } from '../../components/ui/StatCard';
import type { PublicClusterStats } from '../../lib/api/public';
import type { BadgeVariant } from '../../lib/taskStatus';
import type { PublicIpv4Level, PublicNodeSummary } from './OverviewModel';

function loadingValue(loading: boolean, error: boolean, value: React.ReactNode): React.ReactNode {
  if (loading) return <span className="text-muted">…</span>;
  if (error) return '—';
  return value;
}

export function OverviewSummaryCards(props: {
  stats?: PublicClusterStats;
  statsLoading: boolean;
  statsError: boolean;
  nodesLoading: boolean;
  nodesError: boolean;
  nodeSummary: PublicNodeSummary;
  ipv4Left: number | null;
  ipv4Level: PublicIpv4Level;
  ipv4BadgeVariant: BadgeVariant;
}) {
  const i18n = useI18n();
  const nodePercent = props.nodeSummary.total > 0 ? Math.round((props.nodeSummary.ok / props.nodeSummary.total) * 100) : null;

  return (
    <SummaryGrid testId="public.summary-grid">
      <div className="md:col-span-6">
        <StatCard
          testId="public.stats.members"
          variant="featured"
          title={i18n.t('public.overview.stats.members.title')}
          subtitle={i18n.t('public.overview.stats.members.subtitle')}
          value={loadingValue(props.statsLoading, props.statsError, props.stats?.user_count ?? '—')}
        />
      </div>

      <div className="md:col-span-3">
        <StatCard
          testId="public.stats.nodes"
          title={i18n.t('public.overview.stats.nodes.title')}
          subtitle={i18n.t('public.overview.stats.nodes.subtitle')}
          value={loadingValue(props.nodesLoading, props.nodesError, nodePercent == null ? '—' : `${nodePercent}%`)}
          footer={
            props.nodesLoading || props.nodesError
              ? null
              : props.nodeSummary.total > 0
                ? i18n.t('public.overview.stats.nodes.footer', {
                    ok: props.nodeSummary.ok,
                    down: props.nodeSummary.down,
                    total: props.nodeSummary.total,
                  })
                : i18n.t('public.overview.stats.nodes.footer.none')
          }
          visual={
            props.nodesLoading || props.nodesError || nodePercent == null ? null : (
              <GaugeRing
                ariaLabel={i18n.t('public.overview.stats.nodes.gauge_aria')}
                value={props.nodeSummary.ok}
                max={props.nodeSummary.total}
                variant={props.nodeSummary.down > 0 ? 'danger' : 'ok'}
                center={`${nodePercent}%`}
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
          value={loadingValue(props.statsLoading, props.statsError, props.stats?.vps_count ?? '—')}
          footer={
            <span className="inline-flex items-center gap-2">
              <span>{i18n.t('public.overview.stats.vps.ipv4_free')}</span>
              <Badge variant={props.ipv4BadgeVariant}>{props.ipv4Left == null ? '—' : props.ipv4Left}</Badge>
              {props.ipv4Level === 'warn' ? (
                <span className="hidden text-warn sm:inline">{i18n.t('public.overview.ipv4_warn.hint')}</span>
              ) : null}
            </span>
          }
        />
      </div>
    </SummaryGrid>
  );
}

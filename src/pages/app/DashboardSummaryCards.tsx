import { useI18n } from '../../app/i18n';
import type { DashboardDensity } from '../../app/dashboardSettingsModel';
import { SummaryGrid } from '../../components/layout/SummaryGrid';
import { GaugeRing } from '../../components/ui/GaugeRing';
import { LinkButton } from '../../components/ui/LinkButton';
import { StatCard } from '../../components/ui/StatCard';

export function formatDashboardNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat().format(value);
}

export function DashboardSummaryCards(props: {
  basePath: string;
  density: DashboardDensity;
  vps: {
    isLoading: boolean;
    isError: boolean;
    totalCount?: number;
    runningCount: number;
    stoppedCount: number;
    unknownCount: number;
    truncated: boolean;
    loadedItemsCount: number;
  };
  datasets: {
    isLoading: boolean;
    isError: boolean;
    totalCount?: number;
  };
  dns: {
    isLoading: boolean;
    isError: boolean;
    totalCount?: number;
  };
}) {
  const { t } = useI18n();
  const compact = props.density === 'compact';
  const vpsCountsComplete = !props.vps.truncated;
  const vpsTotalCount = props.vps.totalCount;
  const vpsRatio = vpsTotalCount && vpsTotalCount > 0 ? props.vps.runningCount / vpsTotalCount : 0;
  const vpsRatioLabel = vpsCountsComplete && vpsTotalCount && vpsTotalCount > 0 ? `${Math.round(vpsRatio * 100)}%` : '—';

  return (
    <SummaryGrid testId="app.dashboard.summary-grid">
      <div className={compact ? 'md:col-span-4' : 'md:col-span-6'}>
        <StatCard
          testId="app.dashboard.kpi.vps"
          variant={compact ? 'standard' : 'featured'}
          title={t('nav.vps')}
          subtitle={t('dashboard.kpi.scope_hint')}
          value={props.vps.isLoading ? '…' : props.vps.isError ? '—' : formatDashboardNumber(vpsTotalCount)}
          footer={
            props.vps.isLoading || props.vps.isError ? null : (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>
                  {t('state.running')}:{' '}
                  <span className="font-medium text-fg">{formatDashboardNumber(props.vps.runningCount)}</span>
                </span>
                <span className="text-faint">·</span>
                <span>
                  {t('state.stopped')}:{' '}
                  <span className="font-medium text-fg">{formatDashboardNumber(props.vps.stoppedCount)}</span>
                </span>
                {props.vps.unknownCount > 0 ? (
                  <>
                    <span className="text-faint">·</span>
                    <span>
                      {t('state.unknown')}:{' '}
                      <span className="font-medium text-fg">{formatDashboardNumber(props.vps.unknownCount)}</span>
                    </span>
                  </>
                ) : null}
                {props.vps.truncated ? (
                  <>
                    <span className="text-faint">·</span>
                    <span className="text-faint">
                      {t('dashboard.kpi.vps.partial_counts', {
                        n: props.vps.loadedItemsCount,
                      })}
                    </span>
                  </>
                ) : null}
              </span>
            )
          }
          visual={
            vpsCountsComplete && vpsTotalCount !== undefined && vpsTotalCount > 0 && !props.vps.isLoading && !props.vps.isError ? (
              <GaugeRing
                ariaLabel={t('dashboard.kpi.vps.running_ratio')}
                value={props.vps.runningCount}
                max={vpsTotalCount}
                center={vpsRatioLabel}
                size={compact ? 'sm' : 'md'}
              />
            ) : null
          }
          actions={
            <LinkButton to={`${props.basePath}/vps`} variant="secondary" size="sm" testId="app.dashboard.kpi.vps.open">
              {t('common.open')}
            </LinkButton>
          }
        />
      </div>

      <div className={compact ? 'md:col-span-4' : 'md:col-span-3'}>
        <StatCard
          testId="app.dashboard.kpi.datasets"
          variant={compact ? 'compact' : 'standard'}
          title={t('nav.datasets')}
          subtitle={t('dashboard.kpi.scope_hint')}
          value={props.datasets.isLoading ? '…' : props.datasets.isError ? '—' : formatDashboardNumber(props.datasets.totalCount)}
          actions={
            <LinkButton to={`${props.basePath}/datasets`} variant="secondary" size="sm" testId="app.dashboard.kpi.datasets.open">
              {t('common.open')}
            </LinkButton>
          }
        />
      </div>

      <div className={compact ? 'md:col-span-4' : 'md:col-span-3'}>
        <StatCard
          testId="app.dashboard.kpi.dns"
          variant={compact ? 'compact' : 'standard'}
          title={t('nav.dns')}
          subtitle={t('dashboard.kpi.scope_hint')}
          value={props.dns.isLoading ? '…' : props.dns.isError ? '—' : formatDashboardNumber(props.dns.totalCount)}
          actions={
            <LinkButton to={`${props.basePath}/dns`} variant="secondary" size="sm" testId="app.dashboard.kpi.dns.open">
              {t('common.open')}
            </LinkButton>
          }
        />
      </div>
    </SummaryGrid>
  );
}

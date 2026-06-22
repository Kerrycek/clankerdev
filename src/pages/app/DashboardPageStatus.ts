import type { Alert } from '../../components/ui/Alert';

type AlertVariant = Parameters<typeof Alert>[0]['variant'];

type Translate = (key: string, vars?: Record<string, unknown>) => string;

export function DashboardOperationalSummary(opts: {
  t: Translate;
  outagesLoading: boolean;
  outagesError: boolean;
  nodesLoading: boolean;
  nodesError: boolean;
  currentOutageCount: number;
  nodeDownCount: number;
  nodeMaintenanceCount: number;
}): { variant: AlertVariant; title: string; body: string } {
  if (opts.outagesLoading || opts.nodesLoading) {
    return {
      variant: 'neutral',
      title: opts.t('dashboard.alert.loading.title'),
      body: opts.t('dashboard.alert.loading.body'),
    };
  }

  if (opts.outagesError || opts.nodesError) {
    return {
      variant: 'warn',
      title: opts.t('dashboard.alert.partial.title'),
      body: opts.t('dashboard.alert.partial.body'),
    };
  }

  if (opts.currentOutageCount > 0) {
    return {
      variant: 'danger',
      title: opts.t('dashboard.alert.outage.title', { count: opts.currentOutageCount }),
      body: opts.t('dashboard.alert.outage.body', { count: opts.currentOutageCount }),
    };
  }

  if (opts.nodeDownCount > 0) {
    return {
      variant: 'danger',
      title: opts.t('dashboard.alert.nodes_down.title', { count: opts.nodeDownCount }),
      body: opts.t('dashboard.alert.nodes_down.body', { count: opts.nodeDownCount }),
    };
  }

  if (opts.nodeMaintenanceCount > 0) {
    return {
      variant: 'warn',
      title: opts.t('dashboard.alert.maintenance.title', { count: opts.nodeMaintenanceCount }),
      body: opts.t('dashboard.alert.maintenance.body', { count: opts.nodeMaintenanceCount }),
    };
  }

  return {
    variant: 'ok',
    title: opts.t('dashboard.alert.nominal.title'),
    body: opts.t('dashboard.alert.nominal.body'),
  };
}

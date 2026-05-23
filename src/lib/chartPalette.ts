export type ChartSeriesVariant =
  | 'muted'
  | 'accent'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'info'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'netIn'
  | 'netOut'
  | 'ioRead'
  | 'ioWrite'
  | 'errors';

export type ChartThresholdVariant = 'warn' | 'danger' | 'info' | 'ok' | 'neutral';

export function seriesColorClass(v: ChartSeriesVariant): string {
  // NOTE: for charts we prefer the locked chart palette over semantic tokens
  // (semantic tokens intentionally differ between light/dark themes).
  switch (v) {
    case 'accent':
    case 'netOut':
    case 'ioWrite':
      return 'text-chart-orange';

    case 'ok':
    case 'netIn':
      return 'text-chart-green';

    case 'warn':
      return 'text-chart-amber';

    case 'danger':
    case 'errors':
      return 'text-chart-red';

    case 'info':
    case 'cpu':
    case 'ioRead':
      return 'text-chart-blue';

    case 'memory':
      return 'text-chart-purple';

    case 'disk':
      return 'text-chart-teal';

    case 'muted':
    default:
      return 'text-chart-axis';
  }
}

export function thresholdColorClass(v?: ChartThresholdVariant): string {
  switch (v) {
    case 'danger':
      return 'text-chart-red';
    case 'warn':
      return 'text-chart-amber';
    case 'ok':
      return 'text-chart-green';
    case 'info':
      return 'text-chart-blue';
    case 'neutral':
    default:
      return 'text-chart-axis';
  }
}

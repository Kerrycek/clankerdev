import type { MonitoredEventState } from './api/monitoring';
import type { TableRowVariant } from '../components/ui/TableRowLink';
import type { BadgeVariant } from './variantMap';

export function monitoredEventRowVariant(state: MonitoredEventState | undefined): TableRowVariant {
  switch (String(state ?? '')) {
    case 'confirmed':
      return 'danger';
    case 'monitoring':
      return 'warn';
    case 'unconfirmed':
      return 'info';
    case 'acknowledged':
      return 'warn';
    case 'ignored':
      return 'muted';
    case 'closed':
      return 'ok';
    default:
      return 'neutral';
  }
}

export function monitoredEventBadgeVariant(state: MonitoredEventState | undefined): BadgeVariant {
  switch (String(state ?? '')) {
    case 'confirmed':
      return 'danger';
    case 'monitoring':
      return 'warn';
    case 'unconfirmed':
      return 'info';
    case 'acknowledged':
      return 'warn';
    case 'ignored':
      return 'neutral';
    case 'closed':
      return 'ok';
    default:
      return 'neutral';
  }
}

export function monitoredEventStateLabelKey(state: MonitoredEventState | undefined): string | null {
  switch (String(state ?? '')) {
    case 'monitoring':
      return 'monitoring.state.monitoring';
    case 'confirmed':
      return 'monitoring.state.confirmed';
    case 'unconfirmed':
      return 'monitoring.state.unconfirmed';
    case 'acknowledged':
      return 'monitoring.state.acknowledged';
    case 'ignored':
      return 'monitoring.state.ignored';
    case 'closed':
      return 'monitoring.state.closed';
    default:
      return null;
  }
}

export function isMonitoredEventAckable(state: MonitoredEventState | undefined): boolean {
  return ['confirmed', 'acknowledged', 'ignored'].includes(String(state ?? ''));
}

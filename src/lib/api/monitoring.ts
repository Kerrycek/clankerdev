import { expectArray, haveApiCall } from './haveapi';

export interface ResourceRef {
  id: number;
  label?: string;
  login?: string;
  [k: string]: unknown;
}

export type MonitoredEventState =
  | 'monitoring'
  | 'confirmed'
  | 'unconfirmed'
  | 'acknowledged'
  | 'ignored'
  | 'closed'
  | string;

export interface MonitoredEvent {
  id: number;
  monitor?: string;
  label?: string;
  issue?: string;
  object_name?: string;
  object_id?: number;
  state?: MonitoredEventState;
  user?: ResourceRef;
  created_at?: string;
  updated_at?: string;
  duration?: number;
  saved_until?: string | null;
  [k: string]: unknown;
}

export type MonitoredEventOrder = 'oldest' | 'latest' | 'longest' | 'shortest';

export async function fetchMonitoredEvents(opts?: {
  limit?: number;
  fromId?: number;
  fromDuration?: number;
  order?: MonitoredEventOrder;
  monitor?: string;
  objectName?: string;
  objectId?: number;
  state?: string;
  userId?: number;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.order) params['order'] = opts.order;
  if (opts?.monitor) params['monitor'] = opts.monitor;
  if (opts?.objectName) params['object_name'] = opts.objectName;
  if (opts?.objectId !== undefined) params['object_id'] = opts.objectId;
  if (opts?.state) params['state'] = opts.state;
  // Legacy monitored_event#index rejects user; admin list applies it client-side.
  void opts?.userId;

  // Cursor depends on order.
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.fromDuration !== undefined) params['from_duration'] = opts.fromDuration;

  const res = await haveApiCall<MonitoredEvent[]>({
    method: 'GET',
    path: '/monitored_events',
    namespace: 'monitored_event',
    params,
    meta: { includes: 'user' },
  });

  return { ...res, data: expectArray<MonitoredEvent>(res.data, 'monitored_events#index') };
}

export async function fetchMonitoredEvent(eventId: number) {
  return haveApiCall<MonitoredEvent>({
    method: 'GET',
    path: `/monitored_events/${eventId}`,
  });
}

export async function acknowledgeMonitoredEvent(eventId: number, opts?: { until?: string }) {
  return haveApiCall<void>({
    method: 'POST',
    path: `/monitored_events/${eventId}/acknowledge`,
    namespace: 'monitored_event',
    params: opts?.until ? { until: opts.until } : {},
  });
}

export async function ignoreMonitoredEvent(eventId: number, opts?: { until?: string }) {
  return haveApiCall<void>({
    method: 'POST',
    path: `/monitored_events/${eventId}/ignore`,
    namespace: 'monitored_event',
    params: opts?.until ? { until: opts.until } : {},
  });
}

export interface MonitoredEventLog {
  id: number;
  passed?: boolean;
  value?: unknown;
  created_at?: string;
  [k: string]: unknown;
}

export type MonitoredEventLogOrder = 'oldest' | 'latest';

export async function fetchMonitoredEventLogs(eventId: number, opts?: {
  limit?: number;
  fromId?: number;
  order?: MonitoredEventLogOrder;
  passed?: boolean;
}) {
  const params: Record<string, unknown> = {};
  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.order) params['order'] = opts.order;
  if (opts?.passed !== undefined) params['passed'] = opts.passed;

  const res = await haveApiCall<MonitoredEventLog[]>({
    method: 'GET',
    path: `/monitored_events/${eventId}/logs`,
    namespace: 'log',
    params,
  });

  return { ...res, data: expectArray<MonitoredEventLog>(res.data, `monitored_events/${eventId}/logs#index`) };
}

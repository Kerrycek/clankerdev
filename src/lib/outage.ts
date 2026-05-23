import type { Outage } from './api/public';

export type OutageCategory = 'current' | 'planned' | 'resolved' | 'unknown';

export function categorizeOutage(o: Outage, now = new Date()): OutageCategory {
  const state = typeof o.state === 'string' ? o.state : undefined;

  if (state === 'resolved' || o.finished_at) return 'resolved';

  if (o.begins_at) {
    const begins = new Date(o.begins_at);
    if (!Number.isNaN(begins.getTime()) && begins.getTime() > now.getTime()) {
      return 'planned';
    }
    return 'current';
  }

  return 'unknown';
}

export function sortOutagesNewestFirst(a: Outage, b: Outage): number {
  const at = a.begins_at ? new Date(a.begins_at).getTime() : 0;
  const bt = b.begins_at ? new Date(b.begins_at).getTime() : 0;
  return bt - at;
}

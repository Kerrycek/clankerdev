import type { TableRowVariant } from '../components/ui/TableRowLink';
import type { BadgeVariant } from './requestsBadges';
import type { ObjectHistoryEvent } from './api/audit';

export function eventVariant(eventType: string | undefined): TableRowVariant | undefined {
  const t = String(eventType ?? '').toLowerCase();
  if (!t) return undefined;

  // Exception tinting: only highlight “important” classes so the table stays scannable.
  if (t.includes('delete') || t.includes('destroy') || t.includes('remove') || t.includes('revoke')) return 'danger';
  if (t.includes('create') || t.includes('add') || t.includes('grant')) return 'ok';
  if (t.includes('deny') || t.includes('fail')) return 'warn';
  return undefined;
}

export function eventBadgeVariant(eventType: string | undefined): BadgeVariant {
  const v = eventVariant(eventType);
  if (v === 'danger') return 'danger';
  if (v === 'ok') return 'ok';
  if (v === 'warn') return 'warn';
  return 'neutral';
}

export function eventDataSummary(ev: ObjectHistoryEvent): string {
  const d = (ev as any).event_data;
  if (!d) return '';
  if (typeof d !== 'object') return String(d);
  const keys = Object.keys(d as any);
  if (keys.length === 0) return '';
  const head = keys.slice(0, 3).join(', ');
  return keys.length > 3 ? `${head}, …` : head;
}

export function userLabel(ev: ObjectHistoryEvent, na: string): string {
  const u = (ev as any).user;
  if (!u) return na;
  if (typeof u === 'string') return u || na;
  if (typeof u === 'number') return `#${u}`;
  if (typeof u === 'object') {
    const login = typeof u.login === 'string' && u.login ? u.login : undefined;
    const id = typeof u.id === 'number' ? u.id : undefined;
    if (login && id) return `${login} (#${id})`;
    if (login) return login;
    if (id) return `#${id}`;
  }
  return na;
}

export function sessionLabel(ev: ObjectHistoryEvent, na: string): string {
  const s = (ev as any).user_session;
  if (!s) return na;
  if (typeof s === 'string') return s || na;
  if (typeof s === 'number') return `#${s}`;
  if (typeof s === 'object') {
    const ip = typeof s.api_ip_addr === 'string' && s.api_ip_addr ? s.api_ip_addr : undefined;
    const id = typeof s.id === 'number' ? s.id : undefined;
    if (ip && id) return `${ip} (#${id})`;
    if (ip) return ip;
    if (id) return `#${id}`;
  }
  return na;
}

export function trackedObjectLabel(ev: ObjectHistoryEvent, na: string): string {
  const obj = typeof (ev as any).object === 'string' ? String((ev as any).object).trim() : '';
  const id = typeof (ev as any).object_id === 'number' ? (ev as any).object_id : undefined;
  if (obj && id) return `${obj} #${id}`;
  if (obj) return obj;
  if (id) return `#${id}`;
  return na;
}

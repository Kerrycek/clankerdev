import { describe, expect, test, vi } from 'vitest';

import { fetchMonitoredEvents } from './monitoring';

function mockFetchOk(response: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchUrl() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  const [url] = calls[calls.length - 1] as [string, RequestInit?];
  return new URL(url);
}

describe('monitoring API wrappers', () => {
  test('fetchMonitoredEvents omits unsupported user filter', async () => {
    globalThis.fetch = mockFetchOk({ monitored_events: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchMonitoredEvents({ limit: 25, fromId: 30, order: 'latest', monitor: 'ping', objectName: 'Vps', objectId: 12, state: 'confirmed', userId: 7 });

    const u = lastFetchUrl();
    expect(u.pathname).toBe('/v7.0/monitored_events');
    expect(u.searchParams.get('monitored_event[limit]')).toBe('25');
    expect(u.searchParams.get('monitored_event[from_id]')).toBe('30');
    expect(u.searchParams.get('monitored_event[order]')).toBe('latest');
    expect(u.searchParams.get('monitored_event[monitor]')).toBe('ping');
    expect(u.searchParams.get('monitored_event[object_name]')).toBe('Vps');
    expect(u.searchParams.get('monitored_event[object_id]')).toBe('12');
    expect(u.searchParams.get('monitored_event[state]')).toBe('confirmed');
    expect(u.searchParams.get('monitored_event[user]')).toBeNull();
  });
});

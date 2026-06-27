import { describe, expect, test, vi } from 'vitest';

import { fetchObjectHistoryEvents } from './audit';

function mockFetchOk(response: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchUrl() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  const [url] = calls[calls.length - 1] as [string, RequestInit?];
  return new URL(url);
}

describe('audit API wrappers', () => {
  test('fetchObjectHistoryEvents omits unsupported user filter', async () => {
    globalThis.fetch = mockFetchOk({ object_histories: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchObjectHistoryEvents({ limit: 10, fromId: 20, q: 'login', userId: 7, userSessionId: 8, object: 'User', objectId: 7, eventType: 'update' });

    const u = lastFetchUrl();
    expect(u.pathname).toBe('/v7.0/object_histories');
    expect(u.searchParams.get('object_history[limit]')).toBe('10');
    expect(u.searchParams.get('object_history[from_id]')).toBe('20');
    expect(u.searchParams.get('object_history[q]')).toBe('login');
    expect(u.searchParams.get('object_history[user]')).toBeNull();
    expect(u.searchParams.get('object_history[user_session]')).toBe('8');
    expect(u.searchParams.get('object_history[object]')).toBe('User');
    expect(u.searchParams.get('object_history[object_id]')).toBe('7');
    expect(u.searchParams.get('object_history[event_type]')).toBe('update');
  });
});

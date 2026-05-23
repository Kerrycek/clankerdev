import { describe, expect, test, vi } from 'vitest';

import { fetchNodes } from './nodes';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

describe('nodes API wrappers', () => {
  test('fetchNodes forwards q, state, limit, and from_id', async () => {
    globalThis.fetch = mockFetchOk({ nodes: [{ id: 12, name: 'node12' }], _meta: { total_count: 1 } }) as any;

    const res = await fetchNodes({ q: 'node12', state: 'inactive', limit: 25, fromId: 400 });

    expect(res.data).toEqual([{ id: 12, name: 'node12' }]);

    const [url] = (globalThis.fetch as any).mock.calls[0];
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/nodes');
    expect(u.searchParams.get('node[q]')).toBe('node12');
    expect(u.searchParams.get('node[state]')).toBe('inactive');
    expect(u.searchParams.get('node[limit]')).toBe('25');
    expect(u.searchParams.get('node[from_id]')).toBe('400');
  });
});

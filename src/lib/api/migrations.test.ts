import { describe, expect, test, vi } from 'vitest';

import { fetchMigrationPlans } from './migrations';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

describe('migrations API wrappers', () => {
  test('fetchMigrationPlans forwards q, state, user, limit, and from_id', async () => {
    globalThis.fetch = mockFetchOk({ migration_plans: [{ id: 33, state: 'staged' }], _meta: { total_count: 1 } }) as any;

    const res = await fetchMigrationPlans({ q: 'Drain node', state: 'staged', userId: 44, limit: 10, fromId: 90 });

    expect(res.data).toEqual([{ id: 33, state: 'staged' }]);

    const [url] = (globalThis.fetch as any).mock.calls.find(([u]: [string]) => new URL(u).pathname.endsWith('/migration_plans'));
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/migration_plans');
    expect(u.searchParams.get('migration_plan[q]')).toBe('Drain node');
    expect(u.searchParams.get('migration_plan[state]')).toBe('staged');
    expect(u.searchParams.get('migration_plan[user]')).toBe('44');
    expect(u.searchParams.get('migration_plan[limit]')).toBe('10');
    expect(u.searchParams.get('migration_plan[from_id]')).toBe('90');
  });
});

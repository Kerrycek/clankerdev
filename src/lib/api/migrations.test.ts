import { describe, expect, test, vi } from 'vitest';

import { fetchMigrationPlans } from './migrations';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

describe('migrations API wrappers', () => {
  test('fetchMigrationPlans forwards only filters supported by the migration-plan index', async () => {
    globalThis.fetch = mockFetchOk({ migration_plans: [{ id: 33, state: 'staged' }], _meta: { total_count: 1 } }) as any;

    const res = await fetchMigrationPlans({
      state: 'staged',
      userId: 44,
      limit: 10,
      fromId: 90,
      // Exercise a stale runtime caller while the public type rejects q.
      q: 'Drain node',
    } as Parameters<typeof fetchMigrationPlans>[0] & { q: string });

    expect(res.data).toEqual([{ id: 33, state: 'staged' }]);

    const [url] = (globalThis.fetch as any).mock.calls.find(([u]: [string]) => new URL(u).pathname.endsWith('/migration_plans'));
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/migration_plans');
    expect(u.searchParams.has('migration_plan[q]')).toBe(false);
    expect(u.searchParams.get('migration_plan[state]')).toBe('staged');
    expect(u.searchParams.get('migration_plan[user]')).toBe('44');
    expect(u.searchParams.get('migration_plan[limit]')).toBe('10');
    expect(u.searchParams.get('migration_plan[from_id]')).toBe('90');
    expect([...u.searchParams.keys()].sort()).toEqual(
      [
        'migration_plan[from_id]',
        'migration_plan[limit]',
        'migration_plan[state]',
        'migration_plan[user]',
      ].sort()
    );
  });
});

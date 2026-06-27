import { describe, expect, test, vi } from 'vitest';

import { fetchOomReports } from './oom';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('oom API wrappers', () => {
  test('fetchOomReports forwards q and supported filters only', async () => {
    globalThis.fetch = mockFetchOk({ oom_reports: [], _meta: { total_count: 0 } }) as LegacyAny;

    await fetchOomReports({
      limit: 50,
      fromId: 999,
      q: 'cgroup:/user',
      vpsId: 7,
      userId: 42,
      nodeId: 3,
      locationId: 4,
      environmentId: 5,
      ruleId: 6,
      cgroup: '/user.slice/demo',
      sinceIso: '2026-03-01T00:00:00Z',
      untilIso: '2026-03-02T00:00:00Z',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/oom_reports');
    expect(u.searchParams.get('oom_report[limit]')).toBe('50');
    expect(u.searchParams.get('oom_report[from_id]')).toBe('999');
    expect(u.searchParams.get('oom_report[q]')).toBe('cgroup:/user');
    expect(u.searchParams.get('oom_report[vps]')).toBe('7');
    expect(u.searchParams.get('oom_report[user]')).toBeNull();
    expect(u.searchParams.get('oom_report[node]')).toBe('3');
    expect(u.searchParams.get('oom_report[location]')).toBe('4');
    expect(u.searchParams.get('oom_report[environment]')).toBe('5');
    expect(u.searchParams.get('oom_report[oom_report_rule]')).toBe('6');
    expect(u.searchParams.get('oom_report[cgroup]')).toBe('/user.slice/demo');
    expect(u.searchParams.get('oom_report[since]')).toBe('2026-03-01T00:00:00Z');
    expect(u.searchParams.get('oom_report[until]')).toBe('2026-03-02T00:00:00Z');
  });
});

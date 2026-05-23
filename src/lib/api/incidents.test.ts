import { describe, expect, test, vi } from 'vitest';

import { fetchIncidentReports } from './incidents';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as any).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('incident API wrappers', () => {
  test('fetchIncidentReports forwards q and structured filters', async () => {
    globalThis.fetch = mockFetchOk({ incident_reports: [], _meta: { total_count: 0 } }) as any;

    await fetchIncidentReports({
      limit: 20,
      fromId: 300,
      q: 'abuse',
      userId: 42,
      vpsId: 7,
      ipAddressAssignmentId: 55,
      ipAddr: '203.0.113.10',
      mailboxId: 9,
      filedById: 1,
      codename: 'scan',
    });

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/incident_reports');
    expect(u.searchParams.get('incident_report[limit]')).toBe('20');
    expect(u.searchParams.get('incident_report[from_id]')).toBe('300');
    expect(u.searchParams.get('incident_report[q]')).toBe('abuse');
    expect(u.searchParams.get('incident_report[user]')).toBe('42');
    expect(u.searchParams.get('incident_report[vps]')).toBe('7');
    expect(u.searchParams.get('incident_report[ip_address_assignment]')).toBe('55');
    expect(u.searchParams.get('incident_report[ip_addr]')).toBe('203.0.113.10');
    expect(u.searchParams.get('incident_report[mailbox]')).toBe('9');
    expect(u.searchParams.get('incident_report[filed_by]')).toBe('1');
    expect(u.searchParams.get('incident_report[codename]')).toBe('scan');
  });
});

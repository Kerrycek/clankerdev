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
  test('fetchIncidentReports forwards exactly the supported structured filters', async () => {
    globalThis.fetch = mockFetchOk({ incident_reports: [], _meta: { total_count: 0 } }) as any;

    const optsWithUnsupportedProperties = {
      limit: 20,
      fromId: 300,
      q: 'abuse',
      subject: 'must not be sent by the index wrapper',
      userId: 42,
      vpsId: 7,
      ipAddressAssignmentId: 55,
      ipAddr: ' 203.0.113.10 ',
      mailboxId: 9,
      filedById: 1,
      codename: ' scan ',
      includes: 'user,vps,ip_address_assignment,filed_by,mailbox',
    };

    await fetchIncidentReports(optsWithUnsupportedProperties);

    const [url] = lastFetchCall();
    const u = new URL(url);

    expect(u.pathname).toBe('/v7.0/incident_reports');
    expect([...u.searchParams.entries()].sort()).toEqual(
      [
        ['_meta[includes]', 'user,vps,ip_address_assignment,filed_by,mailbox'],
        ['incident_report[codename]', 'scan'],
        ['incident_report[filed_by]', '1'],
        ['incident_report[from_id]', '300'],
        ['incident_report[ip_addr]', '203.0.113.10'],
        ['incident_report[ip_address_assignment]', '55'],
        ['incident_report[limit]', '20'],
        ['incident_report[mailbox]', '9'],
        ['incident_report[user]', '42'],
        ['incident_report[vps]', '7'],
      ].sort(),
    );
    expect(u.searchParams.has('incident_report[q]')).toBe(false);
    expect(u.searchParams.has('incident_report[subject]')).toBe(false);
  });
});

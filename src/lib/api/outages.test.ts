import { describe, expect, test, vi } from 'vitest';

import {
  createOutage,
  createOutageEntity,
  createOutageHandler,
  createOutageUpdate,
  deleteOutageEntity,
  deleteOutageHandler,
  fetchAdminOutages,
  rebuildOutageAffectedVps,
  updateOutage,
} from './outages';
import { addNetworkAddresses } from './networks';

function mockFetchOk(response: any) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as any).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('outage admin API wrappers', () => {
  test('fetchAdminOutages forwards legacy filters through the outage namespace', async () => {
    globalThis.fetch = mockFetchOk({ outages: [{ id: 7 }] }) as any;

    await fetchAdminOutages({ state: 'announced', type: 'outage', handledBy: 42, vps: 101, limit: 25, fromId: 900 });

    const [url] = lastFetchCall();
    const u = new URL(url);
    expect(u.pathname).toBe('/v7.0/outages');
    expect(u.searchParams.get('outage[state]')).toBe('announced');
    expect(u.searchParams.get('outage[type]')).toBe('outage');
    expect(u.searchParams.get('outage[handled_by]')).toBe('42');
    expect(u.searchParams.get('outage[vps]')).toBe('101');
    expect(u.searchParams.get('outage[limit]')).toBe('25');
    expect(u.searchParams.get('outage[from_id]')).toBe('900');
  });

  test('create and update outage use the outage namespace payload', async () => {
    globalThis.fetch = mockFetchOk({ outage: { id: 7 } }) as any;

    await createOutage({
      begins_at: '2026-05-28T10:00:00.000Z',
      duration: 30,
      type: 'maintenance',
      impact: 'network',
      auto_resolve: true,
      en_summary: 'Maintenance',
    });

    let [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      outage: {
        begins_at: '2026-05-28T10:00:00.000Z',
        duration: 30,
        type: 'maintenance',
        impact: 'network',
        auto_resolve: true,
        en_summary: 'Maintenance',
      },
    });

    await updateOutage(7, { finished_at: '2026-05-28T11:00:00.000Z', auto_resolve: false });
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      outage: {
        finished_at: '2026-05-28T11:00:00.000Z',
        auto_resolve: false,
      },
    });
  });

  test('entity and handler wrappers match nested outage contracts', async () => {
    globalThis.fetch = mockFetchOk({ entity: { id: 3 }, handler: { id: 4 } }) as any;

    await createOutageEntity(7, { name: 'Node', entity_id: 12 });
    let [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7/entities');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ entity: { name: 'Node', entity_id: 12 } });

    await deleteOutageEntity(7, 3);
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7/entities/3');
    expect(init?.method).toBe('DELETE');

    await createOutageHandler(7, { user: 42 });
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7/handlers');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ handler: { user: 42 } });

    await deleteOutageHandler(7, 4);
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7/handlers/4');
    expect(init?.method).toBe('DELETE');
  });

  test('outage updates and rebuild use legacy endpoints', async () => {
    globalThis.fetch = mockFetchOk({ outage_update: { id: 8 }, outage: { id: 7 } }) as any;

    await createOutageUpdate({ outage: 7, state: 'resolved', send_mail: true, en_summary: 'Resolved' });
    let [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outage_updates');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      outage_update: {
        outage: 7,
        state: 'resolved',
        send_mail: true,
        en_summary: 'Resolved',
      },
    });

    await rebuildOutageAffectedVps(7);
    [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/outages/7/rebuild_affected_vps');
    expect(init?.method).toBe('POST');
  });
});

describe('network add addresses API wrapper', () => {
  test('addNetworkAddresses posts network#add_addresses payload', async () => {
    globalThis.fetch = mockFetchOk({ network: { count: 4 } }) as any;

    await addNetworkAddresses({ id: 22, count: 4, user: 7, environment: 2 });

    const [url, init] = lastFetchCall();
    expect(new URL(url).pathname).toBe('/v7.0/networks/22/add_addresses');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      network: {
        count: 4,
        user: 7,
        environment: 2,
      },
    });
  });
});

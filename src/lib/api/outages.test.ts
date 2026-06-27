import { describe, expect, test, vi } from 'vitest';

import {
  applyOutageSystems,
  createOutage,
  createOutageWithSystems,
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

function mockFetchOkSequence(responses: any[]) {
  const queue = [...responses];
  return vi.fn().mockImplementation(async () => {
    const response = queue.shift() ?? {};
    return { ok: true, json: async () => ({ status: true, response }) };
  });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('outage admin API wrappers', () => {
  test('fetchAdminOutages forwards legacy filters through the outage namespace', async () => {
    globalThis.fetch = mockFetchOk({ outages: [{ id: 7 }] }) as LegacyAny;

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
    globalThis.fetch = mockFetchOk({ outage: { id: 7 } }) as LegacyAny;

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
    globalThis.fetch = mockFetchOk({ entity: { id: 3 }, handler: { id: 4 } }) as LegacyAny;

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
    globalThis.fetch = mockFetchOk({ outage_update: { id: 8 }, outage: { id: 7 } }) as LegacyAny;

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

  test('createOutageWithSystems creates the report, applies initial entities and handlers, and rebuilds', async () => {
    globalThis.fetch = mockFetchOkSequence([
      { outage: { id: 7 } },
      { entity: { id: 3 } },
      { entity: { id: 4 } },
      { handler: { id: 5 } },
      { outage: { id: 7 } },
    ]) as LegacyAny;

    await createOutageWithSystems(
      {
        begins_at: '2026-05-28T10:00:00.000Z',
        duration: 30,
        type: 'maintenance',
        impact: 'network',
        en_summary: 'Maintenance',
        cs_summary: 'Udrzba',
      },
      {
        entities: [
          { name: 'Environment', entity_id: 2 },
          { name: 'Node', entity_id: 12 },
        ],
        handlers: [42],
      }
    );

    const calls = (globalThis.fetch as LegacyAny).mock.calls as Array<[string, RequestInit?]>;
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/v7.0/outages',
      '/v7.0/outages/7/entities',
      '/v7.0/outages/7/entities',
      '/v7.0/outages/7/handlers',
      '/v7.0/outages/7/rebuild_affected_vps',
    ]);
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ entity: { name: 'Environment', entity_id: 2 } });
    expect(JSON.parse(String(calls[2]?.[1]?.body))).toEqual({ entity: { name: 'Node', entity_id: 12 } });
    expect(JSON.parse(String(calls[3]?.[1]?.body))).toEqual({ handler: { user: 42 } });
  });

  test('applyOutageSystems diffs current systems and handlers before rebuild', async () => {
    globalThis.fetch = mockFetchOk({ entity: { id: 9 }, handler: { id: 8 }, outage: { id: 7 } }) as LegacyAny;

    await applyOutageSystems(
      7,
      [
        { id: 1, name: 'Environment', entity_id: 2 },
        { id: 2, name: 'Node', entity_id: 10 },
      ],
      [
        { id: 4, user: { id: 42 } } as LegacyAny,
        { id: 5, user_id: 99 } as LegacyAny,
      ],
      {
        entities: [
          { name: 'Environment', entity_id: 2 },
          { name: 'Node', entity_id: 12 },
        ],
        handlers: [42, 100],
      }
    );

    const calls = (globalThis.fetch as LegacyAny).mock.calls as Array<[string, RequestInit?]>;
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/v7.0/outages/7/entities',
      '/v7.0/outages/7/entities/2',
      '/v7.0/outages/7/handlers',
      '/v7.0/outages/7/handlers/5',
      '/v7.0/outages/7/rebuild_affected_vps',
    ]);
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ entity: { name: 'Node', entity_id: 12 } });
    expect(calls[1]?.[1]?.method).toBe('DELETE');
    expect(JSON.parse(String(calls[2]?.[1]?.body))).toEqual({ handler: { user: 100 } });
    expect(calls[3]?.[1]?.method).toBe('DELETE');
  });
});

describe('network add addresses API wrapper', () => {
  test('addNetworkAddresses posts network#add_addresses payload', async () => {
    globalThis.fetch = mockFetchOk({ network: { count: 4 } }) as LegacyAny;

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

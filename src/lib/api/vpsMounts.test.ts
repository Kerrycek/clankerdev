import { describe, expect, test, vi } from 'vitest';

import { updateVpsMount } from './vpsMounts';

function mockFetchOk(response: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response }) });
}

function lastFetchCall() {
  const calls = (globalThis.fetch as LegacyAny).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit?];
}

describe('vps mount API wrappers', () => {
  test('updateVpsMount strips unsupported master_enabled', async () => {
    globalThis.fetch = mockFetchOk({ mount: { id: 5 } }) as LegacyAny;

    await updateVpsMount(12, 5, { enabled: true, master_enabled: false, mountpoint: '/data' });

    const [url, init] = lastFetchCall();
    const body = JSON.parse(String(init?.body));

    expect(new URL(url).pathname).toBe('/v7.0/vpses/12/mounts/5');
    expect(init?.method).toBe('PUT');
    expect(body).toEqual({ mount: { enabled: true, mountpoint: '/data' } });
  });
});

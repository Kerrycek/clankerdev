import { describe, expect, test, vi } from 'vitest';

import { fetchSystemConfigs } from './systemConfig';

function mockFetchOk(response: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: true, response }),
  }) as unknown as typeof globalThis.fetch;
}

describe('system config API wrappers', () => {
  test('scopes index requests to an API-supported category', async () => {
    globalThis.fetch = mockFetchOk({ system_configs: [] }) as any;

    await fetchSystemConfigs({ category: ' plugin_payments ' });

    const [url] = vi.mocked(globalThis.fetch).mock.calls.at(-1) as [string, RequestInit?];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe('/v7.0/system_configs');
    expect(requestUrl.searchParams.get('system_config[category]')).toBe('plugin_payments');
  });

  test('keeps the full index request unchanged when no category is requested', async () => {
    globalThis.fetch = mockFetchOk({ system_configs: [] }) as any;

    await fetchSystemConfigs();

    const [url] = vi.mocked(globalThis.fetch).mock.calls.at(-1) as [string, RequestInit?];
    expect(new URL(url).searchParams.has('system_config[category]')).toBe(false);
  });
});

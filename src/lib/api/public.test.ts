import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNews, fetchOutages, fetchPublicStats } from './public';

function makeOkResponse(response: unknown) {
  return new Response(JSON.stringify({ status: true, response }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch() {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const href = String(url);

    if (href.endsWith('/cluster/public_stats')) {
      return makeOkResponse({ public_stats: { user_count: 1, vps_count: 2, ipv4_left: 3 } });
    }

    if (href.includes('/outages?')) {
      return makeOkResponse({ outages: [] });
    }

    if (href.includes('/news_logs?')) {
      return makeOkResponse({ news_logs: [] });
    }

    throw new Error(`unexpected fetch ${href}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.vpsAdmin = undefined;
});

describe('public API helpers', () => {
  it('loads public data without downloading the HaveAPI description', async () => {
    window.vpsAdmin = {
      api: { url: 'https://api.example.test', version: 'v7.0' },
    };
    const fetchMock = installFetch();

    await fetchPublicStats();
    await fetchOutages({ limit: 25 });
    await fetchNews({ limit: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      'https://api.example.test/v7.0/cluster/public_stats',
      'https://api.example.test/v7.0/outages?outage%5Blimit%5D=25',
      'https://api.example.test/v7.0/news_logs?news_log%5Blimit%5D=5',
    ]);

    expect(urls.some((url) => url === 'https://api.example.test/v7.0' || url === 'https://api.example.test/v7.0/')).toBe(false);
    expect(urls.some((url) => url === 'https://api.example.test' || url === 'https://api.example.test/')).toBe(false);
  });
});

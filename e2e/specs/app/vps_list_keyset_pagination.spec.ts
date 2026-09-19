import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function makeVps(id: number, ownerId: number) {
  return {
    id,
    hostname: `vps${id}.example`,
    object_state: id === 48 ? 'suspended' : 'active',
    is_running: id === 49 ? false : id % 2 === 0,
    node: { id: 7, domain_name: 'node7.example', location: { id: 2, label: 'Prague' } },
    user: { id: ownerId, login: `owner${ownerId}` },
    user_namespace_map: { id: 3 },
    cpus: (id % 4) + 1,
    memory: 1024 + (id % 8) * 256,
    diskspace: 10240 + (id % 10) * 1024,
    used_memory: 256 + (id % 4) * 128,
    used_diskspace: 1024 + (id % 6) * 512,
    uptime: id % 2 === 0 ? 12345 : 0,
    loadavg1: 0.1,
  };
}

async function setupVpsListApi(
  page: Page,
  options?: { user?: { id: number; login: string; level: number } }
) {
  const user = options?.user ?? { id: 1, login: 'test', level: 1 };
  const vpses = Array.from({ length: 100 }, (_, index) => makeVps(index + 1, user.id));
  const requests: Array<{ url: URL; responseCount: number }> = [];
  let availableMaxId = 100;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET vpses': ({ searchParams }) => {
        const url = new URL(`https://api.example.test/vpses?${searchParams.toString()}`);
        const fromId = Number(searchParams.get('vps[from_id]') ?? 0);
        const limit = Number(searchParams.get('vps[limit]') ?? 50);
        const hostnameNeedle = (searchParams.get('vps[hostname_any]') ?? '').toLowerCase();
        const userId = Number(searchParams.get('vps[user]')) || undefined;
        const nodeId = Number(searchParams.get('vps[node]')) || undefined;
        const locationId = Number(searchParams.get('vps[location]')) || undefined;
        const namespaceMapId = Number(searchParams.get('vps[user_namespace_map]')) || undefined;
        let matches = vpses.filter((vps) => vps.id <= availableMaxId);
        if (user.level < 100) matches = matches.filter((vps) => vps.user.id === user.id);
        if (hostnameNeedle) {
          matches = matches.filter((vps) => vps.hostname.toLowerCase().includes(hostnameNeedle));
        }
        if (userId !== undefined) matches = matches.filter((vps) => vps.user.id === userId);
        if (nodeId !== undefined) matches = matches.filter((vps) => vps.node.id === nodeId);
        if (locationId !== undefined) matches = matches.filter((vps) => vps.node.location.id === locationId);
        if (namespaceMapId !== undefined) {
          matches = matches.filter((vps) => vps.user_namespace_map.id === namespaceMapId);
        }

        const totalCount = matches.length;
        const data = matches.filter((vps) => vps.id > fromId).slice(0, limit);
        requests.push({ url, responseCount: data.length });
        return {
          vpses: data,
          _meta: { total_count: totalCount },
        };
      },
    },
  });

  return {
    requests,
    setAvailableMaxId(id: number) {
      availableMaxId = id;
    },
  };
}

function paginationPrefix(testInfo: TestInfo) {
  return testInfo.project.name === 'mobile-chrome' ? 'vps.pagination.mobile' : 'vps.pagination.desktop';
}

function vpsSurface(page: Page, testInfo: TestInfo, id: number) {
  return page.getByTestId(testInfo.project.name === 'mobile-chrome' ? `vps.card.${id}` : `vps.row.${id}`);
}

test.describe('@smoke VPS list keyset pagination', () => {
  test('@pr-smoke @pr-smoke-mobile follows the ascending API cursor, stops at the terminal page and preserves forward history', async ({
    page,
  }, testInfo) => {
    const api = await setupVpsListApi(page);
    const pagination = paginationPrefix(testInfo);

    await page.goto('/app/vps');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 50)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 51)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();
    await expect.poll(() => api.requests[0]?.url.searchParams.get('vps[limit]')).toBe('51');
    expect(api.requests[0]?.url.searchParams.get('vps[user]')).toBeNull();

    if (testInfo.project.name !== 'mobile-chrome') {
      await expect(vpsSurface(page, testInfo, 49)).toHaveAttribute('data-row-variant', 'danger');
      await expect(page.getByTestId('vps.row.49.dot')).toBeVisible();
      await expect(vpsSurface(page, testInfo, 48)).toHaveAttribute('data-row-variant', 'warn');
    }

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=50/);
    await expect(page).toHaveURL(/page=2/);
    await expect(vpsSurface(page, testInfo, 50)).toHaveCount(0);
    await expect(vpsSurface(page, testInfo, 51)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 100)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect(page.getByTestId(`${pagination}.prev`)).toBeEnabled();

    await page.getByTestId(`${pagination}.prev`).click();

    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();

    // Model a credible live change: page-two VPSes disappear after they were
    // visited, while the remembered forward edge remains available.
    api.setAvailableMaxId(50);
    await page.reload();

    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 50)).toBeVisible();
    await expect.poll(() => api.requests.at(-1)?.responseCount).toBe(50);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=50/);
    await expect(page.getByTestId('vps.list.empty')).toBeVisible();
    await expect(page.getByTestId('vps.list.empty.action')).toBeEnabled();
  });

  test('@pr-smoke @pr-smoke-mobile respects URL from_id on initial load without a page-one flash request', async ({ page }, testInfo) => {
    const api = await setupVpsListApi(page);

    await page.goto('/app/vps?limit=50&page=2&from_id=50');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(vpsSurface(page, testInfo, 51)).toBeVisible();

    expect(api.requests.length).toBeGreaterThan(0);
    expect(api.requests[0]?.url.searchParams.get('vps[from_id]')).toBe('50');
    expect(api.requests.some(({ url }) => url.searchParams.get('vps[from_id]') === null)).toBe(false);
  });

  test('@pr-smoke @pr-smoke-mobile resets cursor stack on filter change before requesting filtered VPSes', async ({ page }, testInfo) => {
    const api = await setupVpsListApi(page);
    const pagination = paginationPrefix(testInfo);

    await page.goto('/app/vps');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();

    await page.getByTestId(`${pagination}.next`).click();
    await expect(page).toHaveURL(/from_id=50/);
    await expect(vpsSurface(page, testInfo, 51)).toBeVisible();

    api.requests.length = 0;
    await page.getByTestId('vps.smart_filter.input').fill('vps1.example');
    await page.getByTestId('vps.smart_filter.input').press('Enter');
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);

    await expect.poll(() =>
      api.requests.some(({ url }) => url.searchParams.get('vps[hostname_any]') === 'vps1.example')
    ).toBe(true);
    const filteredRequests = api.requests.filter(
      ({ url }) => url.searchParams.get('vps[hostname_any]') === 'vps1.example'
    );
    expect(filteredRequests.length).toBeGreaterThan(0);
    for (const { url } of filteredRequests) {
      expect(url.searchParams.get('vps[from_id]')).toBeNull();
    }
  });

  test('@pr-smoke @pr-smoke-mobile keeps every admin VPS filter across the ascending cursor', async ({
    page,
  }, testInfo) => {
    const api = await setupVpsListApi(page, { user: { id: 42, login: 'admin', level: 100 } });
    const pagination = paginationPrefix(testInfo);
    const filterQuery = 'limit=25&q=vps&user=42&node=7&location=2&user_namespace_map=3';

    await page.goto(`/admin/vps?${filterQuery}`);

    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 25)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 26)).toHaveCount(0);
    await expect.poll(() => api.requests.length).toBeGreaterThan(0);

    const assertFilters = (url: URL) => {
      expect(url.searchParams.get('vps[hostname_any]')).toBe('vps');
      expect(url.searchParams.get('vps[user]')).toBe('42');
      expect(url.searchParams.get('vps[node]')).toBe('7');
      expect(url.searchParams.get('vps[location]')).toBe('2');
      expect(url.searchParams.get('vps[user_namespace_map]')).toBe('3');
      expect(url.searchParams.get('vps[limit]')).toBe('26');
    };

    const firstRequest = api.requests[0]?.url;
    expect(firstRequest).toBeDefined();
    assertFilters(firstRequest!);
    expect(firstRequest!.searchParams.get('vps[from_id]')).toBeNull();

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(vpsSurface(page, testInfo, 25)).toHaveCount(0);
    await expect(vpsSurface(page, testInfo, 26)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 50)).toBeVisible();
    await expect.poll(() =>
      api.requests.some(({ url }) => url.searchParams.get('vps[from_id]') === '25')
    ).toBe(true);

    const secondRequest = api.requests.find(({ url }) => url.searchParams.get('vps[from_id]') === '25')?.url;
    expect(secondRequest).toBeDefined();
    assertFilters(secondRequest!);

    api.requests.length = 0;
    await page.goto('/app/vps?limit=25&q=vps&node=7&location=2&user_namespace_map=3');
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect.poll(() => api.requests.length).toBeGreaterThan(0);

    const appFirstRequest = api.requests[0]?.url;
    expect(appFirstRequest).toBeDefined();
    assertFilters(appFirstRequest!);
    expect(appFirstRequest!.searchParams.get('vps[from_id]')).toBeNull();

    await page.getByTestId(`${pagination}.next`).click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect.poll(() =>
      api.requests.some(({ url }) => url.searchParams.get('vps[from_id]') === '25')
    ).toBe(true);
    const appSecondRequest = api.requests.find(({ url }) => url.searchParams.get('vps[from_id]') === '25')?.url;
    expect(appSecondRequest).toBeDefined();
    assertFilters(appSecondRequest!);
  });

  test('@pr-smoke @pr-smoke-mobile browser history restores VPS filters and their deep cursor', async ({
    page,
  }, testInfo) => {
    const api = await setupVpsListApi(page);

    await page.goto('/app/vps?limit=25&page=2&from_id=25&q=example');
    await expect(vpsSurface(page, testInfo, 26)).toBeVisible();
    await expect(page.getByTestId('vps.chip.hostname')).toContainText('q:example');
    expect(api.requests[0]?.url.searchParams.get('vps[hostname_any]')).toBe('example');
    expect(api.requests[0]?.url.searchParams.get('vps[from_id]')).toBe('25');

    await page.evaluate(() => {
      window.history.pushState({}, '', '/app/vps?limit=25&page=1&q=vps');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/q=vps/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(page.getByTestId('vps.chip.hostname')).toContainText('q:vps');

    await page.goBack();

    await expect(page).toHaveURL(/q=example/);
    await expect(page).toHaveURL(/from_id=25/);
    await expect(vpsSurface(page, testInfo, 26)).toBeVisible();
    await expect(page.getByTestId('vps.chip.hostname')).toContainText('q:example');
    await expect(page.getByTestId(`${paginationPrefix(testInfo)}.prev`)).toBeEnabled();

    await page.goForward();

    await expect(page).toHaveURL(/q=vps/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(page.getByTestId('vps.chip.hostname')).toContainText('q:vps');
  });

  test('@pr-smoke @pr-smoke-mobile invalid member filters reset before the first VPS request', async ({
    page,
  }, testInfo) => {
    const api = await setupVpsListApi(page);

    await page.goto('/app/vps?limit=25&page=2&from_id=50&node=garbage&user=42');

    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=|node=|user=/);
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect.poll(() => api.requests.length).toBeGreaterThan(0);
    expect(api.requests[0]?.url.searchParams.get('vps[from_id]')).toBeNull();
    expect(api.requests[0]?.url.searchParams.get('vps[node]')).toBeNull();
    expect(api.requests[0]?.url.searchParams.get('vps[user]')).toBeNull();
  });

  test('@pr-smoke @pr-smoke-mobile an empty cursor page can return to the first page', async ({ page }, testInfo) => {
    await setupVpsListApi(page);

    await page.goto('/app/vps?limit=50&page=2&from_id=100');

    await expect(page.getByTestId('vps.list.empty')).toBeVisible();
    await expect(page.getByTestId('vps.list.empty.action')).toBeEnabled();

    await page.getByTestId('vps.list.empty.action').click();

    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(vpsSurface(page, testInfo, 1)).toBeVisible();
    await expect(vpsSurface(page, testInfo, 50)).toBeVisible();
  });
});

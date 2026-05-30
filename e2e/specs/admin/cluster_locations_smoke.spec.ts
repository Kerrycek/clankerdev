import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin cluster locations', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const envs: any[] = [
      { id: 1, label: 'Production', domain: 'vpsfree.cz' },
      { id: 2, label: 'Staging', domain: 'staging.vpsfree.cz' },
    ];

    const locs: any[] = [
      {
        id: 1,
        label: 'prg1',
        description: 'Prague',
        domain: 'prg1.vpsfree.cz',
        has_ipv6: true,
        remote_console_server: 'https://console.example/prg1',
        environment: envs[0],
      },
      {
        id: 2,
        label: 'brq1',
        description: 'Brno',
        domain: 'brq1.vpsfree.cz',
        has_ipv6: false,
        remote_console_server: '',
        environment: envs[0],
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({ environments: envs, _meta: { total_count: envs.length } }),
        'GET locations': () => ({ locations: locs, _meta: { total_count: locs.length } }),
        'POST locations': ({ body }) => {
          const created = { id: 99, ...(body?.location ?? {}) };
          // Attach env object for UI
          const env = envs.find((e) => e.id === created.environment);
          locs.push({ ...created, environment: env });
          return { location: locs[locs.length - 1] };
        },
        'PUT locations/1': ({ body }) => {
          const idx = locs.findIndex((l) => l.id === 1);
          if (idx >= 0) {
            const next = { ...locs[idx], ...(body?.location ?? {}) };
            const env = envs.find((e) => e.id === next.environment) ?? next.environment;
            locs[idx] = { ...next, environment: env };
          }
          return { location: locs[idx] };
        },
      },
    });
  });

  test('lists, filters, creates and edits locations', async ({ page }) => {
    const gets: URL[] = [];
    const posts: any[] = [];
    const puts: any[] = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'GET' && url.pathname.endsWith('/locations')) gets.push(url);
      if (req.method() === 'POST' && url.pathname.endsWith('/locations')) posts.push(req.postDataJSON());
      if (req.method() === 'PUT' && url.pathname.endsWith('/locations/1')) puts.push(req.postDataJSON());
    });

    await page.goto('/admin/cluster/locations');
    await expect(page.getByTestId('admin.cluster.locations.page')).toBeVisible();

    await expect(page.getByTestId('admin.cluster.locations.row.1')).toBeVisible();

    // Filter by environment (assert namespaced query)
    await page.getByTestId('admin.cluster.locations.advanced').click();
    await page.getByTestId('admin.cluster.locations.filter.environment').selectOption('1');
    await expect.poll(() => gets.some((u) => u.searchParams.get('location[environment]') === '1')).toBeTruthy();

    // Share-with filter (assert namespaced query)
    await page.getByTestId('admin.cluster.locations.filter.shares_with').selectOption('2');
    await page.getByTestId('admin.cluster.locations.filter.shares_ver').selectOption('4');
    await page.getByTestId('admin.cluster.locations.filter.shares_primary').selectOption('true');

    await expect
      .poll(() =>
        gets.some(
          (u) =>
            u.searchParams.get('location[shares_v4_networks_with]') === '2' &&
            u.searchParams.get('location[shares_networks_primary]') === 'true'
        )
      )
      .toBeTruthy();
    await page.getByTestId('admin.cluster.locations.advanced.drawer').getByRole('button', { name: /done/i }).click();

    // Create
    await page.getByTestId('admin.cluster.locations.create').click();
    await expect(page.getByTestId('admin.cluster.locations.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.locations.editor.label').fill('newloc');
    await page.getByTestId('admin.cluster.locations.editor.environment').selectOption('1');
    await page.getByTestId('admin.cluster.locations.editor.domain').fill('newloc.vpsfree.cz');
    await page.getByTestId('admin.cluster.locations.editor.remote_console').fill('https://console.example/newloc');
    await page.getByTestId('admin.cluster.locations.editor.save').click();

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[posts.length - 1]).toEqual({
      location: expect.objectContaining({
        label: 'newloc',
        environment: 1,
        domain: 'newloc.vpsfree.cz',
        has_ipv6: true,
        remote_console_server: 'https://console.example/newloc',
      }),
    });

    // Edit
    await page.getByTestId('admin.cluster.locations.row.1.edit').click();
    await expect(page.getByTestId('admin.cluster.locations.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.locations.editor.has_ipv6').click();
    await page.getByTestId('admin.cluster.locations.editor.save').click();

    expect(puts.length).toBeGreaterThan(0);
    expect(puts[puts.length - 1]).toEqual({
      location: expect.objectContaining({
        label: 'prg1',
        environment: 1,
        has_ipv6: false,
      }),
    });
  });
});

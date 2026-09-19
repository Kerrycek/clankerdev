import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin resource package filter contract', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  });

  test('@pr-smoke @pr-smoke-mobile uses nullable user scope and never sends unsupported filters', async ({ page }) => {
    const globalPackage = {
      id: 21,
      label: 'Standard Production',
      environment: null,
      user: null,
    };
    const personalPackage = {
      id: 31,
      label: 'Alice personal',
      environment: { id: 1, label: 'Production' },
      user: { id: 7, login: 'alice' },
    };
    const replacementPersonalPackage = {
      id: 32,
      label: 'Bob personal',
      environment: { id: 1, label: 'Production' },
      user: { id: 8, login: 'bob' },
    };
    const packageGets: URL[] = [];
    let personalSelectionPending = false;
    let unsafeUnscopedRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({
          environments: [{ id: 1, label: 'Production' }],
          _meta: { total_count: 1 },
        }),
        'GET users': () => ({
          users: [{ id: 8, login: 'bob' }],
          _meta: { total_count: 1 },
        }),
        'GET cluster_resource_packages': ({ url, searchParams }) => {
          const requestUrl = new URL(url);
          packageGets.push(requestUrl);

          const userKey = 'cluster_resource_package[user]';
          const hasUserFilter = searchParams.has(userKey);
          const requestedUser = searchParams.get(userKey);
          if (personalSelectionPending && (!hasUserFilter || requestedUser === '')) unsafeUnscopedRequests += 1;

          const packages = !hasUserFilter
            ? [globalPackage, personalPackage, replacementPersonalPackage]
            : requestedUser === ''
              ? [globalPackage]
              : requestedUser === '7'
                ? [personalPackage]
                : requestedUser === '8'
                  ? [replacementPersonalPackage]
                  : [];

          return { cluster_resource_packages: packages, _meta: { total_count: packages.length } };
        },
      },
    });

    await page.goto('/admin/cluster/resource-packages?q=legacy-label');

    await expect(page.getByTestId('admin.cluster.resource_packages.row.21')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.31')).toHaveCount(0);
    await expect.poll(() => packageGets.length).toBeGreaterThan(0);

    const globalRequest = packageGets[0];
    expect(globalRequest).toBeDefined();
    expect(globalRequest?.searchParams.has('cluster_resource_package[user]')).toBe(true);
    expect(globalRequest?.searchParams.get('cluster_resource_package[user]')).toBe('');
    expect(globalRequest?.searchParams.has('cluster_resource_package[q]')).toBe(false);
    expect(globalRequest?.searchParams.has('cluster_resource_package[is_personal]')).toBe(false);
    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);

    await page.getByTestId('admin.cluster.resource_packages.advanced.open').click();
    personalSelectionPending = true;
    await page.getByTestId('admin.cluster.resource_packages.scope').selectOption('personal');
    await page.getByTestId('admin.cluster.resource_packages.advanced').getByRole('button', { name: /hotovo|done/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.personal_user_required')).toBeVisible();
    expect(unsafeUnscopedRequests).toBe(0);

    await page.getByTestId('admin.cluster.resource_packages.search').fill('scope:personal user:7');
    await page.getByTestId('admin.cluster.resource_packages.search').press('Enter');
    await expect(page.getByTestId('admin.cluster.resource_packages.row.31')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.21')).toHaveCount(0);
    await expect
      .poll(() => packageGets.some((url) => url.searchParams.get('cluster_resource_package[user]') === '7'))
      .toBe(true);
    await expect.poll(() => new URL(page.url()).searchParams.get('scope')).toBe('personal');
    await expect.poll(() => new URL(page.url()).searchParams.get('user')).toBe('7');
    expect(unsafeUnscopedRequests).toBe(0);

    await page.getByTestId('admin.cluster.resource_packages.advanced.open').click();
    await page.getByTestId('admin.cluster.resource_packages.user').fill('bob');
    await expect(page.getByTestId('admin.cluster.resource_packages.user.opt.8')).toBeVisible();
    await page.getByTestId('admin.cluster.resource_packages.advanced').getByRole('button', { name: /hotovo|done/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.31')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('user')).toBe('7');

    await page.getByTestId('admin.cluster.resource_packages.advanced.open').click();
    await page.getByTestId('admin.cluster.resource_packages.user').fill('bob');
    await expect(page.getByTestId('admin.cluster.resource_packages.user.opt.8')).toBeVisible();
    await page.getByTestId('admin.cluster.resource_packages.user.opt.8').click();
    await expect(page.getByTestId('admin.cluster.resource_packages.user')).toHaveValue('8');
    await expect.poll(() => new URL(page.url()).searchParams.get('user')).toBe('8');
    await expect
      .poll(() => packageGets.some((url) => url.searchParams.get('cluster_resource_package[user]') === '8'))
      .toBe(true);
    await page.getByTestId('admin.cluster.resource_packages.advanced').getByRole('button', { name: /hotovo|done/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.32')).toBeVisible();

    await page.getByTestId('admin.cluster.resource_packages.chip.user').getByRole('button').click();
    await expect(page.getByTestId('admin.cluster.resource_packages.personal_user_required')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.has('user')).toBe(false);
    await page.getByTestId('admin.cluster.resource_packages.advanced.open').click();
    await expect(page.getByTestId('admin.cluster.resource_packages.user')).toHaveValue('');
    await page.getByTestId('admin.cluster.resource_packages.user').fill('#7');
    await expect(page.getByTestId('admin.cluster.resource_packages.user')).toHaveValue('7');
    await expect.poll(() => new URL(page.url()).searchParams.get('user')).toBe('7');
    expect(unsafeUnscopedRequests).toBe(0);
    await page.getByTestId('admin.cluster.resource_packages.advanced').getByRole('button', { name: /hotovo|done/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.31')).toBeVisible();

    personalSelectionPending = false;
    await page.getByTestId('admin.cluster.resource_packages.advanced.open').click();
    await page.getByTestId('admin.cluster.resource_packages.scope').selectOption('all');
    await expect(page.getByTestId('admin.cluster.resource_packages.user')).toBeDisabled();
    await expect(page.getByTestId('admin.cluster.resource_packages.user')).toHaveValue('');
    await expect
      .poll(() => packageGets.some((url) => !url.searchParams.has('cluster_resource_package[user]')))
      .toBe(true);
    await expect.poll(() => new URL(page.url()).searchParams.get('scope')).toBe('all');
    await expect.poll(() => new URL(page.url()).searchParams.has('user')).toBe(false);
    await page.getByTestId('admin.cluster.resource_packages.advanced').getByRole('button', { name: /hotovo|done/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.21')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.31')).toBeVisible();

    for (const request of packageGets) {
      expect(request.searchParams.has('cluster_resource_package[q]')).toBe(false);
      expect(request.searchParams.has('cluster_resource_package[is_personal]')).toBe(false);
    }
  });
});

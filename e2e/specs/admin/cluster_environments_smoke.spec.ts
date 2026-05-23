import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin cluster environments', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const envs: any[] = [
      {
        id: 1,
        label: 'Production',
        description: 'Main cluster environment',
        domain: 'vpsfree.cz',
        can_create_vps: true,
        can_destroy_vps: true,
        vps_lifetime: 0,
        max_vps_count: 0,
        user_ip_ownership: true,
      },
      {
        id: 2,
        label: 'Staging',
        description: 'Sandbox',
        domain: 'staging.vpsfree.cz',
        can_create_vps: false,
        can_destroy_vps: false,
        vps_lifetime: 3600,
        max_vps_count: 3,
        user_ip_ownership: false,
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({ environments: envs, _meta: { total_count: envs.length } }),
        'POST environments': ({ body }) => {
          const created = { id: 99, ...(body?.environment ?? {}) };
          envs.push(created);
          return { environment: created };
        },
        'PUT environments/1': ({ body }) => {
          const idx = envs.findIndex((e) => e.id === 1);
          if (idx >= 0) envs[idx] = { ...envs[idx], ...(body?.environment ?? {}) };
          return { environment: envs[idx] };
        },
      },
    });
  });

  test('lists, filters, creates and edits environments', async ({ page }) => {
    const gets: URL[] = [];
    const posts: any[] = [];
    const puts: any[] = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'GET' && url.pathname.endsWith('/environments')) gets.push(url);
      if (req.method() === 'POST' && url.pathname.endsWith('/environments')) posts.push(req.postDataJSON());
      if (req.method() === 'PUT' && url.pathname.endsWith('/environments/1')) puts.push(req.postDataJSON());
    });

    await page.goto('/admin/cluster/environments');
    await expect(page.getByTestId('admin.cluster.environments.page')).toBeVisible();

    await expect(page.getByTestId('admin.cluster.environments.row.1')).toBeVisible();

    // Filter: has hypervisor = true (assert request is namespaced)
    await page.getByTestId('admin.cluster.environments.advanced').click();
    await page.getByTestId('admin.cluster.environments.filter.has_hypervisor').selectOption('true');

    await expect.poll(() => gets.some((u) => u.searchParams.get('environment[has_hypervisor]') === 'true')).toBeTruthy();

    // Create
    await page.getByTestId('admin.cluster.environments.create').click();
    await expect(page.getByTestId('admin.cluster.environments.editor')).toBeVisible();

    await page.getByTestId('admin.cluster.environments.editor.label').fill('Test');
    await page.getByTestId('admin.cluster.environments.editor.domain').fill('test.example');
    await page.getByTestId('admin.cluster.environments.editor.can_create').click();
    await page.getByTestId('admin.cluster.environments.editor.can_destroy').click();

    await page.getByTestId('admin.cluster.environments.editor.save').click();

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[posts.length - 1]).toEqual({
      environment: expect.objectContaining({
        label: 'Test',
        domain: 'test.example',
        can_create_vps: true,
        can_destroy_vps: true,
        vps_lifetime: 0,
        max_vps_count: 0,
        user_ip_ownership: true,
      }),
    });

    // Edit
    await page.getByTestId('admin.cluster.environments.row.1.edit').click();
    await expect(page.getByTestId('admin.cluster.environments.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.environments.editor.max_vps').fill('10');
    await page.getByTestId('admin.cluster.environments.editor.save').click();

    expect(puts.length).toBeGreaterThan(0);
    expect(puts[puts.length - 1]).toEqual({
      environment: expect.objectContaining({
        label: 'Production',
        domain: 'vpsfree.cz',
        max_vps_count: 10,
      }),
    });
  });
});

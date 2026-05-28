import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin outage workflow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET outages': () => ({ outages: [] }),
        'GET environments': () => ({ environments: [{ id: 2, label: 'Production' }] }),
        'GET locations': () => ({ locations: [{ id: 3, label: 'Prague' }] }),
        'GET nodes': () => ({ nodes: [{ id: 12, domain_name: 'node12' }] }),
        'GET users': () => ({ users: [{ id: 42, login: 'operator', full_name: 'Operator' }] }),
        'POST outages': () => ({ outage: { id: 7 } }),
        'POST outages/7/entities': () => ({ entity: { id: 100 } }),
        'POST outages/7/handlers': () => ({ handler: { id: 200 } }),
        'POST outages/7/rebuild_affected_vps': () => ({ outage: { id: 7 } }),
      },
    });
  });

  test('validates create form and submits initial systems and handlers', async ({ page }) => {
    const posts: Array<{ path: string; body: any }> = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.includes('/outages')) {
        posts.push({ path: url.pathname, body: req.postDataJSON() });
      }
    });

    await page.goto('/admin/outages');
    await expect(page.getByTestId('admin.outages.page')).toBeVisible();

    await page.getByTestId('admin.outages.new').click();
    await expect(page.getByTestId('admin.outages.create.modal')).toBeVisible();

    await page.getByTestId('admin.outages.create.save').click();
    await expect(page.getByTestId('admin.outages.create.validation')).toBeVisible();
    expect(posts).toEqual([]);

    await page.getByTestId('admin.outages.form.duration').fill('30');
    await page.getByTestId('admin.outages.form.en_summary').fill('Maintenance');
    await page.getByTestId('admin.outages.form.cs_summary').fill('Udrzba');
    await page.getByTestId('admin.outages.systems.environments.select').selectOption('2');
    await page.getByTestId('admin.outages.systems.nodes.lookup').fill('12');
    await page.getByTestId('admin.outages.systems.nodes.add').click();
    await page.getByTestId('admin.outages.systems.handlers.lookup').fill('42');
    await page.getByTestId('admin.outages.systems.handlers.add').click();

    await page.getByTestId('admin.outages.create.save').click();

    await expect.poll(() => posts.map((p) => p.path)).toEqual([
      '/api/v7.0/outages',
      '/api/v7.0/outages/7/entities',
      '/api/v7.0/outages/7/entities',
      '/api/v7.0/outages/7/handlers',
      '/api/v7.0/outages/7/rebuild_affected_vps',
    ]);
    expect(posts[0]?.body).toEqual({
      outage: expect.objectContaining({
        duration: 30,
        type: 'outage',
        impact: 'tbd',
        en_summary: 'Maintenance',
        cs_summary: 'Udrzba',
      }),
    });
    expect(posts[1]?.body).toEqual({ entity: { name: 'Environment', entity_id: 2 } });
    expect(posts[2]?.body).toEqual({ entity: { name: 'Node', entity_id: 12 } });
    expect(posts[3]?.body).toEqual({ handler: { user: 42 } });
  });
});

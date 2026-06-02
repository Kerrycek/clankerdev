import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin outage workflow', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  });

  test('validates create form and submits initial systems and handlers', async ({ page }) => {
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

  test('opens detail directly and covers edit, systems, update, affected lists and state confirmations', async ({ page }) => {
    const requests: Array<{ method: string; path: string; body: any }> = [];
    let updateFails = true;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET outages/7': () => ({
          outage: {
            id: 7,
            begins_at: '2026-06-02T10:00:00.000Z',
            duration: 30,
            type: 'outage',
            impact: 'network',
            state: 'staged',
            auto_resolve: false,
            en_summary: 'Network outage',
            cs_summary: 'Vypadek site',
            affected_user_count: 1,
            affected_direct_vps_count: 1,
            affected_indirect_vps_count: 0,
            affected_export_count: 1,
          },
        }),
        'GET outages/7/entities': () => ({ entities: [{ id: 100, name: 'Node', entity_id: 12, label: 'Node node12' }] }),
        'GET outages/7/handlers': () => ({ handlers: [{ id: 200, user_id: 42, full_name: 'Operator' }] }),
        'GET outage_updates': () => ({ outage_updates: [] }),
        'GET user_outages': () => ({ user_outages: [{ id: 300, user: { id: 5, login: 'alice' }, vps_count: 1, export_count: 1 }] }),
        'GET vps_outages': () => ({ vps_outages: [{ id: 301, vps: { id: 55, hostname: 'vps55' }, direct: true }] }),
        'GET export_outages': () => ({ export_outages: [{ id: 302, export: { id: 66, path: '/data' } }] }),
        'GET environments': () => ({ environments: [{ id: 2, label: 'Production' }] }),
        'GET locations': () => ({ locations: [{ id: 3, label: 'Prague' }] }),
        'GET nodes': () => ({ nodes: [{ id: 12, domain_name: 'node12' }, { id: 13, domain_name: 'node13' }] }),
        'GET users': () => ({ users: [{ id: 42, login: 'operator', full_name: 'Operator' }, { id: 43, login: 'responder' }] }),
        'PUT outages/7': () => ({ outage: { id: 7 } }),
        'POST outages/7/entities': () => ({ entity: { id: 101 } }),
        'DELETE outages/7/entities/100': () => ({}),
        'POST outages/7/handlers': () => ({ handler: { id: 201 } }),
        'DELETE outages/7/handlers/200': () => ({}),
        'POST outages/7/rebuild_affected_vps': () => ({ outage: { id: 7 } }),
        'POST outage_updates': () => {
          if (updateFails) return failEnvelope('Update delivery failed');
          return { outage_update: { id: 400 } };
        },
      },
    });

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (!url.pathname.startsWith('/api/v7.0/')) return;
      if (!['POST', 'PUT', 'DELETE'].includes(req.method())) return;
      requests.push({ method: req.method(), path: url.pathname, body: req.postDataJSON() });
    });

    await page.goto('/admin/outages/7');
    await expect(page.getByTestId('admin.outages.detail.page')).toBeVisible();
    await expect(page.getByText('alice · VPS 1 · exports 1')).toBeVisible();
    await expect(page.getByText('#55 vps55')).toBeVisible();
    await expect(page.getByText('#66 /data')).toBeVisible();

    await page.getByTestId('admin.outages.detail.edit_attrs').click();
    await expect(page.getByTestId('admin.outages.edit.modal')).toBeVisible();
    await page.getByTestId('admin.outages.form.duration').fill('45');
    await page.getByTestId('admin.outages.edit.save').click();
    await expect.poll(() => requests.some((r) => r.method === 'PUT' && r.path === '/api/v7.0/outages/7')).toBeTruthy();
    expect(requests.find((r) => r.method === 'PUT' && r.path === '/api/v7.0/outages/7')?.body).toEqual({
      outage: expect.objectContaining({ duration: 45, impact: 'network', en_summary: 'Network outage' }),
    });
    await expect(page.getByTestId('admin.outages.edit.modal')).toHaveCount(0);

    await page.getByTestId('admin.outages.detail.edit_systems').click();
    await expect(page.getByTestId('admin.outages.systems.modal')).toBeVisible();
    await page.getByTestId('admin.outages.systems.nodes.lookup').fill('13');
    await page.getByTestId('admin.outages.systems.nodes.add').click();
    await page.getByTestId('admin.outages.systems.handlers.lookup').fill('43');
    await page.getByTestId('admin.outages.systems.handlers.add').click();
    await page.getByTestId('admin.outages.systems.save').click();
    await expect.poll(() => requests.some((r) => r.path === '/api/v7.0/outages/7/rebuild_affected_vps')).toBeTruthy();
    expect(requests.some((r) => r.method === 'POST' && r.path === '/api/v7.0/outages/7/entities' && r.body?.entity?.entity_id === 13)).toBeTruthy();
    expect(requests.some((r) => r.method === 'POST' && r.path === '/api/v7.0/outages/7/handlers' && r.body?.handler?.user === 43)).toBeTruthy();
    await expect(page.getByTestId('admin.outages.systems.modal')).toHaveCount(0);

    await page.getByTestId('admin.outages.detail.post_update').click();
    await expect(page.getByTestId('admin.outages.update.modal')).toBeVisible();
    await page.getByTestId('admin.outages.form.en_summary').fill('Still investigating');
    await page.getByTestId('admin.outages.form.cs_summary').fill('Proverujeme');
    await page.getByTestId('admin.outages.update.save').click();
    await expect(page.getByTestId('admin.outages.update.error')).toContainText('Update delivery failed');

    updateFails = false;
    await page.getByTestId('admin.outages.update.save').click();
    await expect.poll(() => requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates').length).toBeGreaterThanOrEqual(2);
    const manualUpdate = requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates').at(-1);
    expect(manualUpdate?.body).toEqual({
      outage_update: expect.objectContaining({
        outage: 7,
        send_mail: true,
        state: 'staged',
        impact: 'network',
        en_summary: 'Still investigating',
        cs_summary: 'Proverujeme',
      }),
    });
    await expect(page.getByTestId('admin.outages.update.modal')).toHaveCount(0);

    await page.getByTestId('admin.outages.change_state.cancelled').click();
    await expect(page.getByTestId('admin.outages.change_state.confirm')).toBeVisible();
    const beforeConfirm = requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates').length;
    await page.getByTestId('admin.outages.change_state.confirm.cancel').click();
    expect(requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates')).toHaveLength(beforeConfirm);

    await page.getByTestId('admin.outages.change_state.cancelled').click();
    await page.getByTestId('admin.outages.change_state.confirm.confirm').click();
    await expect.poll(() => requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates').length).toBeGreaterThan(beforeConfirm);
    expect(requests.filter((r) => r.method === 'POST' && r.path === '/api/v7.0/outage_updates').at(-1)?.body).toEqual({
      outage_update: expect.objectContaining({ outage: 7, state: 'cancelled', send_mail: true }),
    });
  });
});

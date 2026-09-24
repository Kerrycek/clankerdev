import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('admin user detail: shows header and shortcut links', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100, time_zone: 'Asia/Tokyo' },
    handlers: {
      'GET users/42': () => ({
        user: {
          id: 42,
          login: 'alice',
          level: 1,
          full_name: 'Alice Example',
          email: 'alice@example.test',
          created_at: '2026-02-01T00:00:00.000Z',
          last_activity_at: '2026-02-02T00:00:00.000Z',
          address: 'Example street\nExample city',
        },
      }),
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 7 } }),
    },
  });

  await page.goto('/admin/users/42');

  await expect(page.getByTestId('admin.user.page')).toBeVisible();
  await expect(page.getByTestId('admin.user.header')).toBeVisible();
  await expect(page.getByTestId('admin.user.time_zone')).toHaveText('Europe/Prague');

  await expect(page.getByTestId('admin.user.action.vps')).toHaveAttribute('href', '/admin/vps?user=42');
  await expect(page.getByTestId('admin.user.action.vps_count')).toHaveText('7');
  await expect(page.getByTestId('admin.user.action.datasets')).toHaveAttribute('href', '/admin/datasets?user=42');
  await expect(page.getByTestId('admin.user.action.dns')).toHaveAttribute('href', '/admin/dns?user=42');
  await expect(page.getByTestId('admin.user.action.requests')).toHaveAttribute('href', '/admin/requests?user=42');
  await expect(page.getByTestId('admin.user.action.user_namespaces')).toHaveAttribute('href', '/admin/user-namespaces/maps?user=42');

  await expect(page.getByTestId('admin.user.refresh')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
});

test('@workflow-matrix @pr-smoke @pr-smoke-mobile admin user detail: VPS create keeps the selected member context', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({
        user: { id: 42, login: 'alice', level: 1, full_name: 'Alice Example' },
      }),
      'GET vpses': () => ({ vpses: [] }),
      'GET locations': () => ({
        locations: [{ id: 2, label: 'Praha', environment: { id: 1, label: 'Test' } }],
      }),
      'GET nodes': () => ({
        nodes: [{ id: 101, name: 'node101', type: 'node', hypervisor_type: 'vpsadminos', location: { id: 2 } }],
      }),
      'GET os_templates': () => ({
        os_templates: [{ id: 6, label: 'Debian 12', os_family: { id: 1, label: 'Linux' } }],
      }),
      'GET default_object_cluster_resources': () => ({ default_object_cluster_resources: [] }),
    },
  });

  await page.goto('/admin/users/42');
  await page.getByTestId('admin.user.action.vps').click();

  await expect(page).toHaveURL('/admin/vps?user=42');
  await expect(page.getByTestId('vps.list.create')).toHaveAttribute('href', '/admin/vps/new?user=42');
  await page.getByTestId('vps.list.create').click();

  await expect(page).toHaveURL('/admin/vps/new?user=42');
  await expect(page.getByTestId('vps.create.user')).toHaveValue('42');
  await expect(page.getByTestId('vps.create.owner.selection')).toContainText('alice');
  await expect(page.getByTestId('vps.create.owner.selection')).toContainText('#42');
  await expect(page.getByTestId('vps.create.review.owner')).toContainText('alice');
  await expect(page.getByTestId('vps.create.review.owner')).toContainText('#42');
  await expect(page.getByTestId('vps.create.back')).toHaveAttribute('href', '/admin/vps?user=42');
});

test('admin user detail: edit drawer saves safe account fields', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const updates: any[] = [];
  let user = {
    id: 42,
    login: 'alice',
    level: 1,
    full_name: 'Alice Example',
    email: 'alice@example.test',
    mailer_enabled: true,
    time_zone: 'Europe/Prague',
    info: 'Initial note',
    address: 'Example street',
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': () => {
        user = {
          ...user,
          login: 'alice-renamed',
          full_name: 'Alice Renamed',
          email: 'alice.renamed@example.test',
          level: 21,
          mailer_enabled: false,
          info: 'Admin note',
          address: 'New street',
          time_zone: 'UTC',
        };
        return { user };
      },
    },
  });

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (req.method() === 'PUT' && url.pathname === '/api/v7.0/users/42') {
      updates.push(req.postDataJSON());
    }
  });

  await page.goto('/admin/users/42');
  await expect(page.getByTestId('admin.user.page')).toBeVisible();

  await page.getByTestId('admin.user.edit.open').click();
  await expect(page.getByTestId('admin.user.edit.drawer')).toBeVisible();
  await page.getByTestId('admin.user.edit.login').fill('alice-renamed');
  await expect(page.getByText('Login will change')).toBeVisible();
  await page.getByTestId('admin.user.edit.full_name').fill('Alice Renamed');
  await page.getByTestId('admin.user.edit.email').fill('alice.renamed@example.test');
  await page.getByTestId('admin.user.edit.level').fill('21');
  await page.getByTestId('admin.user.edit.mailer_enabled').click();
  await page.getByTestId('admin.user.edit.address').fill('New street');
  await page.getByTestId('admin.user.edit.time_zone').selectOption('UTC');
  await page.getByTestId('admin.user.edit.info').fill('Admin note');
  await page.getByTestId('admin.user.edit.save').click();

  await expect(page.getByTestId('admin.user.edit.drawer')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.details.card').getByText('Alice Renamed')).toBeVisible();
  await expect(page.getByTestId('admin.user.time_zone')).toHaveText('UTC');
  expect(updates).toEqual([
    {
      user: {
        login: 'alice-renamed',
        full_name: 'Alice Renamed',
        email: 'alice.renamed@example.test',
        address: 'New street',
        level: 21,
        info: 'Admin note',
        mailer_enabled: false,
        time_zone: 'UTC',
      },
    },
  ]);
});

test('admin user detail: edit drawer can clear optional account fields', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const updates: any[] = [];
  let user = {
    id: 42,
    login: 'alice',
    level: 1,
    full_name: 'Alice Example',
    email: 'alice@example.test',
    address: 'Example street',
    info: 'Old note',
    mailer_enabled: true,
    time_zone: 'Europe/Prague',
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': ({ reqJson }) => {
        const payload = (reqJson as { user?: Record<string, unknown> }).user ?? {};
        updates.push(payload);
        user = { ...user, ...payload };
        return { user };
      },
    },
  });

  await page.goto('/admin/users/42');
  await page.getByTestId('admin.user.edit.open').click();
  await page.getByTestId('admin.user.edit.full_name').fill('');
  await page.getByTestId('admin.user.edit.email').fill('');
  await page.getByTestId('admin.user.edit.address').fill('');
  await page.getByTestId('admin.user.edit.info').fill('');
  await page.getByTestId('admin.user.edit.save').click();

  await expect(page.getByTestId('admin.user.edit.drawer')).toHaveCount(0);
  expect(updates).toEqual([{
    login: 'alice',
    full_name: '',
    email: '',
    address: '',
    level: 1,
    info: '',
    mailer_enabled: true,
    time_zone: 'Europe/Prague',
  }]);
});

test('admin user detail: lifecycle state update sends object state', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const updates: any[] = [];
  let user = {
    id: 42,
    login: 'alice',
    level: 1,
    full_name: 'Alice Example',
    email: 'alice@example.test',
    object_state: 'active',
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': ({ reqJson }) => {
        const payload = (reqJson as any).user ?? {};
        user = { ...user, ...payload };
        return { user, _meta: { action_state_id: 741 } };
      },
      'GET users': () => ({ users: [] }),
    },
  });

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (req.method() === 'PUT' && url.pathname === '/api/v7.0/users/42') {
      updates.push(req.postDataJSON());
    }
  });

  await page.goto('/admin/users/42');
  await expect(page.getByTestId('admin.user.page')).toBeVisible();

  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();
  await expect(page.getByTestId('admin.user.lifecycle.remind_after')).toBeDisabled();
  await expect(page.getByTestId('admin.user.lifecycle.remind_after.1w')).toBeDisabled();
  await expect(page.getByTestId('admin.user.lifecycle.state')).toContainText('Active account (active)');
  await expect(page.getByTestId('admin.user.lifecycle.state')).toContainText('Deactivated – recoverable (soft_delete)');
  await expect(page.getByTestId('admin.user.lifecycle.state').locator('option[value="deleted"]')).toHaveAttribute('disabled', '');
  await expect(page.getByTestId('admin.user.lifecycle.state.description')).toContainText('fully available');
  await page.getByTestId('admin.user.lifecycle.state').selectOption('suspended');
  await expect(page.getByTestId('admin.user.lifecycle.state.description')).toContainText('Temporarily stops VPS');
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeEnabled();
  await page.getByTestId('admin.user.lifecycle.save').click();

  const confirmation = page.getByTestId('admin.user.lifecycle.confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('alice (#42)');
  await expect(confirmation).toContainText('Temporarily suspended (suspended)');
  expect(updates).toHaveLength(0);
  await page.getByTestId('admin.user.lifecycle.confirm.confirm').click();

  await expect.poll(() => updates.length).toBe(1);
  expect(updates).toEqual([{ user: { object_state: 'suspended' } }]);
});

test('@pr-smoke @pr-smoke-mobile admin user detail: soft delete keeps a durable queued receipt with task links', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const updates: Array<Record<string, unknown>> = [];
  const user = {
    id: 42,
    login: 'alice',
    level: 1,
    full_name: 'Alice Example',
    email: 'alice@example.test',
    object_state: 'active',
    expiration_date: null,
    remind_after_date: null,
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': ({ reqJson }) => {
        updates.push((reqJson as { user?: Record<string, unknown> }).user ?? {});
        // Async user updates can return the previous resource representation.
        return { user, _meta: { action_state_id: 742 } };
      },
      'GET users': () => ({ users: [] }),
    },
  });

  await page.goto('/admin/users/42');
  await page.getByTestId('admin.user.lifecycle.state').selectOption('soft_delete');
  await page.getByTestId('admin.user.lifecycle.save').click();

  const confirmation = page.getByTestId('admin.user.lifecycle.confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Deactivated – recoverable (soft_delete)');
  await expect(confirmation).toContainText('revokes access');
  expect(updates).toHaveLength(0);
  await page.getByTestId('admin.user.lifecycle.confirm.confirm').click();

  await expect.poll(() => updates.length).toBe(1);
  expect(updates[0]?.['object_state']).toBe('soft_delete');
  expect(typeof updates[0]?.['expiration_date']).toBe('string');

  const receipt = page.getByTestId('admin.user.lifecycle.receipt');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('Account change queued');
  await expect(receipt).toContainText('Deactivated – recoverable (soft_delete)');
  await expect(receipt).toContainText('#742');
  await expect(page.getByTestId('admin.user.lifecycle.receipt.open_action')).toHaveAttribute(
    'href',
    '/admin/action-states/742'
  );
  await expect(page.getByTestId('admin.user.lifecycle.state')).toHaveValue('soft_delete');
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByTestId('admin.user.lifecycle.receipt.open_tasks').click();
  await expect(page.getByTestId('tasks.drawer')).toBeVisible();
});

test('admin user detail: resets lifecycle draft when the user route changes', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const updates: string[] = [];
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user: { id: 42, login: 'alice', level: 1, object_state: 'active' } }),
      'GET users/43': () => ({ user: { id: 43, login: 'bob', level: 1, object_state: 'active' } }),
      'GET users': () => ({ users: [] }),
      'PUT users/42': () => { updates.push('42'); return { user: { id: 42, object_state: 'suspended' } }; },
      'PUT users/43': () => { updates.push('43'); return { user: { id: 43, object_state: 'active' } }; },
    },
  });

  await page.goto('/admin/users/42');
  await page.getByTestId('admin.user.lifecycle.state').selectOption('suspended');
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeEnabled();
  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/users/43');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('admin.user.lifecycle.state')).toHaveValue('active');
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();
  expect(updates).toEqual([]);
});

test('admin user detail: expiration-only update accepts a synchronous response without action state', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  let updateRequests = 0;
  let user = {
    id: 42,
    login: 'alice',
    level: 1,
    object_state: 'active',
    expiration_date: null as string | null,
    remind_after_date: null as string | null,
  };
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': ({ reqJson }) => {
        updateRequests += 1;
        const payload = (reqJson as { user?: Record<string, unknown> }).user ?? {};
        user = { ...user, ...payload };
        return { user, _meta: {} };
      },
    },
  });

  await page.goto('/admin/users/42');
  await page.getByTestId('admin.user.lifecycle.expiration').fill('2026-09-01T12:00');
  await page.getByTestId('admin.user.lifecycle.save').click();

  await expect.poll(() => updateRequests).toBe(1);
  await expect(page.getByTestId('admin.user.mutation.uncertain')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();
});

test('@pr-smoke @pr-smoke-mobile admin user detail: reminder timing can be set and cleared without changing other lifecycle fields', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const updates: Array<Record<string, unknown>> = [];
  let user = {
    id: 42,
    login: 'alice',
    level: 1,
    object_state: 'active',
    expiration_date: '2026-10-01T12:00:00.000Z' as string | null,
    remind_after_date: null as string | null,
  };
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': ({ reqJson }) => {
        const payload = (reqJson as { user?: Record<string, unknown> }).user ?? {};
        updates.push(payload);
        user = { ...user, ...payload };
        return { user, _meta: {} };
      },
    },
  });

  await page.goto('/admin/users/42');
  const reminder = page.getByTestId('admin.user.lifecycle.remind_after');
  await expect(reminder).toBeEnabled();
  await expectNoDocumentHorizontalOverflow(page);
  await page.getByTestId('admin.user.lifecycle.remind_after.1w').click();
  await expect(reminder).not.toHaveValue('');
  await reminder.fill('2026-09-25T12:00');
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeEnabled();
  await page.getByTestId('admin.user.lifecycle.save').click();

  await expect.poll(() => updates.length).toBe(1);
  expect(Object.keys(updates[0] ?? {})).toEqual(['remind_after_date']);
  expect(typeof updates[0]?.['remind_after_date']).toBe('string');
  expect(Number.isNaN(Date.parse(String(updates[0]?.['remind_after_date'])))).toBe(false);

  await page.getByTestId('admin.user.lifecycle.remind_after.clear').click();
  await expect(page.getByTestId('admin.user.lifecycle.save')).toBeEnabled();
  await page.getByTestId('admin.user.lifecycle.save').click();

  await expect.poll(() => updates.length).toBe(2);
  expect(updates[1]).toEqual({ remind_after_date: null });
});

for (const scenario of [
  {
    name: 'missing action state',
    response: (user: Record<string, unknown>) => ({ user, _meta: {} }),
  },
  {
    name: 'lost transport response',
    response: () => ({ status: 200, contentType: 'application/json', body: '{' }),
  },
] as const) {
  test(`admin user detail: ${scenario.name} is reload-safe and requires review before acknowledgement`, async ({ page }) => {
    await bootstrapVpsAdminWindow(page);

    const user = {
      id: 42,
      login: 'alice',
      level: 1,
      full_name: 'Alice Example',
      email: 'alice@example.test',
      object_state: 'active',
    };
    let updateRequests = 0;
    let releaseResponse: (() => void) | undefined;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({ user }),
        'PUT users/42': async () => {
          updateRequests += 1;
          await responseGate;
          return scenario.response(user);
        },
        'GET users': () => ({ users: [] }),
      },
    });

    await page.goto('/admin/users/42');
    await page.getByTestId('admin.user.lifecycle.state').selectOption('suspended');
    await page.getByTestId('admin.user.lifecycle.save').click();
    await expect(page.getByTestId('admin.user.lifecycle.confirm')).toBeVisible();
    expect(updateRequests).toBe(0);
    await page.getByTestId('admin.user.lifecycle.confirm.confirm').click();

    await expect(page.getByTestId('admin.user.mutation.pending')).toBeVisible();
    await expect(page.getByTestId('admin.user.mutation.acknowledge')).toHaveCount(0);
    await expect.poll(() => updateRequests).toBe(1);

    releaseResponse?.();
    await expect(page.getByTestId('admin.user.mutation.uncertain')).toBeVisible();
    await expect(page.getByTestId('admin.user.mutation.acknowledge')).toBeDisabled();
    await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();

    await page.reload();
    await expect(page.getByTestId('admin.user.mutation.uncertain')).toBeVisible();
    await expect(page.getByTestId('admin.user.lifecycle.save')).toBeDisabled();
    await expect.poll(() => updateRequests).toBe(1);

    await page.getByTestId('admin.user.mutation.open_tasks').click();
    await expect(page.getByTestId('tasks.drawer')).toBeVisible();
    await page.getByTestId('tasks.close-button').click();
    await expect(page.getByTestId('admin.user.mutation.acknowledge')).toBeDisabled();

    await page.getByTestId('admin.user.mutation.refresh').click();
    await expect(page.getByTestId('admin.user.mutation.acknowledge')).toBeEnabled();
    await expect.poll(() => updateRequests).toBe(1);

    await page.getByTestId('admin.user.mutation.acknowledge').click();
    await expect(page.getByTestId('admin.user.mutation.uncertain')).toHaveCount(0);
    await expect.poll(() => updateRequests).toBe(1);
  });
}

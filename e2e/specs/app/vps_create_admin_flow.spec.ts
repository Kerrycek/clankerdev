import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function choicesHandlers() {
  return {
    'GET users/1': () => ({ user: { id: 1, login: 'admin', full_name: 'Admin Example', level: 99 } }),
    'GET locations': () => ({
      locations: [
        {
          id: 2,
          label: 'Praha',
          environment: { id: 1, label: 'Test' },
        },
      ],
    }),
    'GET nodes': () => ({
      nodes: [
        {
          id: 101,
          name: 'node101',
          type: 'node',
          hypervisor_type: 'vpsadminos',
          location: { id: 2, label: 'Praha' },
        },
      ],
    }),
    'GET os_templates': () => ({
      os_templates: [
        {
          id: 6,
          label: 'Debian 12',
          distribution: 'Debian',
          version: '12',
          arch: 'x86_64',
          os_family: { id: 1, label: 'Linux' },
        },
      ],
    }),
    'GET default_object_cluster_resources': () => ({
      default_object_cluster_resources: [
        { id: 1, cluster_resource: { name: 'cpu' }, value: 2 },
        { id: 2, cluster_resource: { name: 'memory' }, value: 2048 },
        { id: 3, cluster_resource: { name: 'diskspace' }, value: 10240 },
        { id: 4, cluster_resource: { name: 'swap' }, value: 512 },
        { id: 5, cluster_resource: { name: 'ipv4' }, value: 1 },
        { id: 6, cluster_resource: { name: 'ipv6' }, value: 1 },
        { id: 7, cluster_resource: { name: 'ipv4_private' }, value: 0 },
      ],
    }),
    'POST vpses': () => {
      return {
        status: true,
        response: {
          vps: { id: 150, hostname: 'created.example' },
          _meta: { action_state_id: 42 },
        },
      };
    },
  };
}

test.describe('@workflow-matrix @pr-smoke VPS create admin flow', () => {
  test('incomplete create points to the first missing field before offering creation', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: choicesHandlers(),
    });

    await page.goto('/admin/vps/new?user=1');
    await expect(page.getByTestId('vps.create.submit')).toHaveText('Review missing fields');
    await page.getByTestId('vps.create.submit').click();

    await expect(page.getByTestId('vps.create.validation')).toBeVisible();
    await expect(page.getByTestId('vps.create.location')).toBeFocused();

    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.node').selectOption('101');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.hostname').fill('ready.example');
    await expect(page.getByTestId('vps.create.submit')).toHaveText('Create VPS');
  });

  test('keeps guard identity and payload on the submitted snapshot, then clears the receipt', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_USER' });
    const createBodies: any[] = [];
    let receiptAtRequest: unknown = null;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/vpses')) {
        createBodies.push(request.postDataJSON());
      }
    });
    await installHaveApiMock(page, {
      user: { id: 2, login: 'member', level: 1 },
      handlers: choicesHandlers(),
    });
    await page.route(/\/api\/v7\.0\/vpses$/, async (route) => {
      if (route.request().method() === 'POST') {
        receiptAtRequest = await page.evaluate(() => {
          const key = Object.keys(localStorage).find((item) => (
            item.startsWith('webui-next.vps-create-outcome-uncertain')
          ));
          return key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
        });
      }
      await route.fallback();
    });
    await page.goto('/app/vps/new');
    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.hostname').fill('snapshot-a.example');
    await page.evaluate(() => {
      const locks = navigator.locks as any;
      const original = locks.request.bind(locks);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      (window as any).__releaseCreateGuard = release;
      locks.request = (name: string, ...args: any[]) => (
        name.includes('vps-create-outcome-uncertain') ? gate.then(() => original(name, ...args)) : original(name, ...args)
      );
    });

    await page.getByTestId('vps.create.submit').click();
    await page.getByTestId('vps.create.hostname').fill('rerendered-b.example');
    await page.evaluate(() => (window as any).__releaseCreateGuard());
    await expect(page).toHaveURL(/\/app\/vps\/150$/);

    expect(createBodies).toHaveLength(1);
    expect(createBodies[0].vps.hostname).toBe('snapshot-a.example');
    expect(receiptAtRequest).toEqual(expect.objectContaining({
      phase: 'pending',
      identity: expect.objectContaining({ hostname: 'snapshot-a.example', ownerId: 2, locationId: 2 }),
    }));
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => (
      key.startsWith('webui-next.vps-create-outcome-uncertain')
    )))).toEqual([]);
  });

  test('keeps an admin in user-scope create flow on app route', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });
    const createBodies: unknown[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/vpses')) {
        createBodies.push(JSON.parse(req.postData() ?? '{}'));
      }
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: choicesHandlers(),
    });

    await page.goto('/app/vps/new');

    await expect(page).toHaveURL(/\/app\/vps\/new$/);
    await expect(page.getByTestId('vps.create.user')).toBeHidden();
    await expect(page.getByTestId('vps.create.node')).toBeHidden();

    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.hostname').fill('user-scope-created.example');
    await page.getByTestId('vps.create.submit').click();

    await expect(page).toHaveURL(/\/app\/vps\/150$/);

    expect(createBodies).toHaveLength(1);
    const body = createBodies[0] as any;
    expect(body.vps).toMatchObject({
      user: 1,
      node: 101,
      hostname: 'user-scope-created.example',
      os_template: 6,
    });
    expect(body.vps).not.toHaveProperty('location');
    expect(body.vps).not.toHaveProperty('environment');
  });

  test('admin user-scope create auto-picks a VPS hypervisor node only', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });
    const createBodies: unknown[] = [];
    const nodeRequests: URL[] = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'GET' && url.pathname.endsWith('/nodes')) {
        nodeRequests.push(url);
      }
      if (req.method() === 'POST' && url.pathname.endsWith('/vpses')) {
        createBodies.push(JSON.parse(req.postData() ?? '{}'));
      }
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        ...choicesHandlers(),
        'GET nodes': () => ({
          nodes: [
            {
              id: 5,
              name: 'vpsadmin1.prg',
              type: 'mailer',
              hypervisor_type: null,
              location: { id: 2, label: 'Praha' },
            },
            {
              id: 101,
              name: 'node101',
              type: 'node',
              hypervisor_type: 'vpsadminos',
              location: { id: 2, label: 'Praha' },
            },
          ],
        }),
      },
    });

    await page.goto('/app/vps/new');

    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.hostname').fill('hypervisor-picked.example');
    await page.getByTestId('vps.create.submit').click();

    await expect(page).toHaveURL(/\/app\/vps\/150$/);

    expect(nodeRequests.some((url) => url.searchParams.get('node[type]') === 'node')).toBe(true);
    expect(nodeRequests.some((url) => url.searchParams.get('node[hypervisor_type]') === 'vpsadminos')).toBe(true);
    expect(createBodies).toHaveLength(1);
    const body = createBodies[0] as any;
    expect(body.vps.node).toBe(101);
    expect(body.vps.node).not.toBe(5);
  });

  test('regular user create flow still sends location for backend node picking', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_USER' });
    const createBodies: unknown[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/vpses')) {
        createBodies.push(JSON.parse(req.postData() ?? '{}'));
      }
    });

    await installHaveApiMock(page, {
      user: { id: 2, login: 'member', level: 1 },
      handlers: choicesHandlers(),
    });

    await page.goto('/app/vps/new');

    await expect(page.getByTestId('vps.create.user')).toBeHidden();
    await expect(page.getByTestId('vps.create.node')).toBeHidden();

    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.hostname').fill('member-created.example');
    await page.getByTestId('vps.create.submit').click();

    await expect(page).toHaveURL(/\/app\/vps\/150$/);

    expect(createBodies).toHaveLength(1);
    const body = createBodies[0] as any;
    expect(body.vps).toMatchObject({
      location: 2,
      hostname: 'member-created.example',
      os_template: 6,
    });
    expect(body.vps).not.toHaveProperty('user');
    expect(body.vps).not.toHaveProperty('node');
  });

  test('admin create payload does not include location and keeps the selected member context', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });

    const createBodies: unknown[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/vpses')) {
        createBodies.push(JSON.parse(req.postData() ?? '{}'));
      }
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        ...choicesHandlers(),
        'POST vpses': () => {
          return {
            status: true,
            response: {
              vps: { id: 150, hostname: 'admin-created.example' },
              _meta: { action_state_id: 42 },
            },
          };
        },
        'GET action_states/42': () => ({
          action_state: {
            id: 42,
            label: 'Create VPS',
            state: 'done',
            created_at: '2026-05-24T17:07:47.000Z',
            updated_at: '2026-05-24T17:08:24.000Z',
            current: 8,
            total: 8,
            unit: 'tx',
            finished: true,
            status: true,
            can_cancel: false,
          },
        }),
        'GET transaction_chains/42': () => ({
          transaction_chain: { id: 42, name: 'create', state: 'done', size: 8, progress: 8 },
        }),
      },
    });

    await page.goto('/admin/vps/new?user=1');
    await expect(page.getByTestId('vps.create')).toBeVisible();

    await expect(page.getByTestId('vps.create.user')).toHaveValue('1');
    await expect(page.getByTestId('vps.create.owner.selection')).toContainText('admin');
    await expect(page.getByTestId('vps.create.owner.selection')).toContainText('#1');
    await expect(page.getByTestId('vps.create.review.owner')).toContainText('admin');
    await expect(page.getByTestId('vps.create.review.owner')).toContainText('#1');
    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.node').selectOption('101');
    await page.getByTestId('vps.create.hostname').fill('admin-created.example');
    await page.getByTestId('vps.create.submit').click();

    await expect(page).toHaveURL(/\/admin\/vps\/150\?user=1$/);

    expect(createBodies).toHaveLength(1);
    const body = createBodies[0] as any;
    expect(body.vps).toMatchObject({
      user: 1,
      node: 101,
      hostname: 'admin-created.example',
      os_template: 6,
    });
    expect(body.vps).not.toHaveProperty('location');
    expect(body.vps).not.toHaveProperty('environment');
  });

  test('admin create stays blocked until a numeric owner resolves to an existing user', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });
    let createRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/vpses')) createRequests += 1;
    });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        ...choicesHandlers(),
        'GET users/999': () => ({ status: false, message: 'Object not found', response: null }),
      },
    });

    await page.goto('/admin/vps/new?user=999');
    await page.getByTestId('vps.create.location').selectOption('2');
    await page.getByTestId('vps.create.os_template').selectOption('6');
    await page.getByTestId('vps.create.node').selectOption('101');
    await page.getByTestId('vps.create.hostname').fill('invalid-owner.example');

    await expect(page.getByTestId('vps.create.owner.error')).toContainText('#999');
    await expect(page.getByTestId('vps.create.review.owner')).toContainText('#999');
    await expect(page.getByTestId('vps.create.submit')).toHaveText('Review missing fields');
    await page.getByTestId('vps.create.submit').click();
    await expect(page.getByTestId('vps.create.validation')).toContainText('could not be loaded');
    await expect(page.getByTestId('vps.create.user')).toBeFocused();
    expect(createRequests).toBe(0);
  });
});

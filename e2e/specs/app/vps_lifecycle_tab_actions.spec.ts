import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: false,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 0,
  loadavg1: 0,
  node: { id: 1, domain_name: 'node1.example', location: { id: 2, label: 'Praha-2' } },
  user: { id: 7, login: 'owner' },
  os_template: { id: 6, label: 'Debian latest' },
  dns_resolver: 'inherit',
};

const osTemplates = [
  { id: 6, label: 'Debian latest', enabled: true, hypervisor_type: 'vpsadminos' },
  { id: 7, label: 'AlmaLinux 9', enabled: true, hypervisor_type: 'vpsadminos' },
];

async function installLifecycleMock(page: Page) {
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET os_templates': () => ({ os_templates: osTemplates }),
      'PUT vpses/123': () => ({ vps, _meta: { action_state_id: 506 } }),
      'POST vpses/123/clone': () => ({ vps: { id: 456, hostname: 'admin-clone' }, _meta: { action_state_id: 507 } }),
      'POST vpses/123/swap_with': () => ({ _meta: { action_state_id: 508 } }),
      'POST vpses/123/replace': () => ({ vps: { id: 789, hostname: 'replacement' }, _meta: { action_state_id: 509 } }),
      'POST vpses/123/boot': () => ({ _meta: { action_state_id: 501 } }),
      'POST vpses/123/reinstall': () => ({ _meta: { action_state_id: 502 } }),
      'POST vpses/123/migrate': () => ({ _meta: { action_state_id: 510 } }),
      'DELETE vpses/123': () => ({ _meta: { action_state_id: 511 } }),
    },
  });
}

test.describe('@pr-smoke VPS lifecycle tab', () => {
  test('posts legacy rescue boot payload', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await expect(page.getByTestId('vps.lifecycle.page')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.boot')).toBeVisible();

    await page.getByTestId('vps.lifecycle.boot.os_template').selectOption('7');
    await page.getByTestId('vps.lifecycle.boot.mountpoint').fill('/mnt/rescue-root');
    await page.getByTestId('vps.lifecycle.boot.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/boot')
    );

    await page.getByTestId('vps.lifecycle.boot.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 7,
        mount_root_dataset: '/mnt/rescue-root',
      },
    });
  });

  test('can boot rescue template without mounting the original root dataset', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.boot.mount_root_dataset').uncheck();
    await expect(page.getByTestId('vps.lifecycle.boot.mountpoint')).toBeDisabled();
    await page.getByTestId('vps.lifecycle.boot.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/boot')
    );

    await page.getByTestId('vps.lifecycle.boot.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 6,
      },
    });
  });

  test('posts legacy reinstall payload from lifecycle tab', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.reinstall.os_template').selectOption('7');
    await page.getByTestId('vps.lifecycle.reinstall.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/reinstall')
    );

    await page.getByTestId('vps.lifecycle.reinstall.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 7,
      },
    });
  });

  test('admin clone posts owner and node payload, not location', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.clone.user').fill('#8');
    await page.getByTestId('vps.lifecycle.clone.node').fill('#3');
    await page.getByTestId('vps.lifecycle.clone.hostname').fill('admin-clone');
    await page.getByTestId('vps.lifecycle.clone.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/clone')
    );

    await page.getByTestId('vps.lifecycle.clone.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        hostname: 'admin-clone',
        subdatasets: true,
        dataset_plans: true,
        resources: true,
        features: true,
        stop: true,
        user: 8,
        node: 3,
      },
    });
    await expect(page).toHaveURL(/\/admin\/vps\/456$/);
  });

  test('admin swap includes legacy admin-only options', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.swap.target').fill('#321');
    await page.getByTestId('vps.lifecycle.swap.resources').uncheck();
    await page.getByTestId('vps.lifecycle.swap.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/swap_with')
    );

    await page.getByTestId('vps.lifecycle.swap.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        vps: 321,
        hostname: true,
        resources: false,
        expirations: true,
      },
    });
  });

  test('admin template update posts OS template and auto-update flag', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.template.os_template').selectOption('7');
    await page.getByTestId('vps.lifecycle.template.auto_update').check();
    await page.getByTestId('vps.lifecycle.template.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'PUT' && r.url().includes('/api/v7.0/vpses/123')
    );

    await page.getByTestId('vps.lifecycle.template.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        os_template: 7,
        enable_os_template_auto_update: true,
      },
    });
  });

  test('admin replace posts node, expiration, start and reason payload', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);
    const expirationInput = '2026-07-01T12:30';
    const expectedExpirationIso = new Date(expirationInput).toISOString();

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.replace.node').fill('#4');
    await page.getByTestId('vps.lifecycle.replace.expiration').fill(expirationInput);
    await page.getByTestId('vps.lifecycle.replace.start').check();
    await page.getByTestId('vps.lifecycle.replace.reason').fill('staging replacement');
    await page.getByTestId('vps.lifecycle.replace.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/replace')
    );

    await page.getByTestId('vps.lifecycle.replace.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        node: 4,
        expiration_date: expectedExpirationIso,
        start: true,
        reason: 'staging replacement',
      },
    });
    await expect(page).toHaveURL(/\/admin\/vps\/789$/);
  });

  test('admin migrate posts migration options and schedule payload', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.migrate.node').fill('#5');
    await page.getByTestId('vps.lifecycle.migrate.replace_ip_addresses').check();
    await page.getByTestId('vps.lifecycle.migrate.transfer_ip_addresses').uncheck();
    await page.getByTestId('vps.lifecycle.migrate.stop_on_error').check();
    await page.getByTestId('vps.lifecycle.migrate.cleanup_data').check();
    await page.getByTestId('vps.lifecycle.migrate.send_mail').check();
    await page.getByTestId('vps.lifecycle.migrate.finish_weekday').fill('2');
    await page.getByTestId('vps.lifecycle.migrate.finish_minutes').fill('90');
    await page.getByTestId('vps.lifecycle.migrate.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/migrate')
    );

    await page.getByTestId('vps.lifecycle.migrate.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        node: 5,
        replace_ip_addresses: true,
        transfer_ip_addresses: false,
        maintenance_window: false,
        stop_on_error: true,
        cleanup_data: true,
        send_mail: true,
        finish_weekday: 2,
        finish_minutes: 90,
      },
    });
  });

  test('admin delete can request lazy delete', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installLifecycleMock(page);

    await page.goto('/admin/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.delete.lazy').check();
    await page.getByTestId('vps.lifecycle.delete.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/vpses/123')
    );

    await page.getByTestId('vps.lifecycle.delete.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        lazy: true,
      },
    });
    await expect(page).toHaveURL(/\/admin\/vps$/);
  });

  test('regular user gets legacy clone, swap and delete actions without admin-only lifecycle actions', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 7, login: 'owner', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'GET vpses/123': () => ({ vps }),
        'GET locations': () => ({ locations: [{ id: 2, label: 'Praha-2' }] }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'DELETE vpses/123': () => ({ _meta: { action_state_id: 503 } }),
      },
    });

    await page.goto('/app/vps/123/lifecycle');

    await expect(page.getByTestId('vps.lifecycle.page')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.clone')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.swap')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.delete')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.replace')).toHaveCount(0);
    await expect(page.getByTestId('vps.lifecycle.migrate')).toHaveCount(0);
    await expect(page.getByTestId('vps.lifecycle.reinstall')).toHaveCount(0);
    await expect(page.getByTestId('vps.lifecycle.delete.lazy')).toHaveCount(0);

    await page.getByTestId('vps.lifecycle.delete.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/vpses/123')
    );

    await page.getByTestId('vps.lifecycle.delete.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        lazy: false,
      },
    });
    await expect(page).toHaveURL(/\/app\/vps$/);
  });

  test('regular user clone posts location payload without admin owner or node', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 7, login: 'owner', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'GET vpses/123': () => ({ vps }),
        'GET locations': () => ({ locations: [{ id: 2, label: 'Praha-2' }] }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST vpses/123/clone': () => ({ vps: { id: 456, hostname: 'vps123-playground' }, _meta: { action_state_id: 504 } }),
      },
    });

    await page.goto('/app/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.clone.location').selectOption('2');
    await page.getByTestId('vps.lifecycle.clone.hostname').fill('vps123-playground');
    await page.getByTestId('vps.lifecycle.clone.confirm').check();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/clone')
    );

    await page.getByTestId('vps.lifecycle.clone.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        hostname: 'vps123-playground',
        subdatasets: true,
        dataset_plans: true,
        resources: true,
        features: true,
        stop: true,
        location: 2,
      },
    });
    await expect(page).toHaveURL(/\/app\/vps\/456$/);
  });

  test('regular user swap posts only target VPS without admin-only options', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 7, login: 'owner', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'GET vpses/123': () => ({ vps }),
        'GET locations': () => ({ locations: [{ id: 2, label: 'Praha-2' }] }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST vpses/123/swap_with': () => ({ _meta: { action_state_id: 505 } }),
      },
    });

    await page.goto('/app/vps/123/lifecycle');

    await page.getByTestId('vps.lifecycle.swap.target').fill('#321');
    await page.getByTestId('vps.lifecycle.swap.confirm').check();
    await expect(page.getByTestId('vps.lifecycle.swap.hostname')).toHaveCount(0);

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/swap_with')
    );

    await page.getByTestId('vps.lifecycle.swap.submit').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      vps: {
        vps: 321,
      },
    });
  });
});

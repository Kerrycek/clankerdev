import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 12345,
  loadavg1: 0.12,
  dataset: { id: 10, name: 'tank/data' },
  node: {
    id: 1,
    domain_name: 'node1.example',
    location: { id: 2, label: 'Praha', remote_console_server: '/_console', environment: { id: 1, label: 'prod' } },
  },
  user: { id: 10, login: 'alice' },
  os_template: { id: 6, label: 'Debian 12' },
  dns_resolver: 'inherit',
};

const dataset = {
  id: 10,
  name: 'tank/data',
  full_name: 'tank/data',
  used: 5120,
  avail: 15360,
  referenced: 4096,
  refquota: 20480,
  quota: 0,
  snapshots_count: 1,
  mount_count: 1,
  export_count: 0,
  object_state: 'active',
};

async function captureOptInScreenshot(page: Page, envName: string): Promise<void> {
  const screenshotPath = process.env[envName]?.trim();
  if (!screenshotPath) return;
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

test('@workflow-matrix @smoke VPS detail tabs expose storage and backups, access, lifecycle, and console routes', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_USER_SESSION' });

  await page.route('**/_console/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>console stub</body></html>',
    });
  });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [vps], _meta: { total_count: 1 } }),
      'GET vpses/123': () => ({ vps }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
      'GET user_namespace_maps': () => ({ user_namespace_maps: [] }),
      'GET datasets/10': () => ({ dataset }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'GET vpses/123/mounts': () => ({
        mounts: [
          {
            id: 1,
            mountpoint: '/mnt/data',
            type: 'nfs',
            mode: 'rw',
            enabled: true,
            on_start_fail: 'ignore',
            use_default_map: true,
            dataset: { id: 10, name: 'tank/data' },
          },
        ],
      }),
      'GET vpses/123/state_logs': () => ({ state_logs: [] }),
      'GET os_templates': () => ({
        os_templates: [{ id: 6, label: 'Debian 12', enabled: true, hypervisor_type: 'vpsadminos' }],
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'POST vpses/123/console_token': () => ({
        token: 'T1',
        expiration: '2027-01-31T00:00:00Z',
      }),
    },
  });

  await page.goto('/app/vps');
  await page.getByRole('link', { name: /vps123\.example/i }).click();

  await expect(page).toHaveURL(/\/app\/vps\/123$/);
  await expect(page.getByTestId('vps.header')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/app\/vps\/123$/);
  await expect(page.getByTestId('vps.header')).toBeVisible();

  const vpsHeader = page.getByTestId('vps.header');
  await expect(vpsHeader.getByRole('link', { name: /^Storage & backups$/ })).toHaveAttribute('href', '/app/vps/123/storage');
  await expect(vpsHeader.getByRole('link', { name: /^Access$/ })).toHaveAttribute('href', '/app/vps/123/access');
  await expect(vpsHeader.getByRole('link', { name: /^Console$/ }).first()).toHaveAttribute('href', '/app/vps/123/console');

  await expect(page.getByTestId('vps.overview.control_center')).toBeVisible();
  await expect(page.getByTestId('vps.overview.health')).toBeVisible();
  await expect(page.getByTestId('vps.overview.resources_usage.card')).toBeVisible();
  await expect(page.getByTestId('vps.overview.status_access.card')).toBeVisible();
  await expect(page.getByTestId('vps.overview.access.console')).toHaveAttribute('href', '/app/vps/123/console');
  await expect(page.getByTestId('vps.overview.network.card')).toBeVisible();
  await expect(page.getByTestId('vps.overview.storage.card')).toBeVisible();
  await expect(page.getByTestId('vps.overview.diagnostics.card')).toBeVisible();
  await expect(page.getByTestId('vps.overview.lifecycle')).toBeVisible();
  await expect(page.getByTestId('vps.overview.config.owner')).toHaveCount(0);
  await expect(page.getByTestId('vps.overview.admin_ops.card')).toHaveCount(0);
  await expect(page.getByTestId('vps.action.snapshot')).toHaveAttribute(
    'href',
    '/app/datasets/10/snapshots?action=create'
  );
  const moreActions = page.getByTestId('vps.actions.menu');
  await expect(moreActions).toBeVisible();
  await expect(moreActions.locator('option[value="/app/vps/123/lifecycle/reinstall"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/lifecycle/clone"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/lifecycle/swap"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/lifecycle/delete"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/lifecycle/migrate"]')).toHaveCount(0);
  await expect(moreActions.locator('option[value="/app/vps/123/storage"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/access"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/app/vps/123/console"]')).toHaveCount(0);
  await expect(moreActions.locator('option[value="/app/transactions?class_name=Vps&row_id=123"]')).toHaveCount(1);

  await captureOptInScreenshot(page, 'E2E_VPS_USER_OVERVIEW_SCREENSHOT');

  await moreActions.selectOption('/app/vps/123/config');
  await expect(page).toHaveURL(/\/app\/vps\/123\/config$/);
  await expect(page.getByText('Boot preferences')).toBeVisible();
  await expect(page.getByText('Basic runtime preferences available to a member.')).toBeVisible();
  await expect(page.getByText('Start menu timeout', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
  await expect(page.getByText('CPU limit', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Autostart priority', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Change reason', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Admin lock type', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Admin override', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: /^Storage & backups$/ }).click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/storage$/);
  await expect(page.getByTestId('vps.storage.page')).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.getByTestId('vps.storage.mounts.card.1')).toBeVisible();
  } else {
    await expect(page.getByTestId('vps.storage.mounts.table')).toBeVisible();
  }

  await page.goto('/app/vps/123');
  await page.getByTestId('vps.actions.menu').selectOption('/app/vps/123/lifecycle/clone');
  await expect(page).toHaveURL(/\/app\/vps\/123\/lifecycle\/clone$/);
  await expect(page.getByTestId('vps.lifecycle.clone')).toBeVisible();
  await expect(page.getByTestId('vps.lifecycle.replace')).toHaveCount(0);

  await page.getByRole('link', { name: /^Console$/ }).first().click();
  await expect(page).toHaveURL(/\/app\/vps\/123\/console$/);
  await expect(page.getByTestId('vps.console.page')).toBeVisible();
  await expect(page.getByTestId('vps.console.not_started')).toBeVisible();
  await page.getByTestId('vps.console.new_session').click();
  await expect(page.getByTestId('vps.console.iframe')).toBeVisible();
});

test('@workflow-matrix admin account in user VPS view keeps storage admin controls hidden', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN_SESSION' });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice-admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET datasets/10': () => ({ dataset }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'GET vpses/123/mounts': () => ({
        mounts: [
          {
            id: 1,
            mountpoint: '/mnt/data',
            type: 'nfs',
            mode: 'rw',
            enabled: true,
            master_enabled: false,
            on_start_fail: 'ignore',
            use_default_map: true,
            dataset: { id: 10, name: 'tank/data' },
          },
        ],
      }),
    },
  });

  await page.goto('/app/vps/123/storage');

  await expect(page.getByTestId('vps.storage.page')).toBeVisible();
  await expect(page.getByTestId('vps.storage.root_dataset.system_context')).toHaveCount(0);
  await expect(page.getByTestId('vps.storage.mounts.table').locator('th', { hasText: /^Master$/ })).toHaveCount(0);
  await expect(page.getByTestId('vps.storage.mounts.table')).not.toContainText('Master:');

  const editMountTestId = (page.viewportSize()?.width ?? 0) < 768
    ? 'vps.storage.mounts.card.1.edit'
    : 'vps.storage.mounts.row.1.edit';
  await page.getByTestId(editMountTestId).click();
  await expect(page.getByTestId('vps.storage.mounts.edit')).toBeVisible();
  await expect(page.getByTestId('vps.storage.mounts.edit.master_enabled')).toHaveCount(0);
});


test('@workflow-matrix @pr-smoke @pr-smoke-mobile VPS admin overview keeps each fact in one compact place', async ({
  page,
}, testInfo) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN_SESSION' });
  let statusesCalls = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({
        vps: {
          ...vps,
          user: { id: 10, login: 'alice-with-an-exceptionally-long-owner-login-that-must-wrap' },
          pool: { id: 9, name: 'tank' },
          dataset: { id: 10, full_name: 'tank/data', name: 'tank/data' },
          expiration_date: '2027-01-31T00:00:00Z',
          created_at: '2026-01-01T12:00:00Z',
        },
      }),
      'GET ip_addresses': () => ({
        ip_addresses: [
          {
            id: 501,
            addr: '198.51.100.10',
            prefix: 32,
            routed: true,
            network: { id: 55, label: 'public 198.51.100.0/24', ip_version: 4, role: 'public_access' },
            user: { id: 10, login: 'alice' },
          },
          {
            id: 502,
            addr: '10.0.0.15',
            prefix: 32,
            network: { id: 56, label: 'private 10.0.0.0/24', ip_version: 4, role: 'private_access' },
          },
          {
            id: 503,
            addr: '2001:db8:1234:5678:90ab:cdef:1234:5678',
            prefix: 64,
            network: { id: 57, label: 'public IPv6', ip_version: 6, role: 'public_access' },
          },
        ],
      }),
      'GET transaction_chains': () => ({
        transaction_chains: [
          {
            id: 9001,
            label: 'Start VPS',
            state: 'done',
            created_at: '2026-01-02T12:00:00Z',
            finished_at: '2026-01-02T12:01:00Z',
          },
        ],
      }),
      'GET vpses/123/statuses': () => {
        statusesCalls += 1;
        return { statuses: [] };
      },
      'GET vpses/123/state_logs': () => ({ state_logs: [] }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
      'GET user_namespace_maps': () => ({ user_namespace_maps: [] }),
    },
  });

  await page.goto('/admin/vps/123');

  await expect(page.getByTestId('vps.header')).toBeVisible();
  const overview = page.getByTestId('vps.overview.control_center');
  const resources = page.getByTestId('vps.overview.resources_usage.card');
  const network = page.getByTestId('vps.overview.network.card');
  const storage = page.getByTestId('vps.overview.storage.card');
  const activity = page.getByTestId('vps.overview.tx.card');
  const metrics = page.getByTestId('vps.overview.metrics.card');
  await expect(overview).toBeVisible();
  await expect(page.getByTestId('vps.overview.health')).toHaveCount(0);
  await expect(page.getByTestId('vps.header.owner')).toContainText('alice');
  await expect(page.getByTestId('vps.header.owner')).toContainText('#10');
  await expect(page.getByTestId('vps.header.owner').getByRole('link')).toHaveAttribute('href', '/admin/users/10');
  await expect(resources).toBeVisible();
  await expect(page.getByTestId('vps.overview.resources_usage.runtime')).toBeVisible();
  await expect(page.getByTestId('vps.overview.status_access.card')).toHaveCount(0);
  await expect(network).toBeVisible();
  await expect(storage).toBeVisible();
  await expect(storage).toContainText('Pool: tank');
  await expect(storage).toContainText('Root dataset, pool and VPS backups.');
  await expect(page.getByTestId('vps.overview.admin_ops.card')).toHaveCount(0);
  await expect(overview).not.toContainText('alice');
  await expect(page.getByTestId('vps.overview.admin_ops.user_id')).toHaveCount(0);
  await expect(page.getByTestId('vps.overview.admin_ops.node')).toHaveCount(0);
  await expect(page.getByTestId('vps.overview.admin_ops.dataset')).toHaveCount(0);
  await expect(page.getByTestId('vps.overview.admin_ops.ips')).toHaveCount(0);
  await expect(network).not.toContainText('alice');

  for (const address of [
    '198.51.100.10/32',
    '10.0.0.15/32',
    '2001:db8:1234:5678:90ab:cdef:1234:5678/64',
  ]) {
    await expect(overview.getByText(address, { exact: true })).toHaveCount(1);
  }

  await expect(activity).toBeVisible();
  await expect(page.getByTestId('vps.overview.lifecycle')).toHaveCount(0);
  await expect(page.getByTestId('vps.overview.management.admin_context')).toHaveCount(0);

  await expect(metrics).toBeVisible();
  const metricsToggle = page.getByTestId('vps.overview.metrics.toggle');
  await expect(metricsToggle).toHaveAttribute('aria-expanded', 'false');
  expect(statusesCalls).toBe(0);
  await metricsToggle.click();
  await expect(metricsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => statusesCalls).toBeGreaterThan(0);
  await expect(metrics).toContainText('No metrics samples.');
  await metricsToggle.click();
  await expect(metricsToggle).toHaveAttribute('aria-expanded', 'false');

  const widths = testInfo.project.name === 'mobile-chrome' ? [320, 390] : [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoDocumentHorizontalOverflow(page);

    const viewport = page.viewportSize();
    const networkBox = await network.boundingBox();
    const ownerBox = await page.getByTestId('vps.header.owner').boundingBox();
    const ipv6Copy = network
      .locator('li')
      .filter({ hasText: '2001:db8:1234:5678:90ab:cdef:1234:5678' })
      .getByRole('button');
    const copyBox = await ipv6Copy.boundingBox();
    expect(networkBox).not.toBeNull();
    expect(ownerBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(networkBox!.x).toBeGreaterThanOrEqual(0);
    expect(networkBox!.x + networkBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(ownerBox!.x + ownerBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(copyBox!.x + copyBox!.width).toBeLessThanOrEqual(networkBox!.x + networkBox!.width + 1);
    expect(copyBox!.x + copyBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(copyBox!.height).toBeGreaterThanOrEqual(44);
    await expect(ipv6Copy).toBeVisible();
  }
  if (widths.length === 0) {
    await expectNoDocumentHorizontalOverflow(page);
    const overviewBox = await overview.boundingBox();
    const resourcesBox = await resources.boundingBox();
    const networkBox = await network.boundingBox();
    const storageBox = await storage.boundingBox();
    const activityBox = await activity.boundingBox();
    expect(overviewBox).not.toBeNull();
    expect(resourcesBox).not.toBeNull();
    expect(networkBox).not.toBeNull();
    expect(storageBox).not.toBeNull();
    expect(activityBox).not.toBeNull();
    expect(Math.abs(resourcesBox!.y - networkBox!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(storageBox!.y - activityBox!.y)).toBeLessThanOrEqual(2);
    expect(resourcesBox!.width).toBeLessThan(overviewBox!.width * 0.6);
    expect(networkBox!.width).toBeLessThan(overviewBox!.width * 0.6);
  }

  const moreActions = page.getByTestId('vps.actions.menu');
  await expect(moreActions.locator('option[value="/admin/vps/123/config"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/vps/123/lifecycle"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/oom-reports?vps=123"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/oom-reports/rules/123"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/incidents?vps=123"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/incidents/new?vps=123"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/vps/123/lifecycle/migrate"]')).toHaveCount(1);
  await expect(moreActions.locator('option[value="/admin/transactions?class_name=Vps&row_id=123"]')).toHaveCount(1);
  const actionValues = (await moreActions.locator('option').evaluateAll((options) => (
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
  )));
  expect(actionValues).toEqual([...new Set(actionValues)]);

  await captureOptInScreenshot(page, 'E2E_VPS_ADMIN_OVERVIEW_SCREENSHOT');

  await moreActions.selectOption('/admin/vps/123/config');
  await expect(page).toHaveURL(/\/admin\/vps\/123\/config$/);
  await expect(page.getByText('Start menu timeout', { exact: true })).toBeVisible();
  await expect(page.getByText('Owner', { exact: true })).toBeVisible();
  await expect(page.getByText('CPU limit', { exact: true })).toBeVisible();
  await expect(page.getByText('Autostart priority', { exact: true })).toBeVisible();
  await expect(page.getByText('Change reason', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin lock type', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin override', { exact: true })).toBeVisible();
});

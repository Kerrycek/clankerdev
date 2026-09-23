import { expect, test, type Page } from '@playwright/test';

import {
  bootstrapVpsAdminWindow,
  failEnvelope,
  installHaveApiMock,
  setUiSettingsLocalStorage,
  type HaveApiHandler,
} from '../../fixtures';

const node = {
  id: 5,
  domain_name: 'node5.example',
  fqdn: 'node5.example',
  status: true,
  maintenance_lock: false,
  role: 'hypervisor',
  hypervisor_type: 'vpsadminos',
  pool_state: 'online',
  pool_scan: 'none',
  pool_scan_percent: null,
  pool_checked_at: '2026-08-22T10:00:00Z',
};

async function installNodeHandlers(
  page: Page,
  poolsHandler: () => unknown,
  extraHandlers: Record<string, HaveApiHandler> = {},
) {
  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET nodes/5': () => ({ node }),
      'GET nodes': () => ({
        nodes: [node, { id: 6, domain_name: 'node6.example', location: { label: 'DC2' } }],
      }),
      'GET nodes/public_status': () => [{ id: 5, status: true, last_report_at: '2026-08-22T10:00:00Z' }],
      'GET nodes/5/statuses': () => ({ statuses: [] }),
      'GET transactions': () => ({ transactions: [] }),
      'GET pools': poolsHandler,
      ...extraHandlers,
    },
  });
}

test.describe('Admin node detail control center', () => {
  test('@smoke separates overview, storage and admin maintenance workflows', async ({ page }) => {
    await installNodeHandlers(page, () => ({
      pools: [
        {
          id: 11,
          node: 5,
          label: 'fast',
          name: 'tank',
          filesystem: 'tank/fast',
          role: 'hypervisor',
          state: 'online',
          scan: 'scrub',
          scan_percent: 42.5,
          total_space: 2048,
          used_space: 1024,
          available_space: 1024,
          checked_at: '2026-08-22T10:00:00Z',
        },
        {
          id: 12,
          node: 5,
          name: 'backup',
          role: 2,
          state: 2,
          scan: 3,
          scan_percent: 10,
          total_space: 4096,
          used_space: 1024,
          available_space: 3072,
          checked_at: '2026-08-22T10:00:00Z',
        },
      ],
    }));

    await page.goto('/admin/nodes/5');

    await expect(page.getByTestId('admin.node.panel.overview')).toBeVisible();
    await expect(page.getByTestId('admin.node.panel.overview')).toHaveAttribute(
      'aria-labelledby',
      'admin-node-tab-overview',
    );
    await expect(page.getByTestId('admin.node.tab.overview')).toHaveAttribute('tabindex', '0');
    await expect(page.getByTestId('admin.node.tab.storage')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByTestId('admin.node.storage.card')).toHaveCount(0);
    await expect(page.getByTestId('admin.node.maintenance.lock')).toHaveCount(0);

    await page.getByTestId('admin.node.tab.storage').click();
    await expect(page).toHaveURL(/section=storage/);
    await expect(page.getByTestId('admin.node.storage.card')).toBeVisible();
    await expect(page.getByTestId('admin.node.panel.storage')).toHaveAttribute(
      'aria-labelledby',
      'admin-node-tab-storage',
    );
    await expect(page.getByTestId('admin.node.storage.aggregate')).toBeVisible();
    await expect(page.getByTestId('admin.node.storage.pool.11')).toContainText('2.0 GiB');
    await expect(page.getByTestId('admin.node.storage.pool.11')).toContainText('42.5 %');
    await expect(page.getByTestId('admin.node.storage.pool.11')).toContainText('The API did not provide a disk list');
    await expect(page.getByTestId('admin.node.storage.pool.11.devices')).toHaveCount(0);
    await expect(page.getByTestId('admin.node.storage.summary.capacity-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('admin.node.storage.pool.12')).toContainText('Backup');
    await expect(page.getByTestId('admin.node.storage.pool.12')).toContainText('Degraded');
    await expect(page.getByTestId('admin.node.storage.pool.12')).toContainText('Resilver');

    await page.getByTestId('admin.node.tab.maintenance').click();
    await expect(page).toHaveURL(/section=maintenance/);
    await expect(page.getByTestId('admin.node.panel.maintenance')).toBeVisible();
    await expect(page.getByTestId('admin.node.maintenance.lock')).toBeVisible();
    await expect(page.getByTestId('admin.node.storage.card')).toHaveCount(0);

    await page.getByTestId('admin.node.tab.maintenance').press('Home');
    await expect(page.getByTestId('admin.node.panel.overview')).toBeVisible();
    await expect(page.getByTestId('admin.node.tab.overview')).toBeFocused();
    await page.getByTestId('admin.node.tab.overview').press('ArrowLeft');
    await expect(page.getByTestId('admin.node.panel.maintenance')).toBeVisible();
    await expect(page.getByTestId('admin.node.panel.maintenance')).toHaveAttribute(
      'aria-labelledby',
      'admin-node-tab-maintenance',
    );
    await expect(page.getByTestId('admin.node.tab.maintenance')).toBeFocused();
    await page.getByTestId('admin.node.tab.maintenance').press('ArrowRight');
    await expect(page.getByTestId('admin.node.panel.overview')).toBeVisible();
    await page.getByTestId('admin.node.tab.overview').press('End');
    await expect(page.getByTestId('admin.node.panel.maintenance')).toBeVisible();
    await expect(page.getByTestId('admin.node.tab.maintenance')).toBeFocused();
  });

  test('shows capacity as unavailable instead of zero when the API omits it', async ({ page }) => {
    await installNodeHandlers(page, () => ({
      pools: [
        {
          id: 21,
          node: 5,
          name: 'limited',
          role: 'hypervisor',
          state: 'online',
          scan: 'none',
          scan_percent: null,
          checked_at: '2026-08-22T10:00:00Z',
        },
      ],
    }));

    await page.goto('/admin/nodes/5?section=storage');

    await expect(page.getByTestId('admin.node.storage.pool.21.capacity-unavailable')).toContainText(
      'The API did not provide capacity data',
    );
    await expect(page.getByTestId('admin.node.storage.summary.capacity-unavailable')).toBeVisible();
  });

  test('keeps aggregate node storage and navigation usable when /pools fails', async ({ page }) => {
    await installNodeHandlers(page, () => ({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ status: false, message: 'pool service unavailable', response: null }),
    }));

    await page.goto('/admin/nodes/5?section=storage');

    await expect(page.getByTestId('admin.node.header')).toBeVisible();
    await expect(page.getByTestId('admin.node.tabs')).toBeVisible();
    await expect(page.getByTestId('admin.node.storage.aggregate')).toBeVisible();
    await expect(page.getByTestId('admin.node.storage.load_error')).toBeVisible();

    await page.getByTestId('admin.node.tab.overview').click();
    await expect(page.getByTestId('admin.node.panel.overview')).toBeVisible();
  });

  test('does not refetch hidden overview transactions after a maintenance mutation', async ({ page }) => {
    let nodeReads = 0;
    let transactionReads = 0;

    await setUiSettingsLocalStorage(page, { language: 'en' });
    await bootstrapVpsAdminWindow(page);
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET nodes/5': () => {
          nodeReads += 1;
          return { node };
        },
        'GET nodes': () => ({ nodes: [node, { id: 6, domain_name: 'node6.example' }] }),
        'GET nodes/public_status': () => [],
        'GET transactions': () => {
          transactionReads += 1;
          return { transactions: [] };
        },
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST nodes/5/set_maintenance': () => ({}),
      },
    });

    await page.goto('/admin/nodes/5?section=maintenance');
    await expect(page.getByTestId('admin.node.maintenance.lock')).toBeVisible();
    expect(transactionReads).toBe(0);

    await page.getByTestId('admin.node.maintenance.lock').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Lock', exact: true }).click();

    await expect.poll(() => nodeReads).toBeGreaterThan(1);
    expect(transactionReads).toBe(0);
  });

  test('@pr-smoke @pr-smoke-mobile keeps a pending maintenance confirmation visible', async ({ page }) => {
    let maintenanceCalls = 0;
    let releaseMaintenance!: () => void;
    const maintenanceGate = new Promise<void>((resolve) => {
      releaseMaintenance = resolve;
    });

    await installNodeHandlers(
      page,
      () => ({ pools: [] }),
      {
        'POST nodes/5/set_maintenance': async () => {
          maintenanceCalls += 1;
          await maintenanceGate;
          return {};
        },
      },
    );

    await page.goto('/admin/nodes/5?section=maintenance');
    await page.getByTestId('admin.node.maintenance.lock').click();

    const dialog = page.getByRole('dialog');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    const confirm = dialog.getByRole('button', { name: 'Lock', exact: true });

    try {
      await confirm.click();
      await expect.poll(() => maintenanceCalls).toBe(1);
      await expect(cancel).toBeDisabled();
      await expect(confirm).toBeDisabled();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();

      await page.locator('[data-overlay-backdrop="true"]').click({ position: { x: 5, y: 5 } });
      await expect(dialog).toBeVisible();
      expect(maintenanceCalls).toBe(1);
    } finally {
      releaseMaintenance();
    }

    await expect(dialog).toBeHidden();
  });

  test('@pr-smoke @pr-smoke-mobile keeps a rejected node lock in its dialog for retry', async ({ page }) => {
    let maintenanceCalls = 0;

    await installNodeHandlers(
      page,
      () => ({ pools: [] }),
      {
        'POST nodes/5/set_maintenance': () => {
          maintenanceCalls += 1;
          if (maintenanceCalls === 1) return failEnvelope('Node maintenance lock was rejected');
          return {};
        },
      },
    );

    await page.goto('/admin/nodes/5?section=maintenance');
    await page.getByTestId('admin.node.maintenance.lock').click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(dialog).toContainText('Node maintenance lock was rejected');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(maintenanceCalls).toBe(2);
  });
});

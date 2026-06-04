import { expect, test } from '../../fixtures/playwright';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';

function makeVps(id: number) {
  return {
    id,
    hostname: `vps${id}.example`,
    object_state: 'active',
    is_running: true,
    uptime: 12345,
    cpu: 4,
    memory: 4096,
    diskspace: 200_000,
    node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'Praha' } },
  };
}

test.describe('@smoke VPS list row navigation', () => {
  test('clicking a row navigates to VPS detail', async ({ page }) => {
    const vps = makeVps(300);

    await installHaveApiMock(page, {
      handlers: {
        'GET vpses': () => ({ vpses: [vps] }),
        'GET vpses/300': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET vpses/300/statuses': () => ({ statuses: [] }),
      },
    });

    await bootstrapVpsAdminWindow(page);

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.row.300')).toBeVisible();

    await page.getByTestId('vps.row.300').click();

    await expect(page).toHaveURL(/\/app\/vps\/300/);
    await expect(page.getByTestId('vps.header')).toBeVisible();
  });

  test('clicking an action button inside a row does not trigger row navigation', async ({ page }) => {
    const vps = makeVps(300);

    await installHaveApiMock(page, {
      handlers: {
        'GET vpses': () => ({ vpses: [vps] }),
      },
    });

    await bootstrapVpsAdminWindow(page);

    await page.goto('/app/vps');
    const row = page.getByTestId('vps.row.300');
    await expect(row).toBeVisible();

    await row.getByTestId('vps.row.300.action.stop').click();

    await expect(page).toHaveURL(/\/app\/vps(?:\?|$)/);
    await expect(page.getByTestId('vps.list.power_confirm')).toBeVisible();
  });

  test('clicking user delete action opens confirmation without row navigation and sends empty delete payload', async ({ page }) => {
    const vps = makeVps(300);

    await installHaveApiMock(page, {
      user: { id: 42, login: 'owner', level: 1 },
      handlers: {
        'GET vpses': () => ({ vpses: [vps] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'DELETE vpses/300': () => ({ _meta: { action_state_id: 901 } }),
      },
    });

    await bootstrapVpsAdminWindow(page);

    await page.goto('/app/vps');
    const row = page.getByTestId('vps.row.300');
    await expect(row).toBeVisible();

    await row.getByTestId('vps.row.300.action.delete').click();

    await expect(page).toHaveURL(/\/app\/vps(?:\?|$)/);
    await expect(page.getByTestId('vps.list.delete_confirm')).toBeVisible();
    await expect(page.getByTestId('vps.list.delete_confirm.lazy')).toHaveCount(0);

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/vpses/300')
    );

    await page.getByTestId('vps.list.delete_confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({});
    await expect(page).toHaveURL(/\/app\/vps(?:\?|$)/);
  });

  test('admin list delete keeps lazy delete as the legacy default', async ({ page }) => {
    const vps = makeVps(300);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET vpses': () => ({ vpses: [vps] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'DELETE vpses/300': () => ({ _meta: { action_state_id: 902 } }),
      },
    });

    await bootstrapVpsAdminWindow(page);

    await page.goto('/admin/vps');
    const row = page.getByTestId('vps.row.300');
    await expect(row).toBeVisible();

    await row.getByTestId('vps.row.300.action.delete').click();

    await expect(page).toHaveURL(/\/admin\/vps(?:\?|$)/);
    await expect(page.getByTestId('vps.list.delete_confirm')).toBeVisible();
    await expect(page.getByTestId('vps.list.delete_confirm.lazy')).toBeChecked();

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().includes('/api/v7.0/vpses/300')
    );

    await page.getByTestId('vps.list.delete_confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({ vps: { lazy: true } });
    await expect(page).toHaveURL(/\/admin\/vps(?:\?|$)/);
  });
});

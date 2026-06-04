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
});

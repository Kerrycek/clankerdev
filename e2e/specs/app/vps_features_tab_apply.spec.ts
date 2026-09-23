import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

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
  node: { id: 1, domain_name: 'node1.example' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

test.describe('VPS features tab', () => {
  test('applies feature changes via update_all', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const features = [
      { id: 1, name: 'quota', label: 'Quota', enabled: false },
      { id: 2, name: 'xtables', label: 'XTables', enabled: true },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/features': () => ({ features }),
        'POST vpses/123/features/update_all': () => ({ _meta: { action_state_id: 42 } }),
      },
    });

    await page.goto('/app/vps/123/features');

    await expect(page.getByTestId('vps.features.page')).toBeVisible();
    await expect(page.getByTestId('vps.features.card')).toBeVisible();

    // Flip quota from false -> true to create a dirty draft.
    await page.getByTestId('vps.features.item.1').click();

    await expect(page.getByTestId('vps.features.save')).toBeEnabled();
    await page.getByTestId('vps.features.save').click();

    await expect(page.getByTestId('vps.features.confirm')).toBeVisible();
    await expect(page.getByTestId('vps.features.confirm.target')).toContainText('vps123.example');
    await expect(page.getByTestId('vps.features.confirm.target')).toContainText('#123');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/features/update_all')
    );

    await page.getByTestId('vps.features.confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({
      feature: {
        quota: true,
        xtables: true,
      },
    });

    await expect(page.getByTestId('vps.features.confirm')).toBeHidden();
  });

  test('keeps a rejected update in the confirmation and supports retry', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const features = [
      { id: 1, name: 'quota', label: 'Quota', enabled: false },
      { id: 2, name: 'xtables', label: 'XTables', enabled: true },
    ];
    let updateAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET vpses/123/features': () => ({ features }),
        'POST vpses/123/features/update_all': () => {
          updateAttempts += 1;
          if (updateAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: false,
                message: 'Feature configuration changed on the server. Review and retry.',
                response: null,
              }),
            };
          }

          return { _meta: { action_state_id: 43 } };
        },
      },
    });

    await page.goto('/admin/vps/123/features');
    await page.getByTestId('vps.features.item.1').click();
    await page.getByTestId('vps.features.save').click();

    const dialog = page.getByTestId('vps.features.confirm');
    await expect(dialog).toContainText('vps123.example');

    await page.getByTestId('vps.features.confirm.confirm').click();
    await expect(page.getByTestId('vps.features.confirm.error')).toContainText(
      'Feature configuration changed on the server. Review and retry.'
    );
    await expect(dialog).toContainText('vps123.example');

    await page.getByTestId('vps.features.confirm.confirm').click();
    await expect(dialog).toBeHidden();
    expect(updateAttempts).toBe(2);
  });
});

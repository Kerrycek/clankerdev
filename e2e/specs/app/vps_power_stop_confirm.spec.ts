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
  node: { id: 1, domain_name: 'node1.example', location: { label: 'dc1' } },
  user: { id: 42, login: 'user' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

test('@smoke VPS detail stop action uses confirm dialog and sends POST with force', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 42, login: 'user', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({
        ip_addresses: [
          {
            id: 1,
            addr: '198.51.100.10',
            vps: { id: 123 },
            network: { role: 'public', purpose: 'public' },
          },
        ],
      }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'POST vpses/123/stop': () => ({ _meta: { action_state_id: 777 } }),
      'GET action_states/777': () => ({
        action_state: {
          id: 777,
          label: 'Stop',
          status: true,
          finished: true,
          current: 1,
          total: 1,
          created_at: '2026-02-04T00:00:00Z',
          updated_at: '2026-02-04T00:00:01Z',
        },
      }),
    },
  });

  await page.goto('/app/vps/123');

  await expect(page.getByTestId('vps.header')).toBeVisible();

  const stopBtn = page.getByTestId('vps.action.stop');
  await expect(stopBtn).toBeVisible();
  await expect(stopBtn).toHaveAttribute('aria-disabled', 'false');

  await stopBtn.click();

  await expect(page.getByTestId('vps.action.stop_confirm')).toBeVisible();

  // Enable the force option to validate request body structure.
  await page.getByTestId('vps.action.stop_confirm.force').click();

  const reqPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/stop')
  );

  await page.getByTestId('vps.action.stop_confirm.confirm').click();

  const req = await reqPromise;
  expect(req.postDataJSON()).toEqual({ vps: { force: true } });

  await expect(page.getByTestId('vps.action.stop_confirm')).toBeHidden();
});

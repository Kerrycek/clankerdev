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

test('@smoke Modal traps focus and restores focus on close', async ({ page }) => {
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
    },
  });

  await page.goto('/app/vps/123');

  const stopBtn = page.getByTestId('vps.action.stop');
  await expect(stopBtn).toBeVisible();

  await stopBtn.focus();
  await expect(stopBtn).toBeFocused();

  await stopBtn.click();

  await expect(page.getByTestId('vps.action.stop_confirm')).toBeVisible();

  // The force checkbox is the first focusable control.
  const force = page.getByTestId('vps.action.stop_confirm.force');
  await expect(force).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('vps.action.stop_confirm.cancel')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('vps.action.stop_confirm.confirm')).toBeFocused();

  // Wrap around back to the first element.
  await page.keyboard.press('Tab');
  await expect(force).toBeFocused();

  // Reverse wrap as well.
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('vps.action.stop_confirm.confirm')).toBeFocused();

  // Closing via Escape must restore focus back to the opener.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('vps.action.stop_confirm')).toBeHidden();
  await expect(stopBtn).toBeFocused();
});

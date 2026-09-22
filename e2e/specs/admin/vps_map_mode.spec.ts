import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  manage_hostname: true,
  cpu: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  cgroup_version: 'cgroup_any',
  map_mode: 'native',
  allow_admin_modifications: true,
  node: { id: 1, domain_name: 'node1.example', location: { id: 2, label: 'Praha' } },
  user: { id: 42, login: 'owner' },
};

test('@pr-smoke @pr-smoke-mobile admin reviews and submits a restart-dependent VPS map-mode change', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
      'GET user_namespace_maps': () => ({ user_namespace_maps: [] }),
      'PUT vpses/123': () => ({ vps: { ...vps, map_mode: 'zfs' }, _meta: { action_state_id: 921 } }),
      'GET action_states/921': () => ({
        action_state: { id: 921, label: 'Set mapping mode', status: true, finished: false, current: 0, total: 1 },
      }),
    },
  });

  await page.goto('/admin/vps/123/config');
  const mapMode = page.getByTestId('vps.config.map_mode');
  await expect(mapMode).toBeVisible();
  await mapMode.selectOption('zfs');

  const review = page.getByTestId('vps.config.diff.map_mode');
  await expect(review).toContainText('Native idmapped mounts');
  await expect(review).toContainText('Legacy ZFS mapping');
  await expect(review).toContainText('Requires restart');
  await expect(review).toContainText('Admin only');

  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/api/v7.0/vpses/123')
  );
  await page.getByTestId('vps.config.header.save').click();
  await expect(page.getByText('Review and apply VPS configuration changes?')).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  expect((await requestPromise).postDataJSON()).toEqual({ vps: { map_mode: 'zfs' } });

  await page.goto('/app/vps/123/config');
  await expect(page.getByTestId('vps.config.map_mode')).toHaveCount(0);
});

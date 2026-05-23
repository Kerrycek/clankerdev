import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke admin cluster dns tools pages render', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_servers': () => ({ dns_servers: [{ id: 1, name: 'ns1', node: { id: 11, domain_name: 'node1.example.test' }, ipv4_addr: '192.0.2.1', enable_user_dns_zones: true }] }),
      'GET nodes': () => ({ nodes: [{ id: 11, domain_name: 'node1.example.test' }] }),
      'GET dns_tsig_keys': () => ({ dns_tsig_keys: [{ id: 7, name: 'transfer-key', algorithm: 'hmac-sha256', secret: 'secret', user: { id: 10, login: 'alice' } }] }),
    },
  });

  await page.goto('/admin/cluster/dns-servers');
  await expect(page.getByTestId('admin.cluster.dns_servers.page')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_servers.row.1')).toBeVisible();

  await page.goto('/admin/cluster/dns-tsig-keys');
  await expect(page.getByTestId('admin.cluster.dns_tsig.page')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_tsig.row.7')).toBeVisible();
});

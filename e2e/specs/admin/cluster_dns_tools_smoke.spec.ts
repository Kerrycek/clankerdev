import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke @pr-smoke admin cluster dns tools pages render', async ({ page }) => {
  let listParams: URLSearchParams | null = null;
  let dnsServerListParams: URLSearchParams | null = null;
  let createdKey: any;
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_servers': ({ searchParams }) => {
        dnsServerListParams = new URLSearchParams(searchParams);
        return { dns_servers: [{ id: 1, name: 'ns1', node: { id: 11, domain_name: 'node1.example.test' }, ipv4_addr: '192.0.2.1', enable_user_dns_zones: true }], _meta: { total_count: 1 } };
      },
      'GET nodes': () => ({ nodes: [{ id: 11, domain_name: 'node1.example.test' }] }),
      'GET dns_tsig_keys': ({ searchParams }) => {
        listParams = new URLSearchParams(searchParams);
        return { dns_tsig_keys: [{ id: 7, name: 'transfer-key', algorithm: 'hmac-sha256', secret: 'admin-list-secret-must-not-render', user: { id: 10, login: 'alice' } }], _meta: { total_count: 1 } };
      },
      'POST dns_tsig_keys': async ({ request }) => {
        createdKey = await request.postDataJSON();
        return { dns_tsig_key: { id: 8, name: 'new-key', algorithm: 'hmac-sha256', secret: 'one-time-secret', user: { id: 10, login: 'alice' } } };
      },
    },
  });

  await page.goto('/admin/cluster/dns-servers');
  await expect(page.getByTestId('admin.cluster.dns_servers.page')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_servers.row.1')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_servers.pagination.desktop.page.1')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_servers.row.1.edit')).toHaveAttribute('aria-label', 'Edit');
  await expect(page.getByTestId('admin.cluster.dns_servers.row.1.delete')).toHaveAttribute('aria-label', 'Delete');

  await page.getByTestId('admin.cluster.dns_servers.search.input').fill('ns1');
  await expect(page.getByTestId('admin.cluster.dns_servers.row.1')).toBeVisible();
  await expect.poll(() => dnsServerListParams?.get('dns_server[q]')).toBeNull();
  await expect.poll(() => dnsServerListParams?.get('_meta[count]')).toBeNull();

  await page.goto('/admin/cluster/dns-tsig-keys');
  await expect(page.getByTestId('admin.cluster.dns_tsig.page')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_tsig.row.7')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_tsig.pagination.page.1')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_tsig.row.7.delete')).toHaveAttribute('aria-label', 'Delete');
  await expect(page.getByText('admin-list-secret-must-not-render', { exact: true })).toHaveCount(0);
  expect(listParams?.has('dns_tsig_key[q]')).toBe(false);

  await page.getByTestId('admin.cluster.dns_tsig.create.open').click();
  const modal = page.getByTestId('admin.cluster.dns_tsig.create.modal');
  await expect(modal.getByLabel('Name')).toBeVisible();
  await expect(modal.getByLabel('User')).toBeVisible();
  await expect(modal.getByLabel('Algorithm')).toBeVisible();
  await modal.getByLabel('Name').fill('new-key');
  await expect(page.getByTestId('admin.cluster.dns_tsig.create.submit')).toBeDisabled();
  await modal.getByLabel('User').fill('10');
  await expect(page.getByTestId('admin.cluster.dns_tsig.create.submit')).toBeEnabled();
  await page.getByTestId('admin.cluster.dns_tsig.create.submit').click();
  await expect.poll(() => createdKey?.dns_tsig_key?.user).toBe(10);
});

test('@pr-smoke-mobile @smoke-mobile admin DNS server actions stay reachable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_servers': () => ({
        dns_servers: [{
          id: 1,
          name: 'ns1-with-a-long-name.example.test',
          node: { id: 11, domain_name: 'node1-with-a-long-name.example.test' },
          ipv4_addr: '192.0.2.1',
          ipv6_addr: '2001:db8:1234:5678:90ab:cdef:1234:5678',
          enable_user_dns_zones: true,
        }],
        _meta: { total_count: 1 },
      }),
      'GET nodes': () => ({ nodes: [{ id: 11, domain_name: 'node1-with-a-long-name.example.test' }] }),
    },
  });

  await page.goto('/admin/cluster/dns-servers');

  const card = page.getByTestId('admin.cluster.dns_servers.card.1');
  const edit = page.getByTestId('admin.cluster.dns_servers.card.1.edit');
  const remove = page.getByTestId('admin.cluster.dns_servers.card.1.delete');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_servers.table')).toBeHidden();
  await expect(page.getByTestId('admin.cluster.dns_servers.pagination.mobile.page.1')).toBeVisible();

  const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(documentOverflows).toBe(false);
  await expect.poll(() => card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  const viewportWidth = page.viewportSize()?.width ?? 0;
  for (const action of [edit, remove]) {
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await edit.click();
  await expect(page.getByTestId('admin.cluster.dns_servers.editor')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('admin.cluster.dns_servers.editor')).toBeHidden();

  await remove.click();
  const confirmation = page.getByTestId('admin.cluster.dns_servers.delete_confirm');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByTestId('admin.cluster.dns_servers.delete_confirm.confirm')).toBeVisible();
});

test('@pr-smoke @pr-smoke-mobile failed admin DNS deletions stay in context and can be retried', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  let serverDeleteCalls = 0;
  let tsigDeleteCalls = 0;
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_servers': () => ({
        dns_servers: [{
          id: 1,
          name: 'ns1.example.test',
          node: { id: 11, domain_name: 'node1.example.test' },
          ipv4_addr: '192.0.2.1',
          enable_user_dns_zones: true,
        }],
        _meta: { total_count: 1 },
      }),
      'GET nodes': () => ({ nodes: [{ id: 11, domain_name: 'node1.example.test' }] }),
      'DELETE dns_servers/1': () => {
        serverDeleteCalls += 1;
        if (serverDeleteCalls === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'DNS server is still in use', response: null }),
          };
        }
        return {};
      },
      'GET dns_tsig_keys': () => ({
        dns_tsig_keys: [{
          id: 7,
          name: 'transfer-key',
          algorithm: 'hmac-sha256',
          user: { id: 10, login: 'alice' },
        }],
        _meta: { total_count: 1 },
      }),
      'DELETE dns_tsig_keys/7': () => {
        tsigDeleteCalls += 1;
        if (tsigDeleteCalls === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'TSIG key is referenced by a zone', response: null }),
          };
        }
        return {};
      },
    },
  });

  await page.goto('/admin/cluster/dns-servers');
  await page.getByTestId(
    mobile ? 'admin.cluster.dns_servers.card.1.delete' : 'admin.cluster.dns_servers.row.1.delete',
  ).click();
  const serverDialog = page.getByTestId('admin.cluster.dns_servers.delete_confirm');
  await serverDialog.getByTestId('admin.cluster.dns_servers.delete_confirm.confirm').click();
  await expect(serverDialog.getByTestId('admin.cluster.dns_servers.delete_error')).toContainText('DNS server is still in use');
  await expect(serverDialog).toBeVisible();
  await serverDialog.getByTestId('admin.cluster.dns_servers.delete_confirm.confirm').click();
  await expect(serverDialog).toBeHidden();
  expect(serverDeleteCalls).toBe(2);

  await page.goto('/admin/cluster/dns-tsig-keys');
  await page.getByTestId(
    mobile ? 'admin.cluster.dns_tsig.card.7.delete' : 'admin.cluster.dns_tsig.row.7.delete',
  ).click();
  const tsigDialog = page.getByTestId('admin.cluster.dns_tsig.delete_confirm');
  await tsigDialog.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm').click();
  await expect(tsigDialog.getByTestId('admin.cluster.dns_tsig.delete_error')).toContainText('TSIG key is referenced by a zone');
  await expect(tsigDialog).toBeVisible();
  await tsigDialog.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm').click();
  await expect(tsigDialog).toBeHidden();
  expect(tsigDeleteCalls).toBe(2);
});

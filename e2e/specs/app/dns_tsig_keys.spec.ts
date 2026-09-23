import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('user TSIG management is owner-scoped and reveals a new secret only once', async ({ page }) => {
  let indexUserFilter: string | null = null;
  let createPayload: any;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_tsig_keys': ({ searchParams }) => {
        indexUserFilter = searchParams.get('dns_tsig_key[user]');
        return {
          dns_tsig_keys: [{
            id: 7,
            name: 'existing-transfer-key',
            algorithm: 'hmac-sha256',
            secret: 'existing-list-secret-must-not-render',
            user: { id: 10, login: 'alice' },
          }],
        };
      },
      'POST dns_tsig_keys': async ({ request }) => {
        createPayload = await request.postDataJSON();
        return {
          dns_tsig_key: {
            id: 8,
            name: createPayload?.dns_tsig_key?.name,
            algorithm: createPayload?.dns_tsig_key?.algorithm,
            secret: 'one-time-created-secret',
            user: { id: 10, login: 'alice' },
          },
        };
      },
    },
  });

  await page.goto('/app/dns/tsig-keys');

  await expect(page.getByTestId('dns.tsig.page')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.row.7')).toContainText('existing-transfer-key');
  await expect(page.getByText('existing-list-secret-must-not-render', { exact: true })).toHaveCount(0);
  expect(indexUserFilter).toBe('10');

  await page.getByTestId('dns.tsig.create.open').click();
  const createModal = page.getByTestId('dns.tsig.create.modal');
  await createModal.getByLabel('Name').fill('new-transfer-key');
  await createModal.getByLabel('Algorithm').selectOption('hmac-sha512');
  await page.getByTestId('dns.tsig.create.submit').click();

  await expect(page.getByTestId('dns.tsig.secret.modal')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.secret.value.field')).toHaveValue('one-time-created-secret');
  expect(createPayload?.dns_tsig_key?.name).toBe('new-transfer-key');
  expect(createPayload?.dns_tsig_key?.algorithm).toBe('hmac-sha512');
  expect(createPayload?.dns_tsig_key?.user).toBeUndefined();

  await page.getByTestId('dns.tsig.secret.close').click();
  await expect(page.getByTestId('dns.tsig.secret.modal')).toHaveCount(0);
  await expect(page.getByText('one-time-created-secret', { exact: true })).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile rejected TSIG key deletion stays in context and allows retry', async ({ page }) => {
  let deleteCalls = 0;
  const keys = [{
    id: 7,
    name: 'existing-transfer-key',
    algorithm: 'hmac-sha256',
    user: { id: 10, login: 'alice' },
  }];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_tsig_keys': () => ({ dns_tsig_keys: keys }),
      'DELETE dns_tsig_keys/7': () => {
        deleteCalls += 1;
        if (deleteCalls === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'TSIG key is still assigned' }),
          };
        }
        keys.length = 0;
        return {};
      },
    },
  });

  await page.goto('/app/dns/tsig-keys');
  await page.getByTestId('dns.tsig.row.7.delete').click();
  const dialog = page.getByTestId('dns.tsig.delete_confirm');
  await dialog.getByTestId('dns.tsig.delete_confirm.confirm').click();

  await expect(dialog.getByTestId('dns.tsig.delete_confirm.error')).toContainText('TSIG key is still assigned');
  await expect(dialog).toContainText('existing-transfer-key');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('dns.tsig.delete_confirm.confirm').click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('dns.tsig.row.7')).toHaveCount(0);
  expect(deleteCalls).toBe(2);
});

test('user TSIG management fails closed if a hidden look-ahead row has another owner', async ({ page }) => {
  const ownedKeys = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    name: `owned-key-${index + 1}`,
    algorithm: 'hmac-sha256',
    user: { id: 10, login: 'alice' },
  }));

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_tsig_keys': () => ({
        dns_tsig_keys: [
          ...ownedKeys,
          {
            id: 26,
            name: 'foreign-look-ahead-key',
            algorithm: 'hmac-sha256',
            secret: 'foreign-secret',
            user: { id: 11, login: 'mallory' },
          },
        ],
      }),
    },
  });

  await page.goto('/app/dns/tsig-keys');

  await expect(page.getByTestId('dns.tsig.error')).toBeVisible();
  await expect(page.getByTestId(/^dns\.tsig\.row\.\d+$/)).toHaveCount(0);
  await expect(page.getByText('foreign-secret', { exact: true })).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile user TSIG pagination follows the ascending API cursor and stops at the terminal page', async ({ page }) => {
  let allKeys = Array.from({ length: 50 }, (_, index) => ({
    id: index + 1,
    name: `transfer-key-${index + 1}`,
    algorithm: 'hmac-sha256',
    user: { id: 10, login: 'alice' },
  }));
  const requestedCursors: string[] = [];
  const requestedLimits: string[] = [];
  const requestedAlgorithms: Array<string | null> = [];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_tsig_keys': ({ searchParams }) => {
        expect(searchParams.get('dns_tsig_key[user]')).toBe('10');
        const fromId = Number(searchParams.get('dns_tsig_key[from_id]') ?? 0);
        requestedCursors.push(String(fromId));
        requestedLimits.push(searchParams.get('dns_tsig_key[limit]') ?? '');
        requestedAlgorithms.push(searchParams.get('dns_tsig_key[algorithm]'));
        return {
          dns_tsig_keys: allKeys.filter((key) => key.id > fromId).slice(0, 26),
        };
      },
    },
  });

  await page.goto('/app/dns/tsig-keys');

  await page.getByTestId('dns.tsig.filter.algorithm').selectOption('hmac-sha256');

  await expect(page.getByTestId('dns.tsig.row.1')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.row.25')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.row.26')).toHaveCount(0);
  await expect(page.getByTestId(/^dns\.tsig\.row\.\d+$/)).toHaveCount(25);
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeEnabled();
  await expect.poll(() => requestedLimits).toContain('26');
  await expect.poll(() => requestedAlgorithms.at(-1)).toBe('hmac-sha256');
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByTestId('dns.tsig.pagination.next').click();

  await expect(page).toHaveURL(/from_id=25/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId('dns.tsig.row.25')).toHaveCount(0);
  await expect(page.getByTestId('dns.tsig.row.26')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.row.50')).toBeVisible();
  await expect(page.getByTestId(/^dns\.tsig\.row\.\d+$/)).toHaveCount(25);
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeDisabled();
  await expect.poll(() => requestedCursors).toContain('25');
  await expect.poll(() => requestedAlgorithms.at(-1)).toBe('hmac-sha256');
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByTestId('dns.tsig.pagination.prev').click();

  await expect(page).not.toHaveURL(/from_id=/);
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByTestId('dns.tsig.row.1')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeEnabled();
  await expect.poll(() => requestedAlgorithms.at(-1)).toBe('hmac-sha256');

  // A refetch can invalidate a previously visited forward cursor while still
  // leaving another page. Rebuild that edge from the current visible maximum
  // instead of reusing the stored cursor 25.
  allKeys = allKeys.filter((key) => key.id !== 1);
  const requestsBeforeRefresh = requestedCursors.length;
  await page.getByTestId('dns.tsig.refresh').click();
  await expect.poll(() => requestedCursors.length).toBeGreaterThan(requestsBeforeRefresh);
  await expect(page.getByTestId('dns.tsig.row.1')).toHaveCount(0);
  await expect(page.getByTestId('dns.tsig.row.26')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeEnabled();
  await expect(page.getByTestId('dns.tsig.pagination.page.2')).toBeEnabled();

  await page.getByTestId('dns.tsig.pagination.page.2').click();

  await expect(page).toHaveURL(/from_id=26/);
  await expect(page.getByTestId('dns.tsig.row.26')).toHaveCount(0);
  await expect(page.getByTestId('dns.tsig.row.27')).toBeVisible();
  await expect.poll(() => requestedCursors.at(-1)).toBe('26');
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeDisabled();

  await page.getByTestId('dns.tsig.pagination.prev').click();
  await expect(page.getByTestId('dns.tsig.row.2')).toBeVisible();

  // Once the current page becomes exactly terminal, neither Next nor a stale
  // forward page button may reopen the old page.
  allKeys = allKeys.slice(0, 25);
  const requestsBeforeTerminalRefresh = requestedCursors.length;
  await page.getByTestId('dns.tsig.refresh').click();
  await expect.poll(() => requestedCursors.length).toBeGreaterThan(requestsBeforeTerminalRefresh);
  await expect(page.getByTestId('dns.tsig.pagination.next')).toBeDisabled();
  await expect(page.getByTestId('dns.tsig.pagination.page.2')).toBeDisabled();
  await expect.poll(() => requestedAlgorithms.at(-1)).toBe('hmac-sha256');
  await expectNoDocumentHorizontalOverflow(page);
});

test('@pr-smoke @pr-smoke-mobile an empty TSIG cursor page can return to the first page', async ({ page }) => {
  const keys = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    name: `transfer-key-${index + 1}`,
    algorithm: 'hmac-sha256',
    user: { id: 10, login: 'alice' },
  }));

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_tsig_keys': ({ searchParams }) => {
        const fromId = Number(searchParams.get('dns_tsig_key[from_id]') ?? 0);
        return { dns_tsig_keys: keys.filter((key) => key.id > fromId).slice(0, 26) };
      },
    },
  });

  await page.goto('/app/dns/tsig-keys?from_id=25&page=2&limit=25');

  await expect(page.getByTestId('dns.tsig.empty')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.empty.action')).toBeEnabled();
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByTestId('dns.tsig.empty.action').click();

  await expect(page).not.toHaveURL(/from_id=/);
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByTestId('dns.tsig.row.1')).toBeVisible();
  await expect(page.getByTestId('dns.tsig.row.25')).toBeVisible();
});

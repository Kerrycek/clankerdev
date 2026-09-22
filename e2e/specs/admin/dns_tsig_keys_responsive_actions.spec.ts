import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile admin TSIG key delete stays reachable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  const requestedCursors: Array<string | null> = [];
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_tsig_keys': ({ searchParams }) => {
        const fromId = searchParams.get('dns_tsig_key[from_id]');
        const limit = Number(searchParams.get('dns_tsig_key[limit]') ?? 25);
        requestedCursors.push(fromId);
        const keys = Array.from({ length: 26 }, (_, index) => {
          const id = index + 1;
          return {
            id,
            name: id === 1 ? 'long-transfer-key-name-that-must-wrap-on-a-narrow-phone' : `transfer-key-${id}`,
            algorithm: 'hmac-sha256',
            created_at: '2026-09-15T12:00:00Z',
            secret: 'listed-secrets-must-never-render',
            user: { id: 10, login: id === 1 ? 'alice-with-a-long-administrator-login' : 'alice' },
          };
        });
        const cursor = Number(fromId ?? 0);
        return {
          dns_tsig_keys: keys.filter((key) => key.id > cursor).slice(0, limit),
          _meta: { total_count: keys.length },
        };
      },
    },
  });

  await page.goto('/admin/cluster/dns-tsig-keys?limit=25');

  const entry = page.getByTestId(mobile ? 'admin.cluster.dns_tsig.card.1' : 'admin.cluster.dns_tsig.row.1');
  const deleteAction = page.getByTestId(
    mobile ? 'admin.cluster.dns_tsig.card.1.delete' : 'admin.cluster.dns_tsig.row.1.delete',
  );

  await expect(entry).toBeVisible();
  await expect(entry.getByText('long-transfer-key-name-that-must-wrap-on-a-narrow-phone', { exact: true })).toBeVisible();
  await expect(entry.getByText('alice-with-a-long-administrator-login', { exact: true })).toBeVisible();
  await expect(entry.getByText('hmac-sha256', { exact: true })).toBeVisible();
  await expect(entry).toContainText('2026');
  await expect(page.getByText('listed-secrets-must-never-render', { exact: true })).toHaveCount(0);

  if (mobile) {
    await expect(page.getByTestId('admin.cluster.dns_tsig.cards')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.dns_tsig.table')).toBeHidden();
    await expect(page.getByTestId('admin.cluster.dns_tsig.pagination.mobile.page.1')).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    const cardMetrics = await entry.evaluate((card) => ({
      clientWidth: card.clientWidth,
      scrollWidth: card.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);
    const box = await deleteAction.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);

    await deleteAction.scrollIntoViewIfNeeded();
    await expect(deleteAction).toBeInViewport();
  } else {
    await expect(page.getByTestId('admin.cluster.dns_tsig.cards')).toBeHidden();
    await expect(page.getByTestId('admin.cluster.dns_tsig.table')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.dns_tsig.pagination.page.1')).toBeVisible();
  }

  await expect(deleteAction).toHaveAccessibleName(
    mobile ? 'Delete: long-transfer-key-name-that-must-wrap-on-a-narrow-phone' : 'Delete',
  );
  await deleteAction.click();
  await expect(page.getByTestId('admin.cluster.dns_tsig.delete_confirm')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm')).toBeVisible();

  if (mobile) {
    await page.getByTestId('admin.cluster.dns_tsig.delete_confirm.cancel').click();
    await page.getByTestId('admin.cluster.dns_tsig.pagination.mobile.next').click();
    await expect(page).toHaveURL(/(?:\?|&)from_id=25(?:&|$)/);
    await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
    await expect(page.getByTestId('admin.cluster.dns_tsig.card.26')).toBeVisible();
    await expect.poll(() => requestedCursors.at(-1)).toBe('25');

    await page.getByTestId('admin.cluster.dns_tsig.pagination.mobile.prev').click();
    await expect(page).not.toHaveURL(/(?:\?|&)from_id=/);
    await expect(page.getByTestId('admin.cluster.dns_tsig.card.1')).toBeVisible();
  }
});

test('@pr-smoke @pr-smoke-mobile admin TSIG key delete keeps a rejected request in context', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  let deleteCalls = 0;
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET dns_tsig_keys': () => ({
        dns_tsig_keys: [{
          id: 1,
          name: 'active-transfer-key',
          algorithm: 'hmac-sha256',
          created_at: '2026-09-15T12:00:00Z',
          user: { id: 10, login: 'alice' },
        }],
        _meta: { total_count: 1 },
      }),
      'DELETE dns_tsig_keys/1': () => {
        deleteCalls += 1;
        return {
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            status: false,
            message: 'TSIG key is still assigned to a DNS server',
            response: null,
          }),
        };
      },
    },
  });

  await page.goto('/admin/cluster/dns-tsig-keys');
  await page.getByTestId(
    mobile ? 'admin.cluster.dns_tsig.card.1.delete' : 'admin.cluster.dns_tsig.row.1.delete',
  ).click();
  await page.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm').click();

  await expect.poll(() => deleteCalls).toBe(1);
  const dialog = page.getByTestId('admin.cluster.dns_tsig.delete_confirm');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('TSIG key is still assigned to a DNS server');
  await expect(page.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm')).toBeEnabled();

  await page.getByTestId('admin.cluster.dns_tsig.delete_confirm.cancel').click();
  await page.getByTestId(
    mobile ? 'admin.cluster.dns_tsig.card.1.delete' : 'admin.cluster.dns_tsig.row.1.delete',
  ).click();
  await expect(page.getByTestId('admin.cluster.dns_tsig.delete_confirm')).not.toContainText(
    'TSIG key is still assigned to a DNS server',
  );
});

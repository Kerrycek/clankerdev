import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile admin payment history is filterable, linked, and responsive', async ({ page }, testInfo) => {
  const requests: URL[] = [];
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100, time_zone: 'Europe/Prague' },
    handlers: {
      'GET user_payments': ({ url }) => {
        requests.push(new URL(url.href));
        return {
          user_payments: [{
            id: 9001,
            user: { id: 42, login: 'member42' },
            accounted_by: { id: 1, login: 'admin' },
            incoming_payment: { id: 300 },
            amount: 900,
            from_date: '2026-09-01T00:00:00Z',
            to_date: '2026-12-01T00:00:00Z',
            created_at: '2026-09-20T01:02:03Z',
          }],
        };
      },
    },
  });

  await page.goto('/admin/payments/history?limit=25');

  await expect(page.getByTestId('admin.finance.tabs.history')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('admin.finance.tabs').getByRole('link')).toHaveCount(4);

  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.getByTestId('admin.finance.history.row.9001.mobile')).toBeVisible();
    await expect(page.getByTestId('admin.finance.history.table')).toBeHidden();
  } else {
    await expect(page.getByTestId('admin.finance.history.table')).toBeVisible();
    await expect(page.getByTestId('admin.finance.history.row.9001')).toBeVisible();
  }

  await expect(page.getByRole('link', { name: /member42/i }).first()).toHaveAttribute('href', '/admin/users/42');
  await expect(page.getByRole('link', { name: '#300' }).first()).toHaveAttribute('href', '/admin/payments/incoming/300');
  await expect(page.getByTestId('admin.finance.history.filter.time_zone')).toContainText('Europe/Prague');
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByTestId('admin.finance.history.filter.user').fill('#42');
  await page.getByTestId('admin.finance.history.filter.accounted_by').fill('1');
  await page.getByTestId('admin.finance.history.filter.created_from').fill('2026-09-01');
  await page.getByTestId('admin.finance.history.filter.created_to').fill('2026-09-30');
  await page.getByTestId('admin.finance.history.filter.apply').click();

  await expect(page).toHaveURL(/user=42/);
  await expect(page).toHaveURL(/accounted_by=1/);
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);

  const filtered = requests.at(-1)!;
  expect(filtered.searchParams.get('user_payment[user]')).toBe('42');
  expect(filtered.searchParams.get('user_payment[accounted_by]')).toBe('1');
  expect(filtered.searchParams.get('user_payment[created_from]')).toBe('2026-08-31T22:00:00.000Z');
  expect(filtered.searchParams.get('user_payment[created_to]')).toBe('2026-09-30T21:59:59.999Z');
  expect(filtered.searchParams.get('_meta[includes]')).toBe('user,accounted_by');

  const screenshot = process.env.E2E_ADMIN_PAYMENT_HISTORY_SCREENSHOT?.trim();
  if (screenshot) {
    const suffix = testInfo.project.name === 'mobile-chrome' ? '-mobile' : '-desktop';
    await page.screenshot({ path: screenshot.replace(/\.png$/i, `${suffix}.png`), fullPage: true });
  }
});

test('non-admin sessions cannot mount global payment history', async ({ page }) => {
  const paymentRequests: URL[] = [];
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 2, login: 'member', level: 50 },
    handlers: {
      'GET users/2/get_payment_instructions': () => ({ hash: { instructions: '' } }),
      'GET user_payments': ({ url }) => {
        paymentRequests.push(new URL(url.href));
        return { user_payments: [] };
      },
    },
  });

  await page.goto('/admin/payments/history');

  await expect(page).toHaveURL((url) => url.pathname === '/app/payments' && url.hash === '');
  await expect(page.getByTestId('admin.finance.history')).toHaveCount(0);
  await expect(page.getByTestId('payments.my.stat.payment_id')).toContainText('2');
  await page.waitForLoadState('networkidle');
  expect(paymentRequests.length).toBeGreaterThan(0);
  expect(paymentRequests.every((request) => request.searchParams.get('user_payment[user]') === '2')).toBe(true);
});

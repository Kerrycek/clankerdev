import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile support cannot mount administrator-only user Finance', async ({ page }) => {
  const financeRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/api\/v7\.0\/(?:user_payments|user_accounts)(?:\/|$)/.test(url.pathname)) {
      financeRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 21, login: 'support-agent', level: 21 },
    handlers: {
      'GET users/42': () => ({
        user: {
          id: 42,
          login: 'member',
          level: 1,
          object_state: 'active',
          monthly_payment: 300,
          paid_until: '2026-10-01T00:00:00Z',
        },
      }),
    },
  });

  await page.goto('/admin/users/42');

  await expect(page.getByTestId('admin.user.header')).toBeVisible();
  await expect(page.getByTestId('admin.user.payments.overview.card')).toHaveCount(0);
  await expect(page.locator('a[href="/admin/users/42/payments"]')).toHaveCount(0);

  await page.goto('/admin/users/42/payments');

  await expect(page).toHaveURL((url) => url.pathname === '/admin/users/42' && url.hash === '');
  await expect(page.getByTestId('admin.user.header')).toBeVisible();
  await expect(page.getByTestId('admin.user.payments.quick.card')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(financeRequests).toEqual([]);
});

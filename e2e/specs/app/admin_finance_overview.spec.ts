import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

test('@pr-smoke @pr-smoke-mobile admin Finance overview uses a complete account snapshot', async ({ page }, testInfo) => {
  const systemConfigRequests: URL[] = [];
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST',
    webuiNext: { serverTimeZone: 'Europe/Prague' },
  });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100, time_zone: 'Europe/Prague' },
    handlers: {
      'GET users': ({ searchParams }) => {
        const fromId = Number(searchParams.get('user[from_id]') ?? 0);
        const objectState = searchParams.get('user[object_state]') ?? 'active';
        const rows = [
          { id: 10, login: 'paid', level: 1, object_state: 'active', monthly_payment: 300, paid_until: isoDaysFromNow(20) },
          { id: 11, login: 'soon', level: 1, object_state: 'active', monthly_payment: 400, paid_until: isoDaysFromNow(2) },
          { id: 12, login: 'late', level: 1, object_state: 'suspended', monthly_payment: 500, paid_until: '2026-09-19T22:30:00Z' },
          { id: 13, login: 'missing', level: 1, object_state: 'active', monthly_payment: 600, paid_until: null },
          { id: 14, login: 'broken', level: 1, object_state: 'active', monthly_payment: 700, paid_until: 'broken-date' },
          { id: 15, login: 'deleted', level: 1, object_state: 'deleted', monthly_payment: 800, paid_until: null },
          { id: 16, login: 'free', level: 1, object_state: 'active', monthly_payment: 0, paid_until: null },
        ].filter((user) => user.id > fromId && user.object_state === objectState);
        return { users: rows };
      },
      'GET system_configs': ({ url }) => {
        systemConfigRequests.push(new URL(url.href));
        return {
          system_configs: [{ category: 'plugin_payments', name: 'default_currency', value: 'CZK' }],
        };
      },
    },
  });

  await page.goto('/admin/payments');

  await expect(page.getByTestId('nav.sidebar.finance')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('admin.finance.tabs').getByRole('link')).toHaveCount(4);
  await expect(page.getByTestId('admin.finance.overview.summary.monthly_payment')).toContainText(/2[\s,.]?500/);
  await expect(page.getByTestId('admin.finance.overview.summary.monthly_payment')).toContainText('CZK');
  await expect.poll(() => systemConfigRequests.length).toBe(1);
  expect(systemConfigRequests[0]?.searchParams.get('system_config[category]')).toBe('plugin_payments');
  await expect(page.getByTestId('admin.finance.overview.summary.current_month')).toContainText('Europe/Prague');
  await expect(page.getByTestId('admin.finance.overview.summary.paid')).toContainText('1');
  await expect(page.getByTestId('admin.finance.overview.summary.due_soon')).toContainText('1');
  await expect(page.getByTestId('admin.finance.overview.summary.overdue')).toContainText('2');
  await expect(page.getByTestId('admin.finance.overview.summary.invalid')).toContainText('1');
  await expect(page.getByTestId('admin.finance.overview.scope')).toContainText(/5/);

  const expectedPaidUntil = await page.evaluate(() => new Date('2026-09-19T22:30:00Z').toLocaleDateString(undefined, {
    timeZone: 'Europe/Prague',
  }));
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.getByTestId('admin.finance.overview.risk.mobile')).toBeVisible();
    await expect(page.getByTestId('admin.finance.overview.risk.row.12.mobile')).toBeVisible();
    await expect(page.getByTestId('admin.finance.overview.risk.row.12.mobile')).toContainText(expectedPaidUntil);
  } else {
    await expect(page.getByTestId('admin.finance.overview.risk.table')).toBeVisible();
    await expect(page.getByTestId('admin.finance.overview.risk.row.12')).toBeVisible();
    await expect(page.getByTestId('admin.finance.overview.risk.row.12')).toContainText(expectedPaidUntil);
  }

  await expect(page.getByTestId('admin.finance.overview.distribution')).toBeVisible();
  await expect(page.getByTestId('admin.finance.overview.risk.filter.overdue')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('admin.finance.overview.risk.filter.invalid').click();
  await expect(page.getByTestId('admin.finance.overview.risk.filter.invalid')).toHaveAttribute('aria-pressed', 'true');
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.getByTestId('admin.finance.overview.risk.row.14.mobile')).toBeVisible();
  } else {
    await expect(page.getByTestId('admin.finance.overview.risk.row.14')).toBeVisible();
  }
  await expect(page.getByText('deleted', { exact: true })).toHaveCount(0);

  const overflow = await page.getByTestId('admin.finance.overview.distribution').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  const screenshot = process.env.E2E_ADMIN_FINANCE_OVERVIEW_SCREENSHOT?.trim();
  if (screenshot) {
    const suffix = testInfo.project.name === 'mobile-chrome' ? '-mobile' : '-desktop';
    await page.screenshot({ path: screenshot.replace(/\.png$/i, `${suffix}.png`), fullPage: true });
  }
});

test('@pr-smoke @pr-smoke-mobile admin Finance overview keeps a complete snapshot after refresh failure', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST',
    webuiNext: { serverTimeZone: 'Europe/Prague' },
  });
  let userRequests = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100, time_zone: 'Europe/Prague' },
    handlers: {
      'GET users': ({ searchParams }) => {
        userRequests += 1;
        if (userRequests > 2) {
          return {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'temporary snapshot failure', response: null }),
          };
        }

        const objectState = searchParams.get('user[object_state]') ?? 'active';
        return {
          users: objectState === 'active'
            ? [{ id: 20, login: 'member20', level: 1, object_state: 'active', monthly_payment: 300, paid_until: null }]
            : [],
        };
      },
      'GET system_configs': () => ({
        system_configs: [{ category: 'plugin_payments', name: 'default_currency', value: 'CZK' }],
      }),
    },
  });

  await page.goto('/admin/payments');

  await expect(page.getByTestId('admin.finance.overview.summary.monthly_payment')).toContainText(/300/);
  await expect(page.getByTestId('admin.finance.overview.stale')).toHaveCount(0);

  await page.getByTestId('admin.finance.overview.refresh').click();

  await expect.poll(() => userRequests).toBeGreaterThan(2);
  await expect(page.getByTestId('admin.finance.overview.stale')).toContainText(/last complete Finance snapshot/i);
  await expect(page.getByTestId('admin.finance.overview.summary.monthly_payment')).toContainText(/300/);
  await expect(page.getByTestId('admin.finance.overview.error')).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile non-admin sessions cannot mount global Finance routes', async ({ page }) => {
  const globalFinanceRequests: string[] = [];
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 2, login: 'member', level: 50 },
    handlers: {
      'GET users': ({ relPath }) => {
        globalFinanceRequests.push(relPath ?? 'users');
        return { status: false, message: 'admin-only endpoint', response: null };
      },
      'GET incoming_payments': ({ relPath }) => {
        globalFinanceRequests.push(relPath ?? 'incoming_payments');
        return { status: false, message: 'admin-only endpoint', response: null };
      },
      'GET payment_stat/estimate_income': ({ relPath }) => {
        globalFinanceRequests.push(relPath ?? 'payment_stat/estimate_income');
        return { status: false, message: 'admin-only endpoint', response: null };
      },
      'GET system_configs': ({ relPath }) => {
        globalFinanceRequests.push(relPath ?? 'system_configs');
        return { status: false, message: 'admin-only endpoint', response: null };
      },
      'GET users/2/get_payment_instructions': () => ({ hash: { instructions: '' } }),
      'GET user_payments': () => ({ user_payments: [] }),
    },
  });

  for (const path of [
    '/admin/payments',
    '/admin/payments/incoming',
    '/admin/payments/incoming/300',
    '/admin/payments/forecast',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL((url) => url.pathname === '/app/payments' && url.hash === '');
    await expect(page.getByTestId('payments.my.stat.payment_id')).toContainText('2');
    await expect(page.getByTestId('admin.finance.tabs')).toHaveCount(0);
    await expect(page.getByTestId('nav.sidebar.finance')).toHaveCount(0);
  }

  await page.waitForLoadState('networkidle');
  expect(globalFinanceRequests).toEqual([]);
});

test('@pr-smoke @pr-smoke-mobile admin Finance explains an empty assessment distribution', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users': ({ searchParams }) => {
        const objectState = searchParams.get('user[object_state]') ?? 'active';
        const rows = [
          { id: 20, login: 'free', level: 1, object_state: 'active', monthly_payment: 0, paid_until: null },
          { id: 21, login: 'deleted', level: 1, object_state: 'deleted', monthly_payment: 500, paid_until: null },
        ].filter((user) => user.object_state === objectState);
        return { users: rows };
      },
      'GET system_configs': () => ({
        system_configs: [{ category: 'plugin_payments', name: 'default_currency', value: 'CZK' }],
      }),
    },
  });

  await page.goto('/admin/payments');

  await expect(page.getByText(/no accounts in the “overdue” category/i)).toBeVisible();
  await expect(page.getByTestId('admin.finance.overview.distribution.empty')).toBeVisible();
  await expect(page.getByTestId('admin.finance.overview.distribution')).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile admin Finance reuses a complete large snapshot during member review', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST',
    webuiNext: { serverTimeZone: 'Europe/Prague' },
  });

  const activeUsers = Array.from({ length: 1_600 }, (_, index) => ({
    id: 1_000 + index,
    login: `active-${index}`,
    level: 1,
    object_state: 'active',
    monthly_payment: 300 + (index % 6) * 150,
    paid_until: isoDaysFromNow(index % 3 === 0 ? -2 : 20),
  }));
  const suspendedUsers = Array.from({ length: 50 }, (_, index) => ({
    id: 3_000 + index,
    login: `suspended-${index}`,
    level: 1,
    object_state: 'suspended',
    monthly_payment: 300,
    paid_until: isoDaysFromNow(-10),
  }));
  let userRequests = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100, time_zone: 'Europe/Prague' },
    handlers: {
      'GET users': async ({ searchParams }) => {
        userRequests += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        const fromId = Number(searchParams.get('user[from_id]') ?? 0);
        const limit = Number(searchParams.get('user[limit]') ?? 1_000);
        const objectState = searchParams.get('user[object_state]') ?? 'active';
        const source = objectState === 'suspended' ? suspendedUsers : activeUsers;
        return { users: source.filter((user) => user.id > fromId).slice(0, limit) };
      },
      'GET system_configs': () => ({
        system_configs: [{ category: 'plugin_payments', name: 'default_currency', value: 'CZK' }],
      }),
    },
  });

  await page.goto('/admin/payments');
  await expect(page.getByTestId('admin.finance.overview.scope')).toContainText(/1[,.\s]?650/);
  expect(userRequests).toBe(3);

  await page.getByTestId('nav.sidebar.nodes').evaluate((element: HTMLElement) => element.click());
  await expect(page).toHaveURL(/\/admin\/nodes$/);
  await page.getByTestId('nav.sidebar.finance').evaluate((element: HTMLElement) => element.click());
  await expect(page).toHaveURL(/\/admin\/payments\/incoming$/);
  await expect(page.getByTestId('admin.finance.tabs').getByRole('link').first()).toHaveAttribute(
    'href',
    '/admin/payments/incoming',
  );
  await page.getByTestId('admin.finance.tabs.overview').click();
  await expect(page).toHaveURL(/\/admin\/payments$/);

  await expect(page.getByTestId('admin.finance.overview.loading')).toHaveCount(0);
  await expect(page.getByTestId('admin.finance.overview.scope')).toContainText(/1[,.\s]?650/);
  expect(userRequests).toBe(3);
});

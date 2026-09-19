import { expect, test, type Page } from '@playwright/test';

import {
  bootstrapVpsAdminWindow,
  installHaveApiMock,
  setUiSettingsLocalStorage,
} from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

type PaymentPeriodScenario = {
  language: 'en' | 'cs';
  fromDate: string;
  toDate: string;
  createdAt: string;
  expectedPeriod: string;
  expectedCreatedTime: string;
  viewport: { width: number; height: number };
};

async function assertDateOnlyPaymentPeriods(page: Page, scenario: PaymentPeriodScenario) {
  expect(page.viewportSize()).toEqual(scenario.viewport);

  await bootstrapVpsAdminWindow(page, {
    webuiNext: { uiSettings: { persistence: 'local' } },
  });
  await setUiSettingsLocalStorage(page, { language: scenario.language });

  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
    mutations.push(`${request.method()} ${url.origin}${url.pathname}`);
  });

  await installHaveApiMock(page, {
    user: {
      id: 1,
      login: 'admin',
      level: 100,
      monthly_payment: 300,
      paid_until: '2099-01-01T00:00:00Z',
    },
    handlers: {
      'GET users/1/get_payment_instructions': () => ({ instructions: 'Payment instructions' }),
      'GET users/42': () => ({
        user: {
          id: 42,
          login: 'alice',
          level: 1,
          object_state: 'active',
          monthly_payment: 300,
          paid_until: '2099-01-01T00:00:00Z',
          created_at: '2026-01-15T10:00:00Z',
          last_activity_at: '2026-01-16T10:00:00Z',
        },
      }),
      'GET user_payments': () => ({
        user_payments: [
          {
            id: 9001,
            amount: 300,
            created_at: scenario.createdAt,
            from_date: scenario.fromDate,
            to_date: scenario.toDate,
          },
        ],
      }),
    },
  });

  await page.goto('/app/payments');

  const userRow = page.getByTestId('payments.my.history.table').locator('tbody tr').first();
  const userCreatedAt = userRow.locator('td').nth(0);
  const userPeriod = userRow.locator('td').nth(2);
  await expect(userPeriod).toHaveText(scenario.expectedPeriod);
  expect(await userPeriod.innerText()).not.toMatch(/\d{1,2}:\d{2}|\b(?:AM|PM)\b/i);
  await expect(userCreatedAt).toContainText(scenario.expectedCreatedTime);
  if (scenario.viewport.width <= 390) await expectNoDocumentHorizontalOverflow(page);

  await page.goto('/admin/users/42');

  const overview = page.getByTestId('admin.user.payments.overview.card');
  const adminPayment = overview.locator('.divide-y > div').first();
  const adminPeriod = adminPayment.locator('.truncate');
  const adminCreatedAt = adminPayment.locator('.text-faint');
  await expect(adminPeriod).toHaveText(scenario.expectedPeriod);
  expect(await adminPeriod.innerText()).not.toMatch(/\d{1,2}:\d{2}|\b(?:AM|PM)\b/i);
  await expect(adminCreatedAt).toContainText(scenario.expectedCreatedTime);
  if (scenario.viewport.width <= 390) await expectNoDocumentHorizontalOverflow(page);

  expect(mutations).toEqual([]);
}

test.describe('payment period date-only parity in Prague', () => {
  test.describe('English desktop', () => {
    test.use({ locale: 'en-US', timezoneId: 'Europe/Prague', viewport: { width: 1440, height: 1000 } });

    test('@pr-smoke renders local dates without the summer UTC offset on user and admin surfaces', async ({ page }) => {
      await assertDateOnlyPaymentPeriods(page, {
        language: 'en',
        fromDate: '2026-06-01T00:00:00Z',
        toDate: '2026-07-01T00:00:00Z',
        createdAt: '2026-06-15T10:30:00Z',
        expectedPeriod: '6/1/2026 → 7/1/2026',
        expectedCreatedTime: '12:30',
        viewport: { width: 1440, height: 1000 },
      });
    });
  });

  test.describe('Czech mobile', () => {
    test.use({ locale: 'cs-CZ', timezoneId: 'Europe/Prague', viewport: { width: 390, height: 844 } });

    test('@pr-smoke-mobile renders Czech local dates without the summer UTC offset on user and admin surfaces', async ({ page }) => {
      await assertDateOnlyPaymentPeriods(page, {
        language: 'cs',
        fromDate: '2026-06-01T00:00:00Z',
        toDate: '2026-07-01T00:00:00Z',
        createdAt: '2026-06-15T10:30:00Z',
        expectedPeriod: '1. 6. 2026 → 1. 7. 2026',
        expectedCreatedTime: '12:30',
        viewport: { width: 390, height: 844 },
      });
    });
  });
});

test.describe('payment period local calendar boundary', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/Los_Angeles', viewport: { width: 1440, height: 1000 } });

  test('@pr-smoke converts the instant before choosing its date instead of slicing the UTC value', async ({ page }) => {
    await assertDateOnlyPaymentPeriods(page, {
      language: 'en',
      fromDate: '2026-02-01T00:00:00Z',
      toDate: '2026-03-01T00:00:00Z',
      createdAt: '2026-02-14T17:30:00Z',
      expectedPeriod: '1/31/2026 → 2/28/2026',
      expectedCreatedTime: '9:30',
      viewport: { width: 1440, height: 1000 },
    });
  });
});

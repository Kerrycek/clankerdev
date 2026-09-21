import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test.describe('@smoke Admin user payments', () => {
  test('@pr-smoke @pr-smoke-mobile admin user payments: shows stats, instructions and history', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    let paymentInstructionRequests = 0;
    const settingsUpdates: unknown[] = [];
    let releaseSettingsUpdate: (() => void) | undefined;
    const settingsUpdateGate = new Promise<void>((resolve) => {
      releaseSettingsUpdate = resolve;
    });
    let manualPaymentRequests = 0;
    let releaseManualPayment: (() => void) | undefined;
    const manualPaymentGate = new Promise<void>((resolve) => {
      releaseManualPayment = resolve;
    });
  
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100, time_zone: 'America/Los_Angeles' },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            full_name: 'Alice Example',
            email: 'alice@example.test',
            created_at: '2026-02-01T00:00:00.000Z',
            last_activity_at: '2026-02-02T00:00:00.000Z',
            address: 'Example street\nExample city',
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/42': () => ({
          user_account: {
            id: 42,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'PUT user_accounts/42': async ({ reqJson }) => {
          settingsUpdates.push(reqJson);
          await settingsUpdateGate;
          return {
            user_account: {
              id: 42,
              monthly_payment: 120,
              paid_until: '2026-04-01T00:00:00.000Z',
            },
          };
        },
        'GET users/42/get_payment_instructions': () => {
          paymentInstructionRequests += 1;
          return {
            instructions: '<h3>Payment in EUR</h3><table><tr><td>Account:</td><td>123456/0100</td></tr><tr><td>VS:</td><td>42</td></tr></table>',
          };
        },
        'GET user_payments': () => ({
          user_payments: [
            {
              id: 9001,
              amount: 100,
              created_at: '2026-02-10T00:30:00.000Z',
              from_date: '2026-02-01T00:00:00.000Z',
              to_date: '2026-03-01T00:00:00.000Z',
              accounted_by: { id: 1, login: 'admin' },
              incoming_payment: { id: 300 },
            },
          ],
        }),
        'POST user_payments': async () => {
          manualPaymentRequests += 1;
          await manualPaymentGate;
          return {
            user_payment: {
              id: 9002,
              amount: 1800,
              created_at: '2026-02-11T12:00:00.000Z',
              from_date: '2026-03-01T00:00:00.000Z',
              to_date: '2027-09-01T00:00:00.000Z',
              accounted_by: { id: 1, login: 'admin' },
            },
            _meta: { action_state_id: 123 },
          };
        },
      },
    });
  
    await page.goto('/admin/users/42/payments');
  
    await expect(page.getByTestId('admin.user.payments.quick.card')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.paid_until')).toHaveValue('2026-03-01');
    await expect(page.getByTestId('admin.user.payments.settings.monthly_payment')).toHaveValue('100');

    await expect(page.getByTestId('admin.user.payments.instructions.card')).toBeVisible();
    expect(paymentInstructionRequests).toBe(0);
    await page.getByTestId('admin.user.payments.instructions.toggle').click();
    await expect(page.getByTestId('admin.user.payments.instructions.text')).toContainText('123456/0100');
    await expect(page.getByTestId('admin.user.payments.instructions.copy')).toBeVisible();
    expect(paymentInstructionRequests).toBe(1);
    await expectNoDocumentHorizontalOverflow(page);

    await expect(page.getByTestId('admin.user.payments.history.table')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9001')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9001.accepted_at')).toContainText('2/9/2026');
    await expect(page.getByTestId('admin.user.payments.history.row.9001.accepted_at')).toContainText('4:30');
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveText('#300');
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveAttribute('href', '/admin/payments/incoming/300');

    await page.getByTestId('admin.user.payments.settings.paid_until').fill('2026-02-01');
    await page.getByTestId('admin.user.payments.settings.paid_until.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.backward')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.review.target')).toContainText('alice (#42)');
    expect(settingsUpdates).toHaveLength(0);
    await page.getByTestId('admin.user.payments.settings.review.cancel').click();

    await page.getByTestId('admin.user.payments.settings.paid_until').fill('');
    await page.getByTestId('admin.user.payments.settings.paid_until.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.clear')).toBeVisible();
    expect(settingsUpdates).toHaveLength(0);
    await page.getByTestId('admin.user.payments.settings.review.cancel').click();

    await page.getByTestId('admin.user.payments.settings.paid_until').fill('2026-04-01');
    await page.getByTestId('admin.user.payments.settings.paid_until.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.change')).toContainText('2026-03-01 → 2026-04-01');
    await expect(page.getByTestId('admin.user.payments.settings.review')).toContainText(/expiration|expiraci/i);
    expect(settingsUpdates).toHaveLength(0);
    await page.getByTestId('admin.user.payments.settings.review.confirm').click();
    await expect.poll(() => settingsUpdates.length).toBe(1);
    await expect(page.getByTestId('admin.user.payments.settings.review.confirm')).toBeDisabled();
    await page.getByTestId('admin.user.payments.settings.review.confirm').click({ force: true });
    expect(settingsUpdates).toHaveLength(1);
    releaseSettingsUpdate?.();
    await expect(page.getByTestId('admin.user.payments.settings.review')).toBeHidden();
    await expect(page.getByTestId('admin.user.payments.settings.monthly_payment')).toBeEnabled();

    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.change')).toContainText(/100.*120/);
    expect(settingsUpdates).toHaveLength(1);
    await page.getByTestId('admin.user.payments.settings.review.confirm').click();
    await expect.poll(() => settingsUpdates.length).toBe(2);
    await expect(page.getByTestId('admin.user.payments.add.amount_input')).toBeEnabled();
    expect(settingsUpdates).toEqual([
      { user_account: { paid_until: '2026-04-01' } },
      { user_account: { monthly_payment: 120 } },
    ]);

    await page.getByTestId('admin.user.payments.add.amount_input').fill('150.5');
    await expect(page.getByTestId('admin.user.payments.add.validation')).toContainText(/valid|platnou/i);
    await expect(page.getByTestId('admin.user.payments.add.save')).toBeDisabled();

    await page.getByTestId('admin.user.payments.add.amount_input').fill('150');
    await expect(page.getByTestId('admin.user.payments.add.validation')).toContainText(/multiple|násobkem/i);
    await expect(page.getByTestId('admin.user.payments.add.save')).toBeDisabled();
    expect(manualPaymentRequests).toBe(0);

    await page.getByTestId('admin.user.payments.add.amount_input').fill('1800');
    await page.getByTestId('admin.user.payments.add.save').click();
    await expect(page.getByTestId('admin.user.payments.add.review')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.review.target')).toContainText('alice (#42)');
    await expect(page.getByTestId('admin.user.payments.add.review.months')).toContainText('18');
    await expect(page.getByTestId('admin.user.payments.add.review.amount')).toContainText('1,800');
    await expect(page.getByTestId('admin.user.payments.add.review')).toContainText(/e-mail/i);
    expect(manualPaymentRequests).toBe(0);
    await page.getByTestId('admin.user.payments.add.review.confirm').click();
    await expect.poll(() => manualPaymentRequests).toBe(1);
    await expect(page.getByTestId('admin.user.payments.add.review.confirm')).toBeDisabled();
    await page.getByTestId('admin.user.payments.add.review.confirm').click({ force: true });
    expect(manualPaymentRequests).toBe(1);
    releaseManualPayment?.();
    await expect(page.getByTestId('admin.user.payments.add.amount_input')).toHaveValue('');
  });

  test('@pr-smoke @pr-smoke-mobile admin payment history hides its lookahead and stops on an exact 200-row terminal page', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    const paymentRequests: Array<{ fromId: number | null; limit: number; userId: number | null }> = [];
    const allIds = Array.from({ length: 400 }, (_, index) => 10_000 - index);
    let revisitWithoutLookahead = false;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/42': () => ({
          user_account: {
            id: 42,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_payments': ({ searchParams }) => {
          const limit = Number(searchParams.get('user_payment[limit]') ?? 50);
          const rawFromId = searchParams.get('user_payment[from_id]');
          const fromId = rawFromId ? Number(rawFromId) : null;
          const rawUserId = searchParams.get('user_payment[user]');
          const userId = rawUserId ? Number(rawUserId) : null;
          paymentRequests.push({ fromId, limit, userId });

          const responseLimit = fromId === null && revisitWithoutLookahead ? 200 : limit;
          const ids = allIds
            .filter((id) => (fromId === null ? true : id < fromId))
            .slice(0, responseLimit);

          return {
            user_payments: ids.map((id) => ({
              id,
              amount: 100,
              created_at: '2026-02-10T12:00:00.000Z',
              from_date: '2026-02-01T00:00:00.000Z',
              to_date: '2026-03-01T00:00:00.000Z',
              accounted_by: { id: 1, login: 'admin' },
            })),
          };
        },
      },
    });

    await page.goto('/admin/users/42/payments?limit=200');

    const tableRows = page.getByTestId('admin.user.payments.history.table').locator('tbody tr');
    const next = page.getByTestId('admin.user.payments.history.pagination.next');
    await expect(tableRows).toHaveCount(200);
    await expect(page.getByTestId('admin.user.payments.history.row.10000')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9801')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9800')).toHaveCount(0);
    await expect(next).toBeEnabled();
    expect(paymentRequests[0]).toEqual({ fromId: null, limit: 201, userId: 42 });

    await next.click();

    await expect(page).toHaveURL(/(?:\?|&)from_id=9801(?:&|$)/);
    await expect(tableRows).toHaveCount(200);
    await expect(page.getByTestId('admin.user.payments.history.row.9800')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9601')).toBeVisible();
    await expect(next).toBeDisabled();
    const previous = page.getByTestId('admin.user.payments.history.pagination.prev');
    await expect(previous).toBeEnabled();
    expect(paymentRequests.at(-1)).toEqual({ fromId: 9801, limit: 201, userId: 42 });

    await previous.click();

    await expect(page).not.toHaveURL(/(?:\?|&)from_id=/);
    revisitWithoutLookahead = true;
    await page.reload();
    await expect(page.getByTestId('admin.user.payments.history.row.10000')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9801')).toBeVisible();
    await expect(next).toBeEnabled();
    expect(paymentRequests.at(-1)).toEqual({ fromId: null, limit: 201, userId: 42 });

    await next.click();

    await expect(page).toHaveURL(/(?:\?|&)from_id=9801(?:&|$)/);
    await expect(page.getByTestId('admin.user.payments.history.row.9800')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9601')).toBeVisible();
    await expect(next).toBeDisabled();
  });

  test('@pr-smoke @pr-smoke-mobile admin payment settings review fails closed after a background account change', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    let monthlyPayment = 100;
    let accountRequests = 0;
    let settingsUpdates = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            monthly_payment: monthlyPayment,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/42': () => {
          accountRequests += 1;
          return {
            user_account: {
              id: 42,
              monthly_payment: monthlyPayment,
              paid_until: '2026-03-01T00:00:00.000Z',
            },
          };
        },
        'PUT user_accounts/42': () => {
          settingsUpdates += 1;
          return { user_account: { id: 42, monthly_payment: 120 } };
        },
        'GET user_payments': () => ({ user_payments: [] }),
      },
    });

    await page.goto('/admin/users/42/payments');
    await expect(page.getByTestId('admin.user.payments.settings.monthly_payment')).toHaveValue('100');

    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.change')).toContainText(/100.*120/);

    monthlyPayment = 110;
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => accountRequests).toBeGreaterThan(1);

    await expect(page.getByTestId('admin.user.payments.settings.review.stale')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.review.confirm')).toBeDisabled();
    await page.getByTestId('admin.user.payments.settings.review.confirm').click({ force: true });
    expect(settingsUpdates).toBe(0);
  });

  test('@pr-smoke @pr-smoke-mobile admin payment account refresh failures preserve context but block every write', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    let accountRequests = 0;
    let failAccountRefresh = false;
    let settingsUpdates = 0;
    let manualPaymentRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/42': () => {
          accountRequests += 1;
          if (failAccountRefresh) {
            return {
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'temporary account failure', response: null }),
            };
          }
          return {
            user_account: {
              id: 42,
              monthly_payment: 100,
              paid_until: '2026-03-01T00:00:00.000Z',
            },
          };
        },
        'PUT user_accounts/42': () => {
          settingsUpdates += 1;
          return { user_account: { id: 42, monthly_payment: 120 } };
        },
        'GET user_payments': () => ({ user_payments: [] }),
        'POST user_payments': () => {
          manualPaymentRequests += 1;
          return { user_payment: { id: 9002 } };
        },
        'GET users/43': () => ({
          user: {
            id: 43,
            login: 'bob',
            level: 1,
            monthly_payment: 200,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/43': () => ({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: false, message: 'initial account failure', response: null }),
        }),
      },
    });

    await page.goto('/admin/users/42/payments');
    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.review')).toBeVisible();

    const requestsBeforeSettingsFailure = accountRequests;
    failAccountRefresh = true;
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => accountRequests).toBeGreaterThan(requestsBeforeSettingsFailure);

    await expect(page.getByTestId('admin.user.payments.settings.stale')).toContainText(/actions are disabled/i);
    await expect(page.getByTestId('admin.user.payments.settings.review.confirm')).toBeDisabled();
    await page.getByTestId('admin.user.payments.settings.review.confirm').click({ force: true });
    expect(settingsUpdates).toBe(0);

    const requestsBeforeRecovery = accountRequests;
    failAccountRefresh = false;
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => accountRequests).toBeGreaterThan(requestsBeforeRecovery);
    await expect(page.getByTestId('admin.user.payments.settings.stale')).toHaveCount(0);
    await expect(page.getByTestId('admin.user.payments.settings.review.confirm')).toBeEnabled();
    await page.getByTestId('admin.user.payments.settings.review.cancel').click();

    await page.getByTestId('admin.user.payments.add.amount_input').fill('1800');
    await page.getByTestId('admin.user.payments.add.save').click();
    await expect(page.getByTestId('admin.user.payments.add.review')).toBeVisible();

    failAccountRefresh = true;
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByTestId('admin.user.payments.settings.stale')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.review.confirm')).toBeDisabled();
    await page.getByTestId('admin.user.payments.add.review.confirm').click({ force: true });
    expect(manualPaymentRequests).toBe(0);

    failAccountRefresh = false;
    await page.goto('/admin/users/43/payments');
    await expect(page.getByTestId('admin.user.payments.settings.error')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.monthly_payment')).toHaveCount(0);
    await expect(page.getByTestId('admin.user.payments.add.amount_input')).toHaveCount(0);
  });

  test('@pr-smoke @pr-smoke-mobile admin payment history remains visible when its post-write refresh fails', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    let historyRequests = 0;
    let failHistoryRefresh = false;
    let manualPaymentRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/42': () => ({
          user_account: {
            id: 42,
            monthly_payment: 100,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET users/43': () => ({
          user: {
            id: 43,
            login: 'bob',
            level: 1,
            monthly_payment: 200,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_accounts/43': () => ({
          user_account: {
            id: 43,
            monthly_payment: 200,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'GET user_payments': ({ searchParams }) => {
          historyRequests += 1;
          const userId = Number(searchParams.get('user_payment[user]'));
          if (userId === 43 || failHistoryRefresh) {
            return {
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'temporary history failure', response: null }),
            };
          }
          return {
            user_payments: [{
              id: 9001,
              amount: 100,
              created_at: '2026-02-10T12:00:00.000Z',
              from_date: '2026-02-01T00:00:00.000Z',
              to_date: '2026-03-01T00:00:00.000Z',
              accounted_by: { id: 1, login: 'admin' },
            }],
          };
        },
        'POST user_payments': () => {
          manualPaymentRequests += 1;
          failHistoryRefresh = true;
          return {
            user_payment: { id: 9002, amount: 100 },
            _meta: { action_state_id: 124 },
          };
        },
      },
    });

    await page.goto('/admin/users/42/payments');
    await expect(page.getByTestId('admin.user.payments.history.row.9001')).toBeVisible();

    await page.getByTestId('admin.user.payments.add.amount_input').fill('100');
    await page.getByTestId('admin.user.payments.add.save').click();
    await page.getByTestId('admin.user.payments.add.review.confirm').click();
    await expect.poll(() => manualPaymentRequests).toBe(1);
    await expect.poll(() => historyRequests).toBeGreaterThan(1);

    await expect(page.getByTestId('admin.user.payments.history.stale')).toContainText(/may not include the newest/i);
    await expect(page.getByTestId('admin.user.payments.history.row.9001')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.error')).toHaveCount(0);

    failHistoryRefresh = false;
    await page.goto('/admin/users/43/payments');
    await expect(page.getByTestId('admin.user.payments.history.error')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.table')).toHaveCount(0);
  });
});

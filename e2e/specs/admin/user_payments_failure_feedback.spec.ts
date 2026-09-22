import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin user payment failure feedback', () => {
  test('keeps rejected account and manual payment changes in context for retry', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let monthlyPayment = 100;
    let settingsAttempts = 0;
    let paymentAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
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
        'GET user_accounts/42': () => ({
          user_account: {
            id: 42,
            monthly_payment: monthlyPayment,
            paid_until: '2026-03-01T00:00:00.000Z',
          },
        }),
        'PUT user_accounts/42': () => {
          settingsAttempts += 1;
          if (settingsAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: false,
                message: 'Account payment settings changed on the server.',
                response: null,
              }),
            };
          }

          monthlyPayment = 120;
          return { user_account: { id: 42, monthly_payment: monthlyPayment, paid_until: '2026-03-01T00:00:00.000Z' } };
        },
        'GET user_payments': () => ({ user_payments: [] }),
        'POST user_payments': () => {
          paymentAttempts += 1;
          if (paymentAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: false,
                message: 'Manual payment conflicts with a newer account entry.',
                response: null,
              }),
            };
          }

          return { user_payment: { id: 9002, amount: 240 }, _meta: { action_state_id: 124 } };
        },
      },
    });

    await page.goto('/admin/users/42/payments');

    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();
    const settingsDialog = page.getByTestId('admin.user.payments.settings.review');
    await expect(settingsDialog).toContainText('alice (#42)');

    await page.getByTestId('admin.user.payments.settings.review.confirm').click();
    await expect(page.getByTestId('admin.user.payments.settings.review.error')).toContainText(
      'Account payment settings changed on the server.'
    );
    await expect(settingsDialog).toContainText(/100.*120/);

    await page.getByTestId('admin.user.payments.settings.review.confirm').click();
    await expect(settingsDialog).toBeHidden();
    expect(settingsAttempts).toBe(2);

    await expect(page.getByTestId('admin.user.payments.settings.monthly_payment')).toHaveValue('120');
    await page.getByTestId('admin.user.payments.add.amount_input').fill('240');
    await page.getByTestId('admin.user.payments.add.save').click();
    const paymentDialog = page.getByTestId('admin.user.payments.add.review');
    await expect(paymentDialog).toContainText('alice (#42)');
    await expect(page.getByTestId('admin.user.payments.add.review.amount')).toContainText('240');

    await page.getByTestId('admin.user.payments.add.review.confirm').click();
    await expect(page.getByTestId('admin.user.payments.add.review.error')).toContainText(
      'Manual payment conflicts with a newer account entry.'
    );
    await expect(page.getByTestId('admin.user.payments.add.review.target')).toContainText('alice (#42)');

    await page.getByTestId('admin.user.payments.add.review.confirm').click();
    await expect(paymentDialog).toBeHidden();
    expect(paymentAttempts).toBe(2);
  });
});

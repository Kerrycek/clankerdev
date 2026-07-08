import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin user payments', () => {
  test('admin user payments: shows stats, instructions and history', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
  
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
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
        'PUT user_accounts/42': () => ({
          user_account: {
            id: 42,
            monthly_payment: 120,
            paid_until: '2026-04-01T00:00:00.000Z',
          },
        }),
        'GET users/42/get_payment_instructions': () => ({
          instructions: '<h3>Payment in EUR</h3><table><tr><td>Account:</td><td>123456/0100</td></tr><tr><td>VS:</td><td>42</td></tr></table>',
        }),
        'GET user_payments': () => ({
          user_payments: [
            {
              id: 9001,
              amount: 100,
              created_at: '2026-02-10T12:00:00.000Z',
              from_date: '2026-02-01T00:00:00.000Z',
              to_date: '2026-03-01T00:00:00.000Z',
              accounted_by: { id: 1, login: 'admin' },
              incoming_payment: { id: 300 },
            },
          ],
        }),
        'POST user_payments': () => ({
          user_payment: {
            id: 9002,
            amount: 100,
            created_at: '2026-02-11T12:00:00.000Z',
            from_date: '2026-03-01T00:00:00.000Z',
            to_date: '2026-04-01T00:00:00.000Z',
            accounted_by: { id: 1, login: 'admin' },
          },
          _meta: { action_state_id: 123 },
        }),
      },
    });
  
    await page.goto('/admin/users/42/payments');
  
    await expect(page.getByTestId('admin.user.payments.stat.paid_until')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.stat.monthly_payment')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.stat.payment_id')).toBeVisible();
  
    const instructions = page.getByTestId('admin.user.payments.instructions.text');
    await expect(instructions.getByRole('heading', { name: 'Payment in EUR' })).toBeVisible();
    await expect(instructions.getByText('123456/0100')).toBeVisible();
    await expect(instructions).not.toContainText('<h3>');
  
    await expect(page.getByTestId('admin.user.payments.history.table')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9001')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveText('#300');
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveAttribute('href', '/admin/payments/incoming/300');
  
    await expect(page.getByTestId('admin.user.payments.quick.card')).toBeVisible();

    await page.getByTestId('admin.user.payments.settings.paid_until').fill('2026-04-01');
    await page.getByTestId('admin.user.payments.settings.paid_until.save').click();

    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();

    await page.getByTestId('admin.user.payments.add.amount_input').fill('1800');
    await page.getByTestId('admin.user.payments.add.save').click();
    await expect(page.getByTestId('admin.user.payments.add.amount_input')).toHaveValue('');
  });
});

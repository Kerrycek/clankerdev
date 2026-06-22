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
          instructions: 'Account: 123456/0100\nVS: 42\nMessage: alice',
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
  
    await expect(page.getByTestId('admin.user.payments.instructions.text')).toContainText('VS: 42');
  
    await expect(page.getByTestId('admin.user.payments.history.table')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.history.row.9001')).toBeVisible();
  
    await expect(page.getByTestId('admin.user.payments.settings.open')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.open')).toBeVisible();
  
    // Open settings modal and save.
    await page.getByTestId('admin.user.payments.settings.open').click();
    await expect(page.getByTestId('admin.user.payments.settings.modal')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.review')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.settings.review.impact')).toContainText('Nothing will be saved');
    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await expect(page.getByTestId('admin.user.payments.settings.review.monthly')).toContainText('120');
    await page.getByTestId('admin.user.payments.settings.save').click();
    await expect(page.getByTestId('admin.user.payments.settings.modal')).toBeHidden();
  
    // Open "add payment" modal (sanity check UI only).
    await page.getByTestId('admin.user.payments.add.open').click();
    await expect(page.getByTestId('admin.user.payments.add.modal')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.amount')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.review')).toBeVisible();
    await expect(page.getByTestId('admin.user.payments.add.review.amount')).toContainText('100');
    await page.getByTestId('admin.user.payments.add.cancel').click();
  });
});

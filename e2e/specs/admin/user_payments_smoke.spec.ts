import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test.describe('@smoke Admin user payments', () => {
  test('@pr-smoke @pr-smoke-mobile admin user payments: shows stats, instructions and history', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
    let paymentInstructionRequests = 0;
  
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
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveText('#300');
    await expect(page.getByTestId('admin.user.payments.history.row.9001.source')).toHaveAttribute('href', '/admin/payments/incoming/300');

    await page.getByTestId('admin.user.payments.settings.paid_until').fill('2026-04-01');
    await page.getByTestId('admin.user.payments.settings.paid_until.save').click();

    await page.getByTestId('admin.user.payments.settings.monthly_payment').fill('120');
    await page.getByTestId('admin.user.payments.settings.monthly.save').click();

    await page.getByTestId('admin.user.payments.add.amount_input').fill('1800');
    await page.getByTestId('admin.user.payments.add.save').click();
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
});

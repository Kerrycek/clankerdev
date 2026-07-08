import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

test('user payments page: shows status, instructions and history', async ({ page }) => {
  test.setTimeout(90_000);

  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page);

  haveApiMock.addHandler('GET users/current', () => {
    return {
      user: {
        id: 1,
        login: 'alice',
        level: 1,
        monthly_payment: 200,
        paid_until: '2099-01-01T00:00:00Z',
      },
    };
  });

  haveApiMock.addHandler('GET users/1/get_payment_instructions', () => {
    return {
      hash: {
        instructions: '<h3>Payment in CZK</h3><table><tr><td>IBAN:</td><td>CZ00TEST</td></tr><tr><td>VS:</td><td>1</td></tr></table>',
      },
    };
  });

  haveApiMock.addHandler('GET user_payments', ({ searchParams }) => {
    const limit = Number(searchParams.get('user_payment[limit]') ?? 50);
    const fromIdRaw = searchParams.get('user_payment[from_id]');
    const fromId = fromIdRaw ? Number(fromIdRaw) : null;

    const ids = Array.from({ length: 10 }, (_, i) => 300 - i)
      .filter((id) => (fromId ? id < fromId : true))
      .slice(0, limit);

    return {
      status: true,
      response: {
        user_payments: ids.map((id) => ({
          id,
          amount: 200,
          created_at: '2026-02-14T09:00:00Z',
          from_date: '2026-02-01T00:00:00Z',
          to_date: '2026-03-01T00:00:00Z',
        })),
      },
    };
  });

  await page.goto(withAppUrl('/app/payments'));

  await expect(page.getByTestId('payments.my.stat.paid_until')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('payments.my.stat.paid_until').getByText('Paid', { exact: true })).toBeVisible();

  const instructions = page.getByTestId('payments.my.instructions.text');
  await expect(instructions.getByRole('heading', { name: 'Payment in CZK' })).toBeVisible();
  await expect(instructions.getByText('CZ00TEST')).toBeVisible();
  await expect(instructions).not.toContainText('<h3>');
  await expect(page.getByTestId('payments.my.instructions.copy')).toBeVisible();

  await expect(page.getByTestId('payments.my.history.table')).toBeVisible();
  await expect(page.getByTestId('payments.my.history.table').locator('tbody tr')).toHaveCount(10);
});

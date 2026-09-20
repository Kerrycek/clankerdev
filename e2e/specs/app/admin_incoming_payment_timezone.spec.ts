import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile incoming payment dates follow the signed-in account time zone', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    webuiNext: { serverTimeZone: 'Europe/Prague' },
  });

  await installHaveApiMock(page, {
    user: {
      id: 1,
      login: 'admin',
      level: 100,
      time_zone: 'America/Los_Angeles',
    },
    handlers: {
      'GET incoming_payments': () => ({
        incoming_payments: [{
          id: 300,
          state: 'processed',
          date: '2026-02-14T00:30:00Z',
          created_at: '2026-02-14T01:30:00Z',
          transaction_id: 'TX-300',
          transaction_type: 'credit transfer',
          amount: 1_000,
          currency: 'CZK',
          account_name: 'Test account',
          vs: '300',
          user: { id: 42, login: 'alice' },
          user_paid_until: '2026-03-01T00:00:00Z',
        }],
      }),
      'GET incoming_payments/300': () => ({
        incoming_payment: {
          id: 300,
          state: 'processed',
          date: '2026-02-14T00:30:00Z',
          created_at: '2026-02-14T01:30:00Z',
          transaction_id: 'TX-300',
          transaction_type: 'credit transfer',
          amount: 1_000,
          currency: 'CZK',
          account_name: 'Test account',
          vs: '300',
          user: { id: 42, login: 'alice' },
          user_paid_until: '2026-03-01T00:00:00Z',
        },
      }),
    },
  });

  await page.goto('/admin/payments/incoming');

  for (const surface of ['mobile', 'desktop']) {
    const eventDate = page.getByTestId(`admin.payments.incoming.row.300.date.${surface}`);
    await expect(eventDate).toContainText('2/13/2026');
    await expect(eventDate).toContainText('4:30');
    await expect(page.getByTestId(`admin.payments.incoming.row.300.paid_until.${surface}`)).toHaveText('2/28/2026');
  }
  await expectNoDocumentHorizontalOverflow(page);

  await page.goto('/admin/payments/incoming/300');

  await expect(page.getByTestId('admin.payments.incoming.detail.event_date')).toContainText('2/13/2026');
  await expect(page.getByTestId('admin.payments.incoming.detail.event_date')).toContainText('4:30');
  await expect(page.getByTestId('admin.payments.incoming.detail.accepted_at')).toContainText('2/13/2026');
  await expect(page.getByTestId('admin.payments.incoming.detail.accepted_at')).toContainText('5:30');
  await expect(page.getByTestId('admin.payments.incoming.detail.user_paid_until')).toHaveText('Paid until: 2/28/2026');
  await expectNoDocumentHorizontalOverflow(page);
});

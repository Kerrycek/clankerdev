import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

function registration(id: number, state = 'awaiting') {
  return {
    id,
    state,
    login: `applicant-${id}`,
    full_name: `Applicant ${id}`,
    email: `applicant-${id}@example.test`,
    address: 'Test street 1, Prague',
    year_of_birth: 1990,
    os_template: { id: 5, label: 'Debian 13' },
    location: { id: 7, label: 'Prague' },
    currency: 'czk',
    language: { id: 2, code: 'cs', label: 'Čeština' },
    time_zone: 'Europe/Prague',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
  };
}

test('@pr-smoke @pr-smoke-mobile admin requests: opening any waiting row starts the review queue', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const first = registration(302);
  let selected = registration(301);
  const next = registration(300);

  await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        const state = searchParams.get('registration[state]');
        const registrations = [first, selected, next];
        return { registrations: state ? registrations.filter((request) => request.state === state) : registrations };
      },
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/302': () => ({ registration: first }),
      'GET user_request/registrations/301': () => ({ registration: selected }),
      'GET user_request/registrations/300': () => ({ registration: next }),
      'POST user_request/registrations/301/resolve': () => {
        selected = { ...selected, state: 'ignored' };
        return { registration: selected };
      },
    },
  });

  await page.goto(withAppUrl('/admin/requests'));
  await page.locator(
    '[data-testid="admin.requests.mobile.row.registration.301"] a:visible, [data-testid="admin.requests.row.registration.301"]:visible',
  ).first().click();

  await expect(page).toHaveURL(/\/admin\/requests\/registration\/301/);
  await expect(page.getByTestId('admin.requests.review.continue')).toBeChecked();
  await expect(page.getByTestId('admin.requests.review.queue')).toContainText('3');

  await page.getByTestId('admin.requests.resolve.action.ignore').click();

  await expect(page).toHaveURL(/\/admin\/requests\/registration\/300/);
  await expect(page.getByTestId('admin.requests.review.queue')).toContainText('2');
});

test('@pr-smoke @pr-smoke-mobile admin incoming payments: opening any unmatched row starts the review queue', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const states = new Map<number, string>([
    [302, 'unmatched'],
    [301, 'unmatched'],
    [300, 'unmatched'],
  ]);
  const payment = (id: number) => ({
    id,
    state: states.get(id),
    date: '2026-02-14T09:00:00Z',
    transaction_id: `TX-${id}`,
    amount: 1_000,
    currency: 'CZK',
    account_name: 'Test account',
    vs: String(id),
    created_at: '2026-02-14T09:00:00Z',
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET incoming_payments': ({ searchParams }) => {
        const requestedState = String(searchParams.get('incoming_payment[state]') ?? '');
        const rows = [302, 301, 300]
          .map(payment)
          .filter((row) => !requestedState || row.state === requestedState);
        return { incoming_payments: rows, _meta: { total_count: rows.length } };
      },
      'GET incoming_payments/302': () => ({ incoming_payment: payment(302) }),
      'GET incoming_payments/301': () => ({ incoming_payment: payment(301) }),
      'GET incoming_payments/300': () => ({ incoming_payment: payment(300) }),
      'GET users/123': () => ({ user: { id: 123, login: 'alice', full_name: 'Alice Example' } }),
      'POST user_payments': ({ reqJson }) => {
        const incomingPaymentId = Number(reqJson?.user_payment?.incoming_payment);
        states.set(incomingPaymentId, 'processed');
        return {
          user_payment: { id: 7_000 + incomingPaymentId, incoming_payment: { id: incomingPaymentId } },
          _meta: { action_state_id: 9_000 + incomingPaymentId },
        };
      },
    },
  });

  await page.goto(withAppUrl('/admin/payments/incoming?state=unmatched'));
  await page.locator(
    'a[href*="/admin/payments/incoming/301"]:visible, [data-testid="admin.payments.incoming.row.301"]:visible',
  ).first().click();

  await expect(page).toHaveURL(/\/admin\/payments\/incoming\/301/);
  await expect(page.getByTestId('admin.payments.incoming.review.continue')).toBeChecked();
  await expect(page.getByTestId('admin.payments.incoming.review.queue')).toContainText('3');

  await page.getByTestId('admin.payments.incoming.assign.user_id').fill('123');
  await page.getByTestId('admin.payments.incoming.assign.submit').click();

  await expect(page).toHaveURL(/\/admin\/payments\/incoming\/300/);
  await expect(page.getByTestId('admin.payments.incoming.review.queue')).toContainText('2');
  await expect(page.getByTestId('admin.payments.incoming.detail.300.state')).toBeVisible();
});

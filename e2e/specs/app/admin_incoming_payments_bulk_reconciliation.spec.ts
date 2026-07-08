import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

test('admin incoming payments: bulk reconciliation uses visible selection with typed confirmation', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });

  const payments = new Map<number, { id: number; state: string; user: { id: number; login: string } | null }>([
    [300, { id: 300, state: 'queued', user: null }],
    [299, { id: 299, state: 'unmatched', user: null }],
    [298, { id: 298, state: 'processed', user: { id: 10, login: 'alice' } }],
  ]);
  const updatedIds: number[] = [];

  function paymentEnvelope(id: number) {
    const payment = payments.get(id) ?? { id, state: 'queued', user: null };
    return {
      id: payment.id,
      state: payment.state,
      date: '2026-02-14T09:00:00Z',
      transaction_id: `TX-${payment.id}`,
      amount: 1000,
      currency: 'CZK',
      account_name: 'Test account',
      vs: String(payment.id),
      user: payment.user,
      user_paid_until: payment.user ? '2026-03-01T00:00:00Z' : null,
      created_at: '2026-02-14T09:00:00Z',
    };
  }

  haveApiMock.addHandler('GET incoming_payments', () => ({
    status: true,
    response: {
      incoming_payments: Array.from(payments.keys())
        .sort((a, b) => b - a)
        .map(paymentEnvelope),
    },
  }));

  for (const id of [299, 300]) {
    haveApiMock.addHandler(`PUT incoming_payments/${id}`, async ({ json }) => {
      const body = json as { incoming_payment?: { state?: unknown } } | undefined;
      const nextState = String(body?.incoming_payment?.state ?? '');
      const payment = payments.get(id);
      if (payment) payment.state = nextState;
      updatedIds.push(id);
      return {
        status: true,
        response: { incoming_payment: paymentEnvelope(id) },
      };
    });
  }

  await page.goto(withAppUrl('/admin/payments/incoming'));

  await expect(page.getByTestId('admin.payments.incoming.bulk.card')).toBeVisible();
  await page.getByTestId('admin.payments.incoming.bulk.select_needs_review').click();
  await expect(page.getByTestId('admin.payments.incoming.bulk.summary')).toContainText(/Eligible: 1/);

  await page.getByTestId('admin.payments.incoming.bulk.action').selectOption('mark_ignored');
  await expect(page.getByTestId('admin.payments.incoming.bulk.summary')).toContainText(/Eligible: 2/);
  await page.getByTestId('admin.payments.incoming.bulk.review.open').click();
  await expect(page.getByTestId('admin.payments.incoming.bulk.review.warning')).toContainText(/Ignored payments are kept outside/);
  await expect(page.getByTestId('admin.payments.incoming.bulk.review.confirm')).toBeDisabled();

  await page.getByTestId('admin.payments.incoming.bulk.review.input').fill('IGNORE 2');
  await expect(page.getByTestId('admin.payments.incoming.bulk.review.confirm')).toBeEnabled();
  await page.getByTestId('admin.payments.incoming.bulk.review.confirm').click();

  await expect.poll(() => updatedIds.slice().sort((a, b) => a - b)).toEqual([299, 300]);
  await expect(page.getByTestId('admin.payments.incoming.row.300')).toContainText(/Ignored/);
  await expect(page.getByTestId('admin.payments.incoming.row.299')).toContainText(/Ignored/);
  await expect(page.getByTestId('admin.payments.incoming.row.298')).toContainText(/Processed/);
});

test('admin incoming payments: reconciliation summary links to all unmatched payments', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });
  const requestedStates: string[] = [];

  const payments = [
    { id: 400, state: 'processed', user: { id: 10, login: 'alice' } },
    { id: 399, state: 'unmatched', user: null },
    { id: 398, state: 'processed', user: { id: 11, login: 'bob' } },
  ];

  function paymentEnvelope(payment: { id: number; state: string; user: { id: number; login: string } | null }) {
    return {
      id: payment.id,
      state: payment.state,
      date: '2026-02-14T09:00:00Z',
      transaction_id: `TX-${payment.id}`,
      amount: 1000,
      currency: 'CZK',
      account_name: 'Test account',
      vs: String(payment.id),
      user: payment.user,
      user_paid_until: payment.user ? '2026-03-01T00:00:00Z' : null,
      created_at: '2026-02-14T09:00:00Z',
    };
  }

  haveApiMock.addHandler('GET incoming_payments', ({ searchParams }) => {
    const state = String(searchParams.get('incoming_payment[state]') ?? '');
    if (state) requestedStates.push(state);

    const stateTotals: Record<string, number> = {
      queued: 0,
      unmatched: 4,
      ignored: 2,
    };
    const rows = state ? payments.filter((payment) => payment.state === state) : payments;

    return {
      status: true,
      response: {
        incoming_payments: rows.map(paymentEnvelope),
        _meta: { total_count: state ? stateTotals[state] ?? rows.length : rows.length },
      },
    };
  });

  await page.goto(withAppUrl('/admin/payments/incoming'));

  await expect(page.getByTestId('admin.payments.incoming.reconciliation.metric.needs_review')).toContainText(/Needs review/);
  await expect(page.getByTestId('admin.payments.incoming.reconciliation.metric.needs_review')).toContainText(/4/);
  await expect(page.getByTestId('admin.payments.incoming.reconciliation.summary.open_unmatched')).toContainText(/Unmatched: 4/);

  await page.getByTestId('admin.payments.incoming.reconciliation.summary.open_unmatched').click();

  await expect(page).toHaveURL(/state=unmatched/);
  await expect.poll(() => requestedStates).toContain('unmatched');
  await expect(page.getByTestId('admin.payments.incoming.row.399')).toBeVisible();
  await expect(page.getByTestId('admin.payments.incoming.row.400')).toHaveCount(0);
});

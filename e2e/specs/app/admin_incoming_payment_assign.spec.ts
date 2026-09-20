import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile admin incoming payment: assign to user', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });

  let assigned = false;
  let assignedUser: { id: number; login: string } | null = null;
  let state: string = 'unmatched';
  let assignmentRequests = 0;
  let stateUpdateRequests = 0;
  let releaseAssignment: (() => void) | undefined;
  const assignmentGate = new Promise<void>((resolve) => {
    releaseAssignment = resolve;
  });

  const paymentId = 300;

  function paymentEnvelope() {
    return {
      id: paymentId,
      state,
      date: '2026-02-14T09:00:00Z',
      transaction_id: 'TX-300',
      transaction_type: 'credit transfer',
      amount: 1000,
      currency: 'CZK',
      src_amount: 40,
      src_currency: 'EUR',
      account_name: 'Test account',
      vs: '123456',
      user_message: 'hello',
      user_ident: 'VS:123456',
      comment: 'mock',
      user: assigned ? assignedUser : null,
      user_paid_until: assigned ? '2026-03-01T00:00:00Z' : null,
      created_at: '2026-02-14T09:00:00Z',
    };
  }

  haveApiMock.addHandler('GET incoming_payments', ({ searchParams }) => {
    const limit = Number(searchParams.get('incoming_payment[limit]') ?? 25);
    const fromIdRaw = searchParams.get('incoming_payment[from_id]');
    const fromId = fromIdRaw ? Number(fromIdRaw) : null;

    const ids = Array.from({ length: 60 }, (_, i) => 300 - i).filter((id) => (fromId ? id < fromId : true)).slice(0, limit);

    return {
      status: true,
      response: {
        incoming_payments: ids.map((id) => ({ ...paymentEnvelope(), id })),
      },
    };
  });

  haveApiMock.addHandler('GET incoming_payments/300', () => {
    return {
      status: true,
      response: {
        incoming_payment: paymentEnvelope(),
      },
    };
  });

  haveApiMock.addHandler('GET users/123', () => ({
    user: { id: 123, login: 'alice', full_name: 'Alice Example', email: 'alice@example.test' },
  }));

  haveApiMock.addHandler('PUT incoming_payments/300', async ({ json }) => {
    stateUpdateRequests += 1;
    state = String(json?.incoming_payment?.state ?? state);
    return {
      status: true,
      response: {
        incoming_payment: paymentEnvelope(),
      },
    };
  });

  haveApiMock.addHandler('POST user_payments', async ({ json }) => {
    assignmentRequests += 1;
    await assignmentGate;
    const userId = Number(json?.user_payment?.user);
    assigned = true;
    assignedUser = { id: userId, login: 'alice' };
    // user_payment#create atomically transitions its linked incoming payment.
    state = 'processed';

    return {
      status: true,
      _meta: {
        action_state_id: 9001,
      },
      response: {
        user_payment: {
          id: 7001,
          user: assignedUser,
          incoming_payment: { id: paymentId },
          amount: json?.user_payment?.amount ?? 1000,
          created_at: '2026-02-14T09:05:00Z',
        },
      },
    };
  });

  await page.goto(withAppUrl('/admin/payments/incoming/300'));

  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();
  await expect(page.getByTestId('admin.payments.incoming.detail.accepted_at')).toContainText('2/14/2026');
  await expect(page.getByTestId('admin.payments.incoming.detail.transaction_type')).toContainText('credit transfer');
  await expectNoDocumentHorizontalOverflow(page);
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('ignored');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('unmatched');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();

  await expect(page.getByTestId('admin.payments.incoming.assign.user_id')).toBeVisible();
  await expect(page.getByTestId('admin.payments.incoming.assign.review')).toContainText(/Assignment review/);
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeDisabled();

  await page.getByTestId('admin.payments.incoming.assign.user_id').fill('123');
  await expect(page.getByTestId('admin.payments.incoming.assign.review.user')).toContainText('#123');
  await expect(page.getByTestId('admin.payments.incoming.assign.review.state')).toContainText(/Processed/);
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeEnabled();

  await page.getByTestId('admin.payments.incoming.assign.submit').click();
  await expect.poll(() => assignmentRequests).toBe(1);
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeDisabled();
  await page.getByTestId('admin.payments.incoming.assign.submit').click({ force: true });
  expect(assignmentRequests).toBe(1);
  releaseAssignment?.();

  // After refetch, the user should be visible and the assign button disabled.
  await expect(page.getByTestId('admin.payments.incoming.detail.300.state')).toHaveText(/Processed/);
  await expect(page.getByTestId('admin.payments.incoming.assign.inline')).toHaveCount(0);
  await expect(page.getByText('alice')).toBeVisible();
  expect(stateUpdateRequests).toBe(0);
});

test('admin incoming payment: route change drops the previous payment edits without writing', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const payment = (id: number) => ({
    id,
    state: 'unmatched',
    date: '2026-02-14T09:00:00Z',
    transaction_id: `TX-${id}`,
    amount: 1000,
    currency: 'CZK',
    account_name: 'Test account',
    vs: String(id),
    user: null,
    created_at: '2026-02-14T09:00:00Z',
  });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET incoming_payments/300': () => ({ incoming_payment: payment(300) }),
      'GET incoming_payments/301': () => ({ incoming_payment: payment(301) }),
      'GET users/123': () => ({ user: { id: 123, login: 'alice' } }),
      'PUT incoming_payments/300': () => ({ incoming_payment: payment(300) }),
      'PUT incoming_payments/301': () => ({ incoming_payment: payment(301) }),
      'POST user_payments': () => ({ user_payment: { id: 1 } }),
    },
  });
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
      && /\/api\/v7\.0\/(?:incoming_payments|user_payments)/.test(request.url())
    ) {
      mutations.push(request.url());
    }
  });

  await page.goto(withAppUrl('/admin/payments/incoming/300'));
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('ignored');
  await page.getByTestId('admin.payments.incoming.assign.user_id').fill('123');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeEnabled();

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/payments/incoming/301');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByTestId('admin.payments.incoming.detail.301.state')).toBeVisible();
  await expect(page.getByTestId('admin.payments.incoming.state.select')).toHaveValue('unmatched');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.user_id')).toHaveValue('');
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeDisabled();
  expect(mutations).toEqual([]);
});

test('@pr-smoke @pr-smoke-mobile admin incoming payment: stale state review cannot overwrite a newer state', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });
  let state = 'unmatched';
  let detailRequests = 0;
  let stateUpdateRequests = 0;

  const paymentEnvelope = () => ({
    id: 600,
    state,
    date: '2026-02-14T09:00:00Z',
    transaction_id: 'TX-600',
    amount: 1_000,
    currency: 'CZK',
    account_name: 'Test account',
    vs: '600',
    user: null,
    user_paid_until: null,
    created_at: '2026-02-14T09:00:00Z',
  });

  haveApiMock.addHandler('GET incoming_payments/600', () => {
    detailRequests += 1;
    return { incoming_payment: paymentEnvelope() };
  });
  haveApiMock.addHandler('PUT incoming_payments/600', () => {
    stateUpdateRequests += 1;
    return { incoming_payment: paymentEnvelope() };
  });

  await page.goto(withAppUrl('/admin/payments/incoming/600'));
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('ignored');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();

  state = 'processed';
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => detailRequests).toBeGreaterThan(1);

  await expect(page.getByTestId('admin.payments.incoming.detail.600.state')).toHaveText(/Processed/);
  await expect(page.getByTestId('admin.payments.incoming.state.review.stale')).toBeVisible();
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();
  await page.getByTestId('admin.payments.incoming.state.save').click({ force: true });
  expect(stateUpdateRequests).toBe(0);

  await page.getByTestId('admin.payments.incoming.state.select').selectOption('queued');
  await expect(page.getByTestId('admin.payments.incoming.state.review.stale')).toHaveCount(0);
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();
});

test('@pr-smoke @pr-smoke-mobile admin incoming payment: refresh failure keeps context and blocks review actions', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });
  let detailRequests = 0;
  let failRefresh = false;
  let stateUpdateRequests = 0;
  let assignmentRequests = 0;

  const payment = {
    id: 700,
    state: 'unmatched',
    date: '2026-02-14T09:00:00Z',
    transaction_id: 'TX-700',
    amount: 1_000,
    currency: 'CZK',
    account_name: 'Test account',
    vs: '700',
    user: null,
    user_paid_until: null,
    created_at: '2026-02-14T09:00:00Z',
  };

  haveApiMock.addHandler('GET incoming_payments/700', () => {
    detailRequests += 1;
    if (failRefresh) {
      return {
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: false, message: 'temporary detail failure', response: null }),
      };
    }
    return { incoming_payment: payment };
  });
  haveApiMock.addHandler('GET users/123', () => ({
    user: { id: 123, login: 'alice', full_name: 'Alice Example' },
  }));
  haveApiMock.addHandler('PUT incoming_payments/700', () => {
    stateUpdateRequests += 1;
    return { incoming_payment: payment };
  });
  haveApiMock.addHandler('POST user_payments', () => {
    assignmentRequests += 1;
    return { user_payment: { id: 900 } };
  });

  await page.goto(withAppUrl('/admin/payments/incoming/700'));
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('ignored');
  await page.getByTestId('admin.payments.incoming.assign.user_id').fill('123');
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeEnabled();

  const requestsBeforeFailure = detailRequests;
  failRefresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => detailRequests).toBeGreaterThan(requestsBeforeFailure);

  await expect(page.getByTestId('admin.payments.incoming.detail.stale')).toContainText(/review actions are disabled/i);
  await expect(page.getByTestId('admin.payments.incoming.detail.700.state')).toHaveText(/Unmatched/);
  await expect(page.getByTestId('admin.payments.incoming.state.select')).toBeDisabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.user_id')).toBeDisabled();
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeDisabled();
  await expect(page.getByText(/Unable to load payment/)).toHaveCount(0);

  await page.getByTestId('admin.payments.incoming.state.save').click({ force: true });
  await page.getByTestId('admin.payments.incoming.assign.submit').click({ force: true });
  expect(stateUpdateRequests).toBe(0);
  expect(assignmentRequests).toBe(0);

  const requestsBeforeRecovery = detailRequests;
  failRefresh = false;
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => detailRequests).toBeGreaterThan(requestsBeforeRecovery);
  await expect(page.getByTestId('admin.payments.incoming.detail.stale')).toHaveCount(0);
  await expect(page.getByTestId('admin.payments.incoming.state.select')).toBeEnabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.user_id')).toBeEnabled();
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeEnabled();
  await expect(page.getByTestId('admin.payments.incoming.assign.submit')).toBeEnabled();
});

test('@pr-smoke @pr-smoke-mobile admin incoming payment: state changes are single-flight and invalidate cached reconciliation totals', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });

  let state = 'unmatched';
  let stateUpdateRequests = 0;
  let listRequests = 0;
  const totalRequests: Record<string, number> = {};
  let releaseStateUpdate: (() => void) | undefined;
  const stateUpdateGate = new Promise<void>((resolve) => {
    releaseStateUpdate = resolve;
  });

  const paymentEnvelope = () => ({
    id: 500,
    state,
    date: '2026-02-14T09:00:00Z',
    transaction_id: 'TX-500',
    amount: 1000,
    currency: 'CZK',
    account_name: 'Test account',
    vs: '500',
    user: null,
    user_paid_until: null,
    created_at: '2026-02-14T09:00:00Z',
  });

  haveApiMock.addHandler('GET incoming_payments', ({ searchParams }) => {
    const requestedState = String(searchParams.get('incoming_payment[state]') ?? '');
    if (requestedState) totalRequests[requestedState] = (totalRequests[requestedState] ?? 0) + 1;
    else listRequests += 1;
    const rows = !requestedState || requestedState === state ? [paymentEnvelope()] : [];
    return {
      status: true,
      response: { incoming_payments: rows, _meta: { total_count: rows.length } },
    };
  });
  haveApiMock.addHandler('GET incoming_payments/500', () => ({ incoming_payment: paymentEnvelope() }));
  haveApiMock.addHandler('PUT incoming_payments/500', async ({ json }) => {
    stateUpdateRequests += 1;
    await stateUpdateGate;
    state = String(json?.incoming_payment?.state ?? state);
    return { incoming_payment: paymentEnvelope() };
  });

  await page.goto(withAppUrl('/admin/payments/incoming'));
  await expect.poll(() => ({ ...totalRequests })).toEqual({ queued: 1, unmatched: 1, processed: 1, ignored: 1 });
  expect(listRequests).toBe(1);

  await page.goto(withAppUrl('/admin/payments/incoming/500'));
  await page.getByTestId('admin.payments.incoming.state.select').selectOption('ignored');
  await page.getByTestId('admin.payments.incoming.state.save').click();
  await expect.poll(() => stateUpdateRequests).toBe(1);
  await expect(page.getByTestId('admin.payments.incoming.state.save')).toBeDisabled();
  await page.getByTestId('admin.payments.incoming.state.save').click({ force: true });
  expect(stateUpdateRequests).toBe(1);
  releaseStateUpdate?.();

  await expect(page.getByTestId('admin.payments.incoming.detail.500.state')).toHaveText(/Ignored/);
  await page.getByRole('link', { name: /Back|Zpět/ }).click();

  await expect.poll(() => ({ ...totalRequests })).toEqual({ queued: 2, unmatched: 2, processed: 2, ignored: 2 });
  expect(listRequests).toBe(2);
});

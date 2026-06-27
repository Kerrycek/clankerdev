// i18n-ignore-file

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { IncomingPaymentDetailPage } from './IncomingPaymentDetailPage';

const mocks = vi.hoisted(() => ({
  appMode: { mode: 'admin' as 'admin' | 'user', basePath: '/admin' },
  fetchIncomingPayment: vi.fn(),
  updateIncomingPaymentState: vi.fn(),
  createUserPayment: vi.fn(),
  fetchPaymentInstructions: vi.fn(),
  fetchUser: vi.fn(),
  fetchUserAccount: vi.fn(),
  searchUsers: vi.fn(),
  pushToast: vi.fn(),
  chrome: {
    trackActionState: vi.fn(),
  },
}));

vi.mock('../../../app/appMode', () => ({
  useAppMode: () => mocks.appMode,
}));

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    lang: 'en',
    preference: 'en',
    preferredLanguageCodes: ['en', 'cs'],
    t: (key: string, vars?: Record<string, unknown>) => {
      let out = key;
      for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, String(v));
      return out;
    },
    tc: (key: string, count: number) => `${key}:${count}`,
  }),
}));

vi.mock('../../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../../components/layout/ChromeContext', () => ({
  useChrome: () => mocks.chrome,
}));

vi.mock('../../../lib/api/payments', () => ({
  fetchIncomingPayment: mocks.fetchIncomingPayment,
  updateIncomingPaymentState: mocks.updateIncomingPaymentState,
  createUserPayment: mocks.createUserPayment,
  fetchPaymentInstructions: mocks.fetchPaymentInstructions,
}));

vi.mock('../../../lib/api/users', () => ({
  fetchUser: mocks.fetchUser,
  searchUsers: mocks.searchUsers,
}));

vi.mock('../../../lib/api/userAccounts', () => ({
  fetchUserAccount: mocks.fetchUserAccount,
}));

function renderPage(path = '/admin/payments/incoming/15') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/payments/incoming/:paymentId" element={<IncomingPaymentDetailPage />} />
          <Route path="/admin/payments/incoming" element={<div data-testid="admin.payments.incoming.list" />} />
          <Route path="/admin/users/:userId" element={<div data-testid="admin.users.detail" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchIncomingPayment.mockResolvedValue({
    data: {
      id: 15,
      state: 'unmatched',
      date: '2026-06-20T10:00:00Z',
      amount: 600,
      currency: 'CZK',
      account_name: 'Bank account',
      transaction_id: 'TX-15',
      vs: '7',
      user_message: 'membership payment',
    },
  });
  mocks.fetchUser.mockResolvedValue({
    data: {
      id: 7,
      login: 'alice',
      full_name: 'Alice Example',
      email: 'alice@example.test',
      level: 1,
      monthly_payment: 300,
      paid_until: '2026-07-01T00:00:00Z',
    },
  });
  mocks.fetchUserAccount.mockResolvedValue({
    data: {
      id: 7,
      monthly_payment: 300,
      paid_until: '2026-07-01T00:00:00Z',
    },
  });
  mocks.fetchPaymentInstructions.mockResolvedValue({ data: { instructions: 'Account 123/0100\nVS 7' } });
  mocks.createUserPayment.mockResolvedValue({ data: { id: 55 }, meta: { action_state_id: 909 } });
  mocks.updateIncomingPaymentState.mockResolvedValue({ data: { id: 15, state: 'processed' } });
  mocks.searchUsers.mockResolvedValue({ data: [] });
});

describe('IncomingPaymentDetailPage assignment', () => {
  test('uses VS as a user candidate, shows recap and assigns via user_payment#create', async () => {
    renderPage();

    await screen.findByTestId('admin.payments.incoming.assign.open');

    await userEvent.click(screen.getByTestId('admin.payments.incoming.assign.open'));

    expect(await screen.findByTestId('admin.payments.incoming.assign.modal')).toBeVisible();
    expect(mocks.fetchUser).toHaveBeenCalledWith(7);

    expect(await screen.findByText('alice')).toBeVisible();
    expect(await screen.findByText(/Account 123\/0100/)).toBeVisible();
    expect(screen.getByTestId('admin.payments.incoming.assign.recap.payment')).toHaveTextContent('TX-15');
    expect(screen.getByTestId('admin.payments.incoming.assign.impact')).toHaveTextContent('payments.incoming.assign.impact.estimated_extension');

    await waitFor(() => expect(screen.getByTestId('admin.payments.incoming.assign.submit')).toBeEnabled());
    await userEvent.click(screen.getByTestId('admin.payments.incoming.assign.submit'));

    await waitFor(() => {
      expect(mocks.createUserPayment).toHaveBeenCalledWith({ incoming_payment: 15, user: 7 });
    });
    expect(mocks.chrome.trackActionState).toHaveBeenCalledWith(909);
    expect(mocks.updateIncomingPaymentState).not.toHaveBeenCalled();
    expect(mocks.pushToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'ok' }));
  });
});

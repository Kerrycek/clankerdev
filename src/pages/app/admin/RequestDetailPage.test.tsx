import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HaveApiError } from '../../../lib/api/haveapi';
import {
  fetchChangeRequest,
  fetchRegistrationRequest,
  type RegistrationRequest,
} from '../../../lib/api/requests';
import { fetchUser } from '../../../lib/api/users';
import { RequestDetailPage } from './RequestDetailPage';

vi.mock('../../../app/appMode', () => ({
  useAppMode: () => ({ mode: 'admin', basePath: '/admin' }),
}));

vi.mock('../../../app/auth', () => ({
  useAuth: () => ({ role: 'admin' }),
}));

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

vi.mock('../../../lib/api/requests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api/requests')>();
  return {
    ...actual,
    fetchRegistrationRequest: vi.fn(),
    fetchChangeRequest: vi.fn(),
  };
});

vi.mock('../../../lib/api/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api/users')>();
  return {
    ...actual,
    fetchUser: vi.fn(),
  };
});

vi.mock('./RequestAddressMapLink', () => ({
  RequestAddressMapLink: () => null,
}));

vi.mock('./RequestFraudChecks', () => ({
  RequestFraudChecks: () => null,
  RequestFraudSummary: () => null,
}));

vi.mock('./RequestReviewActions', () => ({
  requestOperationalLinks: () => ({
    actionStateId: null,
    transactionChainId: null,
    transactionId: null,
  }),
  RequestOperationalLinks: () => null,
  RequestReviewActions: () => <div data-testid="resolution-controls" />,
}));

const registrationMock = vi.mocked(fetchRegistrationRequest);
const changeMock = vi.mocked(fetchChangeRequest);
const userMock = vi.mocked(fetchUser);

function registration(id: number): RegistrationRequest {
  return {
    id,
    type: 'registration',
    state: 'awaiting',
    login: 'alice',
    full_name: 'Alice Example',
  };
}

function renderDetail(initialEntry: InitialEntry) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const router = createMemoryRouter([
    { path: '/admin/requests', element: <div data-testid="requests-overview" /> },
    { path: '/admin/requests/:type/:requestId', element: <RequestDetailPage /> },
  ], { initialEntries: [initialEntry] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { queryClient, router };
}

describe('RequestDetailPage recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMock.mockRejectedValue(new Error('Current user unavailable'));
  });

  it('refetches a transient detail failure in place and preserves the queue context', async () => {
    const user = userEvent.setup();
    registrationMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ data: registration(172) } as never);
    const { router } = renderDetail(
      '/admin/requests/registration/172?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored%26type%3Dregistration',
    );

    const error = await screen.findByTestId('admin.requests.detail.error');
    expect(within(error).getByTestId('admin.requests.detail.error.back')).toHaveAttribute(
      'href',
      '/admin/requests?state=ignored&type=registration',
    );
    expect(screen.queryByTestId('resolution-controls')).not.toBeInTheDocument();

    await user.click(within(error).getByTestId('admin.requests.detail.error.retry'));

    expect(await screen.findByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByTestId('resolution-controls')).toBeInTheDocument();
    expect(registrationMock).toHaveBeenCalledTimes(2);
    expect(changeMock).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/admin/requests/registration/172');
    expect(router.state.location.search).toContain('returnTo=');
  });

  it.each([
    ['/admin/requests/registration/173', '/admin/requests'],
    [
      '/admin/requests/registration/173?returnTo=https%3A%2F%2Fevil.example%2Fadmin%2Frequests',
      '/admin/requests',
    ],
  ])('uses a safe overview Back target for %s', async (initialEntry, expectedBack) => {
    registrationMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderDetail(initialEntry);

    const error = await screen.findByTestId('admin.requests.detail.error');
    expect(within(error).getByTestId('admin.requests.detail.error.back')).toHaveAttribute('href', expectedBack);
  });

  it.each([
    ['wrong id', { ...registration(175), id: 999 }],
    ['wrong type', { id: 175, type: 'change', state: 'awaiting', change_reason: 'Move' }],
  ])('fails closed for a definitive %s response', async (_label, response) => {
    registrationMock.mockResolvedValue({ data: response } as never);
    renderDetail('/admin/requests/registration/175?returnTo=%2Fadmin%2Frequests%3Fstate%3Dawaiting');

    const mismatch = await screen.findByTestId('admin.requests.detail.mismatch');
    expect(within(mismatch).getByTestId('admin.requests.detail.mismatch.primary')).toHaveAttribute(
      'href',
      '/admin/requests?state=awaiting',
    );
    expect(within(mismatch).queryByTestId('admin.requests.detail.mismatch.retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resolution-controls')).not.toBeInTheDocument();
    expect(registrationMock).toHaveBeenCalledTimes(1);
    expect(changeMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'HTTP 404',
      new HaveApiError({ status: false, message: 'Missing request' }, 'HTTP 404', 404),
    ],
    [
      'legacy HTTP 200 envelope',
      new HaveApiError({ status: false, message: 'Request not found' }),
    ],
  ])('offers only a safe overview return for an exact %s', async (_label, error) => {
    registrationMock.mockRejectedValue(error);
    renderDetail('/admin/requests/registration/176?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored');

    const missing = await screen.findByTestId('admin.requests.detail.not_found');
    expect(within(missing).getByTestId('admin.requests.detail.not_found.primary')).toHaveAttribute(
      'href',
      '/admin/requests?state=ignored',
    );
    expect(within(missing).queryByTestId('admin.requests.detail.not_found.retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resolution-controls')).not.toBeInTheDocument();
    expect(registrationMock).toHaveBeenCalledTimes(1);
  });

  it('does not query or expose resolution controls for an invalid typed URL', async () => {
    renderDetail('/admin/requests/unknown/not-an-id?returnTo=https%3A%2F%2Fevil.example');

    const invalid = await screen.findByTestId('admin.requests.detail.invalid');
    expect(within(invalid).getByTestId('admin.requests.detail.invalid.primary')).toHaveAttribute(
      'href',
      '/admin/requests',
    );
    expect(registrationMock).not.toHaveBeenCalled();
    expect(changeMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('resolution-controls')).not.toBeInTheDocument();
  });

  it('navigates Back to the sanitized queue instead of browser history', async () => {
    const user = userEvent.setup();
    registrationMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { router } = renderDetail({
      pathname: '/admin/requests/registration/177',
      search: '?returnTo=%2Fadmin%2Frequests%3Fstate%3Dpending_correction',
    });

    const error = await screen.findByTestId('admin.requests.detail.error');
    await user.click(within(error).getByTestId('admin.requests.detail.error.back'));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/requests');
      expect(router.state.location.search).toBe('?state=pending_correction');
    });
    expect(screen.getByTestId('requests-overview')).toBeInTheDocument();
  });
});

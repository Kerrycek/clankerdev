import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestReviewActions } from './RequestReviewActions';
import { fetchReviewTarget, resolveReviewedRequest } from './RequestResolveMutation';

const acquireLocalLock = vi.fn();
const settleLocalLock = vi.fn();
const trackActionState = vi.fn();
const pushToast = vi.fn();

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../app/toasts', () => ({
  useToasts: () => ({ pushToast }),
}));

vi.mock('../../../components/layout/ChromeContext', () => ({
  useChrome: () => ({
    localLocks: [],
    acquireLocalLock,
    settleLocalLock,
    trackActionState,
    openTasks: vi.fn(),
  }),
}));

vi.mock('./RequestResolveMutation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./RequestResolveMutation')>();
  return {
    ...actual,
    fetchReviewTarget: vi.fn(),
    resolveReviewedRequest: vi.fn(),
  };
});

vi.mock('./RequestResolveResources', () => ({
  useRequestResolveResources: () => ({
    nodes: [],
    locations: [],
    templates: [],
    languages: [],
    nodeResourcesLoading: false,
    nodeResourcesError: false,
    overrideResourcesLoading: false,
    overrideResourcesError: false,
    retryNodeResources: vi.fn(),
    retryOverrideResources: vi.fn(),
  }),
}));

const fetchTargetMock = vi.mocked(fetchReviewTarget);
const resolveMock = vi.mocked(resolveReviewedRequest);

describe('RequestReviewActions behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquireLocalLock.mockResolvedValue(1);
    fetchTargetMock.mockResolvedValue({ id: 19327, state: 'awaiting' } as never);
    resolveMock.mockResolvedValue({ data: {}, meta: {} } as never);
  });

  it('closes an ignored request immediately without opening the resolution dialog', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RequestReviewActions
          request={{ id: 19327, type: 'registration', state: 'awaiting', login: 'o12i' }}
          reqType="registration"
          reqId={19327}
          isAdmin
          basePath="/admin"
          testIdPrefix="request"
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByTestId('request.action.ignore'));

    expect(screen.queryByTestId('request.modal')).not.toBeInTheDocument();
    await waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(1));
    expect(resolveMock).toHaveBeenCalledWith(
      'registration',
      19327,
      'ignore',
      expect.objectContaining({ reason: undefined, approveCreateVps: false, approveActivate: false }),
    );
    expect(fetchTargetMock).toHaveBeenCalledWith('registration', 19327, 'awaiting');
    expect(acquireLocalLock).toHaveBeenCalledTimes(1);
  });
  it.each(['cs', 'en'] as const)('submits a complete %s rejection preset without requiring added detail', async (language) => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}>
      <RequestReviewActions request={{ id: 19327, type: 'registration', state: 'awaiting', language: { code: language } }}
        reqType="registration" reqId={19327} isAdmin basePath="/admin" testIdPrefix="request" />
    </QueryClientProvider>);
    await user.click(screen.getByTestId('request.action.deny'));
    expect(screen.getByTestId('request.submit')).toBeDisabled();
    await user.selectOptions(screen.getByTestId('request.reason_preset'), 'application_incorrect');
    const expected = language === 'cs'
      ? 'Přihlášku zamítáme, protože není korektně vyplněná.'
      : 'We are rejecting your application because it has not been filled in correctly.';
    expect(screen.getByTestId('request.reason')).toHaveValue(expected);
    await user.click(screen.getByTestId('request.submit'));
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('registration', 19327, 'deny', expect.objectContaining({ reason: expected })));
  });

  it('preserves custom text and clears a preset when the dialog is reopened for another action', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}>
      <RequestReviewActions request={{ id: 19327, type: 'registration', state: 'awaiting', language: { id: 57, code: 'en' }, year_of_birth: 1990, os_template: { id: 5 }, location: { id: 7 } }}
        reqType="registration" reqId={19327} isAdmin basePath="/admin" testIdPrefix="request" />
    </QueryClientProvider>);
    await user.click(screen.getByTestId('request.action.deny'));
    await user.selectOptions(screen.getByTestId('request.reason_preset'), 'duplicate_application');
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    await user.click(screen.getByTestId('request.action.request_correction'));
    expect(screen.getByTestId('request.reason_preset')).toHaveValue('');
    expect(screen.getByTestId('request.reason')).toHaveValue('');
    await user.selectOptions(screen.getByTestId('request.reason_preset'), 'address_unverified');
    await user.clear(screen.getByTestId('request.reason'));
    await user.type(screen.getByTestId('request.reason'), 'Please mark your house on the map.');
    expect(screen.getByTestId('request.reason_preset')).toHaveValue('');
    await user.click(screen.getByTestId('request.submit'));
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('registration', 19327, 'request_correction', expect.objectContaining({ reason: 'Please mark your house on the map.' })));
  });

});

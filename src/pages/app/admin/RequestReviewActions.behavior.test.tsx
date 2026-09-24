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
});

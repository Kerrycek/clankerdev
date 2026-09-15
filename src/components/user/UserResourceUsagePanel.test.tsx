// i18n-ignore-file

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchUserClusterResources } from '../../lib/api/clusterResources';
import { UserResourceUsagePanel } from './UserResourceUsagePanel';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../lib/api/clusterResources', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/clusterResources')>();
  return {
    ...actual,
    fetchUserClusterResources: vi.fn(),
  };
});

const resourcesMock = vi.mocked(fetchUserClusterResources);

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserResourceUsagePanel userId={53} testIdPrefix="usage" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserResourceUsagePanel', () => {
  beforeEach(() => {
    resourcesMock.mockReset();
  });

  it('distinguishes a load failure from an empty result and retries in place', async () => {
    const user = userEvent.setup();
    resourcesMock
      .mockRejectedValueOnce(new Error('Resource API unavailable'))
      .mockResolvedValueOnce({
        data: [
          {
            id: 31,
            environment: { id: 7, label: 'Production' },
            cluster_resource: { id: 2, name: 'cpu', label: 'CPU' },
            value: 4,
            used: 2,
            free: 2,
          },
        ],
      } as never);

    renderPanel();

    const error = await screen.findByTestId('usage.error');
    expect(error).toHaveTextContent('error.unexpected.title');
    expect(screen.getByTestId('usage.error.details')).toHaveTextContent('Resource API unavailable');
    expect(screen.queryByTestId('usage.empty')).not.toBeInTheDocument();
    expect(screen.queryByText('admin.user.resource_usage.empty.title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage.error.back')).not.toBeInTheDocument();
    expect(screen.queryByTestId('usage.error.status')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('usage.error.retry'));

    expect(await screen.findByTestId('usage.environment.7.resource.31')).toHaveTextContent('CPU');
    await waitFor(() => expect(error).not.toBeInTheDocument());
    expect(resourcesMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a successful empty response as the legitimate empty state', async () => {
    resourcesMock.mockResolvedValue({ data: [] } as never);

    renderPanel();

    expect(await screen.findByTestId('usage.empty')).toHaveTextContent(
      'admin.user.resource_usage.empty.title',
    );
    expect(screen.queryByTestId('usage.error')).not.toBeInTheDocument();
    expect(resourcesMock).toHaveBeenCalledTimes(1);
  });
});

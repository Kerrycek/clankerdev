import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  Dataset,
  DatasetInPoolPlan,
  EnvironmentDatasetPlan,
} from '../../../lib/api/datasets';
import { DatasetContextProvider } from './DatasetContext';
import { DatasetPlansPage } from './DatasetPlansPage';

const testState = vi.hoisted(() => ({
  mode: 'user' as 'user' | 'admin',
}));

const api = vi.hoisted(() => ({
  fetchDatasetPlans: vi.fn(),
  fetchEnvironmentDatasetPlans: vi.fn(),
  assignDatasetPlan: vi.fn(),
  deleteDatasetPlan: vi.fn(),
  fetchTransactionChains: vi.fn(),
}));

const chrome = vi.hoisted(() => ({
  acquireLocalLock: vi.fn(),
  releaseLocalLock: vi.fn(),
}));

vi.mock('../../../app/appMode', () => ({
  useAppMode: () => ({
    mode: testState.mode,
    basePath: testState.mode === 'admin' ? '/admin' : '/app',
  }),
}));

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'common.na': 'N/A',
        'dataset.plans.column.source': 'Source plan',
        'dataset.plans.description.fallback': 'No description is available for this plan.',
        'dataset.plans.remove.not_allowed': 'Removal restricted',
      };
      let value = messages[key] ?? key;
      for (const [name, replacement] of Object.entries(vars ?? {})) {
        value = value.replace(`{${name}}`, String(replacement));
      }
      return value;
    },
  }),
}));

vi.mock('../../../app/toasts', () => ({
  useToasts: () => ({ pushToast: vi.fn() }),
}));

vi.mock('../../../components/layout/ChromeContext', () => ({
  useChrome: () => chrome,
}));

vi.mock('../../../lib/api/datasets', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api/datasets')>();
  return {
    ...original,
    fetchDatasetPlans: api.fetchDatasetPlans,
    fetchEnvironmentDatasetPlans: api.fetchEnvironmentDatasetPlans,
    assignDatasetPlan: api.assignDatasetPlan,
    deleteDatasetPlan: api.deleteDatasetPlan,
  };
});

vi.mock('../../../lib/api/transactions', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api/transactions')>();
  return {
    ...original,
    fetchTransactionChains: api.fetchTransactionChains,
  };
});

const assignedPlans: DatasetInPoolPlan[] = [
  {
    id: 21,
    environment_dataset_plan: {
      id: 11,
      label: 'Daily backup',
      dataset_plan: {
        id: 101,
        label: 'daily_backup',
        description: 'Takes a snapshot every night and keeps seven restore points.',
      },
      user_add: true,
      user_remove: false,
    },
  },
  {
    id: 22,
    environment_dataset_plan: {
      id: 12,
      label: 'Weekly archive',
      user_add: true,
      user_remove: true,
    },
  },
  {
    id: 23,
    environment_dataset_plan: {
      id: 15,
      label: 'Whitespace description',
      dataset_plan: { id: 105, label: 'whitespace_description', description: '  \n  ' },
      user_add: true,
      user_remove: true,
    },
  },
  {
    id: 24,
    environment_dataset_plan: {
      id: 16,
      label: 'Null description',
      dataset_plan: { id: 106, label: 'null_description', description: null },
      user_add: true,
      user_remove: true,
    },
  },
  {
    id: 25,
  },
];

const availablePlans: EnvironmentDatasetPlan[] = [
  {
    id: 13,
    label: 'Remote copy',
    dataset_plan: {
      id: 103,
      label: 'remote_copy',
      description: 'Copies the dataset to backup storage every six hours.',
    },
    user_add: true,
    user_remove: true,
  },
  {
    id: 14,
    label: 'Operator archive',
    dataset_plan: {
      id: 104,
      label: 'operator_archive',
      description: 'Archives the dataset according to the operator policy.',
    },
    user_add: false,
    user_remove: false,
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const dataset = {
    id: 10,
    name: 'root',
    full_name: 'mail.example/root',
    object_state: 'active',
    environment: { id: 7, label: 'Production' },
    user: { id: 1, login: 'backup-user' },
  } satisfies Dataset;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DatasetContextProvider
          value={{
            dataset,
            refetch: vi.fn(async () => undefined),
            section: 'datasets',
            listPath: '/datasets',
            returnPath: '/datasets',
            detailPath: '/datasets/10',
            datasetRef: { kind: 'Dataset', id: 10 },
            busyLocalLock: false,
            chains: [],
            chainsLoading: false,
            chainsError: null,
            busyTransaction: false,
            chainsStale: false,
            activeChainIds: [],
            refetchChains: vi.fn(async () => undefined),
          }}
        >
          <DatasetPlansPage />
        </DatasetContextProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.mode = 'user';
  api.fetchDatasetPlans.mockResolvedValue({ data: assignedPlans, meta: { total_count: 5 } });
  api.fetchEnvironmentDatasetPlans.mockResolvedValue({
    data: availablePlans,
    meta: { total_count: 2 },
  });
  api.fetchTransactionChains.mockResolvedValue({ data: [], meta: { total_count: 0 } });
  api.assignDatasetPlan.mockResolvedValue({ data: { id: 23 }, meta: {} });
  api.deleteDatasetPlan.mockResolvedValue({ data: undefined, meta: {} });
});

describe('DatasetPlansPage', () => {
  it('requests nested plan details and renders descriptions with a safe fallback', async () => {
    renderPage();

    expect(await screen.findByTestId('dataset.plans.row.21.description')).toHaveTextContent(
      'Takes a snapshot every night and keeps seven restore points.'
    );
    expect(screen.getByTestId('dataset.plans.row.22.description')).toHaveTextContent(
      'No description is available for this plan.'
    );
    expect(screen.getByTestId('dataset.plans.row.22.source')).toHaveTextContent('Source plan: N/A');
    expect(screen.getByTestId('dataset.plans.row.23.description')).toHaveTextContent(
      'No description is available for this plan.'
    );
    expect(screen.getByTestId('dataset.plans.row.24.description')).toHaveTextContent(
      'No description is available for this plan.'
    );
    expect(screen.getByTestId('dataset.plans.row.21.source')).toHaveTextContent(
      'Source plan: daily_backup'
    );
    expect(api.fetchDatasetPlans).toHaveBeenCalledWith(10, {
      limit: 200,
      includes: 'environment_dataset_plan__dataset_plan',
    });
    expect(api.fetchEnvironmentDatasetPlans).toHaveBeenCalledWith(7, {
      limit: 200,
      includes: 'dataset_plan',
    });
  });

  it('keeps regular-user add/remove permissions and previews the selected description', async () => {
    const user = userEvent.setup();
    renderPage();

    const lockedRow = await screen.findByTestId('dataset.plans.row.21');
    expect(within(lockedRow).queryByTestId('dataset.plans.row.21.remove')).not.toBeInTheDocument();
    expect(within(lockedRow).getByText('Removal restricted')).toBeVisible();
    expect(screen.getByTestId('dataset.plans.row.22.remove')).toBeEnabled();
    expect(screen.queryByTestId('dataset.plans.row.25.remove')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('dataset.plans.assign.open'));
    const select = screen.getByTestId('dataset.plans.assign.select');
    expect(within(select).getByRole('option', { name: 'Remote copy' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Operator archive' })).not.toBeInTheDocument();

    await user.selectOptions(select, '13');
    expect(screen.getByTestId('dataset.plans.assign.preview.description')).toHaveTextContent(
      'Copies the dataset to backup storage every six hours.'
    );
    expect(screen.getByTestId('dataset.plans.assign.preview.source')).toHaveTextContent(
      'Source plan: remote_copy'
    );

    await user.click(screen.getByTestId('dataset.plans.assign.submit'));
    await waitFor(() =>
      expect(api.assignDatasetPlan).toHaveBeenCalledWith(10, {
        environment_dataset_plan: 13,
      })
    );
  });

  it('removes the assigned row id rather than an environment or base-plan id', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('dataset.plans.row.22.remove'));
    await user.click(screen.getByTestId('dataset.plans.remove.confirm.confirm'));

    await waitFor(() => expect(api.deleteDatasetPlan).toHaveBeenCalledWith(10, 22));
  });

  it('keeps a failed assignment in its modal and allows retry', async () => {
    const user = userEvent.setup();
    api.assignDatasetPlan
      .mockRejectedValueOnce(new Error('Assignment rejected'))
      .mockResolvedValueOnce({ data: { id: 23 }, meta: {} });
    renderPage();

    await user.click(await screen.findByTestId('dataset.plans.assign.open'));
    await user.selectOptions(screen.getByTestId('dataset.plans.assign.select'), '13');
    await user.click(screen.getByTestId('dataset.plans.assign.submit'));

    expect(await screen.findByTestId('dataset.plans.assign.error')).toHaveTextContent('Assignment rejected');
    expect(screen.getByTestId('dataset.plans.assign.select')).toHaveValue('13');

    await user.click(screen.getByTestId('dataset.plans.assign.submit'));
    await waitFor(() => expect(screen.queryByTestId('dataset.plans.assign.modal')).not.toBeInTheDocument());
    expect(api.assignDatasetPlan).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed removal in its confirmation and allows retry', async () => {
    const user = userEvent.setup();
    api.deleteDatasetPlan
      .mockRejectedValueOnce(new Error('Removal rejected'))
      .mockResolvedValueOnce({ data: undefined, meta: {} });
    renderPage();

    await user.click(await screen.findByTestId('dataset.plans.row.22.remove'));
    await user.click(screen.getByTestId('dataset.plans.remove.confirm.confirm'));

    expect(await screen.findByTestId('dataset.plans.remove.error')).toHaveTextContent('Removal rejected');

    await user.click(screen.getByTestId('dataset.plans.remove.confirm.confirm'));
    await waitFor(() => expect(screen.queryByTestId('dataset.plans.remove.confirm')).not.toBeInTheDocument());
    expect(api.deleteDatasetPlan).toHaveBeenCalledTimes(2);
  });

  it('lets an administrator manage plans whose user permission flags are disabled', async () => {
    const user = userEvent.setup();
    testState.mode = 'admin';
    renderPage();

    expect(await screen.findByTestId('dataset.plans.row.21.remove')).toBeEnabled();
    await user.click(screen.getByTestId('dataset.plans.assign.open'));
    const select = screen.getByTestId('dataset.plans.assign.select');
    expect(within(select).getByRole('option', { name: 'Operator archive' })).toBeInTheDocument();

    await user.selectOptions(select, '14');
    expect(screen.getByTestId('dataset.plans.assign.preview.description')).toHaveTextContent(
      'Archives the dataset according to the operator policy.'
    );
  });
});

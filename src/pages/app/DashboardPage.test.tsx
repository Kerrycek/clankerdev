import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDatasets } from '../../lib/api/datasets';
import { fetchDnsZones } from '../../lib/api/dns';
import { fetchOutages, fetchPublicNodeStatus } from '../../lib/api/public';
import { fetchActiveTransactionChains } from '../../lib/api/transactions';
import { fetchVpsList } from '../../lib/api/vps';
import { DashboardPage } from './DashboardPage';

vi.mock('../../app/auth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: { id: 1, login: 'alice', level: 3 },
    role: 'user',
    canUseAdminUi: false,
    loginUrl: '/oauth/login',
    logoutUrl: '/oauth/logout',
  }),
}));

vi.mock('../../app/appMode', () => ({
  useAppMode: () => ({ mode: 'user', basePath: '/app' }),
}));

vi.mock('../../app/objectScope', () => ({
  useObjectScope: () => ({ scope: 'mine', mineUserId: undefined, canSwitchScope: false }),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (!vars) return key;
      return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key);
    },
    tc: (key: string, count: number) => `${key}:${count}`,
    preferredLanguageCodes: ['en', 'cs'],
  }),
}));

vi.mock('../../lib/api/datasets', () => ({
  fetchDatasets: vi.fn(),
}));

vi.mock('../../lib/api/dns', () => ({
  fetchDnsZones: vi.fn(),
}));

vi.mock('../../lib/api/public', () => ({
  fetchOutages: vi.fn(),
  fetchPublicNodeStatus: vi.fn(),
}));

vi.mock('../../lib/api/transactions', () => ({
  fetchActiveTransactionChains: vi.fn(),
}));

vi.mock('../../lib/api/vps', () => ({
  fetchVpsList: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/" element={<div data-testid="public.status.route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('summarizes public outages and node health in the dashboard triage panel', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue({
      data: [{ id: 1, is_running: true }],
      meta: { total_count: 1 },
    } as LegacyAny);
    vi.mocked(fetchDatasets).mockResolvedValue({ data: [], meta: { total_count: 0 } } as LegacyAny);
    vi.mocked(fetchDnsZones).mockResolvedValue({ data: [], meta: { total_count: 0 } } as LegacyAny);
    vi.mocked(fetchActiveTransactionChains).mockResolvedValue([] as LegacyAny);
    vi.mocked(fetchPublicNodeStatus).mockResolvedValue({
      data: [
        { name: 'node-ok', status: true },
        { name: 'node-down', status: false },
      ],
    } as LegacyAny);
    vi.mocked(fetchOutages).mockResolvedValue({
      data: [
        {
          id: 3,
          begins_at: '2000-01-01T00:00:00Z',
          en_summary: 'Ongoing maintenance',
        },
      ],
    } as LegacyAny);

    renderPage();

    expect(await screen.findByTestId('app.dashboard.page')).toBeVisible();
    expect(await screen.findByTestId('app.dashboard.status-triage')).toBeVisible();
    expect(screen.getByText('dashboard.status.attention.title')).toBeVisible();
    expect(screen.getByText('dashboard.status.outages:1')).toBeVisible();
    expect(screen.getByText('dashboard.status.nodes')).toBeVisible();
  });
});

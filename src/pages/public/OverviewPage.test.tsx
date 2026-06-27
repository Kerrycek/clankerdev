import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchNews,
  fetchOutages,
  fetchPublicNodeStatus,
  fetchPublicStats,
} from '../../lib/api/public';
import { fetchSecurityAdvisoriesWithCves } from '../../lib/api/securityAdvisories';
import { OverviewPage } from './OverviewPage';

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

vi.mock('../../lib/api/public', () => ({
  fetchNews: vi.fn(),
  fetchOutages: vi.fn(),
  fetchPublicNodeStatus: vi.fn(),
  fetchPublicStats: vi.fn(),
}));

vi.mock('../../lib/api/securityAdvisories', () => ({
  advisoryCveLabels: vi.fn(() => []),
  fetchSecurityAdvisoriesWithCves: vi.fn(),
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
      <MemoryRouter basename="/ui-next" initialEntries={['/ui-next/']}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/outages/:outageId" element={<div data-testid="outage.detail.route" />} />
          <Route path="/outages" element={<div data-testid="outages.route" />} />
          <Route path="/news" element={<div data-testid="news.route" />} />
          <Route path="/security-advisories" element={<div data-testid="security.route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockBaseResponses() {
  vi.mocked(fetchPublicStats).mockResolvedValue({
    data: {
      user_count: 42,
      vps_count: 120,
      ipv4_left: 128,
    },
  } as LegacyAny);
  vi.mocked(fetchOutages).mockResolvedValue({ data: [] } as LegacyAny);
  vi.mocked(fetchNews).mockResolvedValue({ data: [] } as LegacyAny);
  vi.mocked(fetchSecurityAdvisoriesWithCves).mockResolvedValue({ data: [] } as LegacyAny);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('OverviewPage', () => {
  it('renders public nodes grouped by location and expands groups with down nodes', async () => {
    mockBaseResponses();
    vi.mocked(fetchPublicNodeStatus).mockResolvedValue({
      data: [
        {
          name: 'node-ok',
          fqdn: 'node-ok.example.test',
          status: true,
          location: { label: 'Praha' },
          last_report: '2026-06-24T12:00:00Z',
          vps_count: 12,
          vps_free: 3,
          cpu_idle: 88,
        },
        {
          name: 'node-down',
          status: false,
          location: { label: 'Brno' },
          last_report: '2026-06-24T12:05:00Z',
          vps_count: 9,
          vps_free: 1,
          cpu_idle: 12,
        },
      ],
    } as LegacyAny);

    renderPage();

    expect(await screen.findByTestId('public.overview.page')).toBeVisible();
    expect(await screen.findByTestId('public.nodes.section')).toBeVisible();
    expect(screen.getByText('node-ok')).toBeInTheDocument();
    expect(screen.getByText('node-down')).toBeInTheDocument();

    const problemGroup = screen.getByText('Brno').closest('details');
    expect(problemGroup).not.toBeNull();
    expect(problemGroup).toHaveAttribute('open');
    expect(fetchPublicNodeStatus).toHaveBeenCalledTimes(1);
  });
});

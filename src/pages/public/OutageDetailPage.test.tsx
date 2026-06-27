// i18n-ignore-file

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchOutage,
  fetchOutageEntities,
  fetchOutageHandlers,
  fetchOutageUpdates,
} from '../../lib/api/public';
import { OutageDetailPage } from './OutageDetailPage';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tc: (key: string, count: number) => `${key}:${count}`,
    preferredLanguageCodes: ['en', 'cs'],
  }),
}));

vi.mock('../../lib/api/public', () => ({
  fetchOutage: vi.fn(),
  fetchOutageEntities: vi.fn(),
  fetchOutageHandlers: vi.fn(),
  fetchOutageUpdates: vi.fn(),
}));

function renderPage(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter basename="/ui-next" initialEntries={[`/ui-next${pathname}`]}>
        <Routes>
          <Route path="/outages/:outageId" element={<OutageDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('OutageDetailPage', () => {
  it('renders outage detail sections and a basename-aware back link', async () => {
    vi.mocked(fetchOutage).mockResolvedValue({
      data: {
        id: 42,
        begins_at: '2026-01-05T12:00:00Z',
        state: 'announced',
        type: 'outage',
        impact: 'network',
        en_summary: 'Major outage',
        en_description: 'The storage backend is degraded.',
      },
    } as LegacyAny);
    vi.mocked(fetchOutageEntities).mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Node',
          label: 'Node node1.example.test',
          entity_id: 99,
        },
      ],
    } as LegacyAny);
    vi.mocked(fetchOutageHandlers).mockResolvedValue({
      data: [
        {
          id: 2,
          full_name: 'Ops Admin',
          note: 'Working on it',
        },
      ],
    } as LegacyAny);
    vi.mocked(fetchOutageUpdates).mockResolvedValue({
      data: [
        {
          id: 10,
          created_at: '2026-01-05T13:00:00Z',
          state: 'announced',
          reporter_name: 'Ops Admin',
          en_summary: 'Investigation ongoing',
          en_description: 'We are checking storage.',
        },
      ],
    } as LegacyAny);

    renderPage('/outages/42');

    expect(await screen.findByTestId('public.outage_detail.page')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Major outage' })).toBeVisible();
    expect(screen.getByRole('link', { name: /public.outage_detail.back_to_outages/i })).toHaveAttribute(
      'href',
      '/ui-next/outages',
    );
    const entityMatches = await screen.findAllByText(
      (_, node) => node?.textContent?.includes('Node node1.example.test') ?? false,
    );

    expect(entityMatches.length).toBeGreaterThan(0);
    expect(await screen.findByText('Working on it')).toBeVisible();
    expect(await screen.findByText('Investigation ongoing')).toBeVisible();

    expect(fetchOutage).toHaveBeenCalledWith(42);
    expect(fetchOutageEntities).toHaveBeenCalledWith(42);
    expect(fetchOutageHandlers).toHaveBeenCalledWith(42);
    expect(fetchOutageUpdates).toHaveBeenCalledWith(42);
  });

  it('shows invalid-id state without issuing API calls', async () => {
    renderPage('/outages/not-a-number');

    expect(await screen.findByText('public.outage_detail.invalid_id.title')).toBeVisible();
    expect(fetchOutage).not.toHaveBeenCalled();
    expect(fetchOutageEntities).not.toHaveBeenCalled();
    expect(fetchOutageHandlers).not.toHaveBeenCalled();
    expect(fetchOutageUpdates).not.toHaveBeenCalled();
  });
});

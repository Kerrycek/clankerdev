// i18n-ignore-file

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOutages } from '../../lib/api/public';
import { OutagesPage } from './OutagesPage';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tc: (key: string, count: number) => `${key}:${count}`,
    preferredLanguageCodes: ['en', 'cs'],
  }),
}));

vi.mock('../../lib/api/public', () => ({
  fetchOutages: vi.fn(),
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
      <MemoryRouter basename="/ui-next" initialEntries={['/ui-next/outages']}>
        <Routes>
          <Route path="/outages" element={<OutagesPage />} />
          <Route path="/outages/:outageId" element={<div data-testid="outage.detail.route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('OutagesPage', () => {
  it('renders outage summaries and basename-aware detail links', async () => {
    vi.mocked(fetchOutages).mockResolvedValue({
      data: [
        {
          id: 7,
          begins_at: '2026-01-05T12:00:00Z',
          state: 'announced',
          type: 'outage',
          impact: 'network',
          en_summary: 'Database maintenance',
        },
      ],
    } as any);

    renderPage();

    expect(await screen.findByTestId('public.outages.page')).toBeVisible();

    const summary = await screen.findByText('Database maintenance');
    const detailLink = summary.closest('a');

    expect(detailLink).not.toBeNull();
    expect(detailLink).toHaveAttribute('href', '/ui-next/outages/7');
    expect(fetchOutages).toHaveBeenCalledTimes(1);
  });
});

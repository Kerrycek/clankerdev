import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchNetworks } from '../../lib/api/networks';
import { filterNetworkLookupOptions, NetworkLookupInput } from './NetworkLookupInput';

vi.mock('../../lib/api/networks', () => ({
  fetchNetwork: vi.fn(),
  fetchNetworks: vi.fn(),
}));

const networks = [
  { id: 101, label: 'Public Prague', address: '192.0.2.0', prefix: 24 },
  { id: 102, label: 'Private Brno', address: '2001:db8::', prefix: 64 },
  { id: 210, label: 'Export', address: '198.51.100.0', prefix: 24 },
];

describe('NetworkLookupInput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    ['public', 101],
    ['PRAGUE', 101],
    ['192.0.2.0/24', 101],
    ['2001:db8', 102],
    ['#210', 210],
  ])('matches %s locally without pretending the API supports text search', (needle, id) => {
    expect(filterNetworkLookupOptions(networks, needle).map((network) => network.id)).toEqual([id]);
  });

  test('caps the locally-filtered menu', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ id: index + 1, label: `Shared ${index}` }));
    expect(filterNetworkLookupOptions(many, 'shared')).toHaveLength(25);
  });

  test('loads a bounded exact scope, filters it locally, and selects a match', async () => {
    vi.mocked(fetchNetworks).mockResolvedValue({
      data: networks,
      envelope: { status: true, response: {} },
    });
    const onChange = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <NetworkLookupInput
          value={null}
          onChange={onChange}
          purpose="vps"
          locationId={1}
          ariaLabel="Network"
          testId="network"
          noResultsLabel="No results"
        />
      </QueryClientProvider>
    );

    const input = screen.getByRole('textbox', { name: 'Network' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'prague' } });

    await waitFor(() =>
      expect(fetchNetworks).toHaveBeenCalledWith({ limit: 250, purpose: 'vps', locationId: 1 })
    );
    await waitFor(() => expect(screen.queryByTestId('network.opt.102')).not.toBeInTheDocument());
    expect(screen.getByTestId('network.opt.101')).toHaveTextContent('Public Prague');

    fireEvent.mouseDown(screen.getByTestId('network.opt.101'));
    fireEvent.click(screen.getByTestId('network.opt.101'));
    expect(onChange).toHaveBeenCalledWith(101);
    expect(fetchNetworks).toHaveBeenCalledTimes(1);
  });
});

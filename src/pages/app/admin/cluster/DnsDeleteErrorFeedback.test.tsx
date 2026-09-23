// i18n-ignore-file

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteDnsServer,
  deleteDnsTsigKey,
  fetchDnsServers,
  fetchDnsTsigKeys,
} from '../../../../lib/api/dns';
import { fetchNodes } from '../../../../lib/api/nodes';
import { DnsServersPage } from './DnsServersPage';
import { DnsTsigKeysPage } from './DnsTsigKeysPage';

const pushToast = vi.fn();

vi.mock('../../../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../app/toasts', () => ({
  useToasts: () => ({ pushToast }),
}));

vi.mock('../../../../lib/api/dns', () => ({
  DNS_TSIG_ALGORITHMS: ['hmac-sha256'],
  createDnsServer: vi.fn(),
  createDnsTsigKey: vi.fn(),
  deleteDnsServer: vi.fn(),
  deleteDnsTsigKey: vi.fn(),
  fetchDnsServers: vi.fn(),
  fetchDnsTsigKeys: vi.fn(),
  updateDnsServer: vi.fn(),
}));

vi.mock('../../../../lib/api/nodes', () => ({
  fetchNodes: vi.fn(),
}));

function renderPage(page: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('admin DNS delete failure feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchNodes).mockResolvedValue({ data: [], meta: {} } as never);
    vi.mocked(fetchDnsServers).mockResolvedValue({
      data: [{
        id: 10,
        name: 'ns1.example.test',
        ipv4_addr: '192.0.2.10',
        ipv6_addr: null,
        node: { id: 2, domain_name: 'node2.example.test' },
        hidden: false,
        enable_user_dns_zones: true,
      }],
      meta: { total_count: 1 },
    } as never);
    vi.mocked(fetchDnsTsigKeys).mockResolvedValue({
      data: [{
        id: 20,
        name: 'transfer-key',
        algorithm: 'hmac-sha256',
        user: { id: 3, login: 'member' },
        created_at: '2026-09-21T12:00:00Z',
      }],
      meta: { total_count: 1 },
    } as never);
  });

  it('keeps a failed DNS server deletion in context and allows a retry', async () => {
    vi.mocked(deleteDnsServer)
      .mockRejectedValueOnce(new Error('DNS server is still in use'))
      .mockResolvedValueOnce({ data: null, meta: {} } as never);

    renderPage(<DnsServersPage />);

    fireEvent.click(await screen.findByTestId('admin.cluster.dns_servers.card.10.delete'));
    fireEvent.click(screen.getByTestId('admin.cluster.dns_servers.delete_confirm.confirm'));

    const error = await screen.findByTestId('admin.cluster.dns_servers.delete_error');
    expect(error).toBeVisible();
    expect(error).toHaveTextContent('DNS server is still in use');
    expect(screen.getByTestId('admin.cluster.dns_servers.delete_confirm')).toBeVisible();

    fireEvent.click(screen.getByTestId('admin.cluster.dns_servers.delete_confirm.confirm'));

    await waitFor(() => expect(screen.queryByTestId('admin.cluster.dns_servers.delete_confirm')).not.toBeInTheDocument());
    expect(deleteDnsServer).toHaveBeenCalledTimes(2);
    expect(deleteDnsServer).toHaveBeenNthCalledWith(1, 10);
    expect(deleteDnsServer).toHaveBeenNthCalledWith(2, 10);
  });

  it('keeps a failed TSIG key deletion in context and allows a retry', async () => {
    vi.mocked(deleteDnsTsigKey)
      .mockRejectedValueOnce(new Error('TSIG key is referenced by a zone'))
      .mockResolvedValueOnce({ data: null, meta: {} } as never);

    renderPage(<DnsTsigKeysPage />);

    fireEvent.click(await screen.findByTestId('admin.cluster.dns_tsig.card.20.delete'));
    fireEvent.click(screen.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm'));

    const error = await screen.findByTestId('admin.cluster.dns_tsig.delete_error');
    expect(error).toBeVisible();
    expect(error).toHaveTextContent('TSIG key is referenced by a zone');
    expect(screen.getByTestId('admin.cluster.dns_tsig.delete_confirm')).toBeVisible();

    fireEvent.click(screen.getByTestId('admin.cluster.dns_tsig.delete_confirm.confirm'));

    await waitFor(() => expect(screen.queryByTestId('admin.cluster.dns_tsig.delete_confirm')).not.toBeInTheDocument());
    expect(deleteDnsTsigKey).toHaveBeenCalledTimes(2);
    expect(deleteDnsTsigKey).toHaveBeenNthCalledWith(1, 20);
    expect(deleteDnsTsigKey).toHaveBeenNthCalledWith(2, 20);
  });
});

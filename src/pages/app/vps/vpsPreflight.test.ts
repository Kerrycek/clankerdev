import { describe, expect, it, vi } from 'vitest';

import { fetchTransactionChains } from '../../../lib/api/transactions';
import { preflightVpsNotBusy } from './vpsPreflight';

vi.mock('../../../lib/api/transactions', () => ({
  fetchTransactionChains: vi.fn(),
}));

const t = (key: any) => String(key);

describe('preflightVpsNotBusy', () => {
  it('allows an action when stale knownBusy is contradicted by finished backend chains', async () => {
    vi.mocked(fetchTransactionChains).mockResolvedValue({
      data: [
        { id: 65, state: 2 },
        { id: 53, state: 4 },
      ],
    } as any);

    await expect(preflightVpsNotBusy({ vpsId: 14, t, knownBusy: true })).resolves.toBeUndefined();
  });

  it('blocks an action when backend chains are still active', async () => {
    vi.mocked(fetchTransactionChains).mockResolvedValue({
      data: [{ id: 66, state: 1 }],
    } as any);

    await expect(preflightVpsNotBusy({ vpsId: 14, t, knownBusy: true })).rejects.toMatchObject({ code: 'BUSY' });
  });

  it('keeps the conservative busy result when knownBusy cannot be verified', async () => {
    vi.mocked(fetchTransactionChains).mockRejectedValue(new Error('offline'));

    await expect(preflightVpsNotBusy({ vpsId: 14, t, knownBusy: true })).rejects.toMatchObject({ code: 'BUSY' });
  });
});

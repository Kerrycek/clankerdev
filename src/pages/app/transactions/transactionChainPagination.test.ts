import { describe, expect, it } from 'vitest';

import type { TransactionChain } from '../../../lib/api/transactions';
import { mergeTransactionChainStreams, transactionChainPage } from './transactionChainPagination';

const chains = (...ids: number[]) => ids.map((id) => ({ id }) as TransactionChain);

describe('transaction chain pagination', () => {
  it.each([25, 50, 100])('disables Next for an exact terminal page at limit %i', (limit) => {
    const exactPage = chains(...Array.from({ length: limit }, (_, index) => limit - index));

    expect(transactionChainPage(exactPage, limit)).toEqual({
      rows: exactPage,
      hasMore: false,
      cursor: 1,
    });
  });

  it('keeps only visible rows and derives the cursor before the look-ahead row', () => {
    expect(transactionChainPage(chains(30, 29, 28, 27), 3)).toEqual({
      rows: chains(30, 29, 28),
      hasMore: true,
      cursor: 28,
    });
  });

  it('merges failed and fatal streams before retaining a global look-ahead row', () => {
    const merged = mergeTransactionChainStreams([chains(30, 27, 24, 21), chains(29, 28, 26, 25)], 4);

    expect(merged.map((chain) => chain.id)).toEqual([30, 29, 28, 27]);
    expect(transactionChainPage(merged, 3)).toMatchObject({ hasMore: true, cursor: 28 });
  });

  it('deduplicates merged streams without inventing a look-ahead row', () => {
    const merged = mergeTransactionChainStreams([chains(30, 29), chains(30, 28)], 4);

    expect(transactionChainPage(merged, 3)).toMatchObject({ hasMore: false, cursor: 28 });
  });
});

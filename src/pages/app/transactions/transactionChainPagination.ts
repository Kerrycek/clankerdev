import type { TransactionChain } from '../../../lib/api/transactions';
import { getChainId } from './transactionChainSemantics';

export interface TransactionChainPage {
  rows: TransactionChain[];
  hasMore: boolean;
  cursor: number | null;
}

export function transactionChainPage(chains: TransactionChain[] | undefined, limit: number): TransactionChainPage {
  const rows = (chains ?? []).slice(0, limit);

  return {
    rows,
    hasMore: (chains?.length ?? 0) > limit,
    cursor: rows.length > 0 ? getChainId(rows[rows.length - 1]!) || null : null,
  };
}

export function mergeTransactionChainStreams(
  streams: Array<TransactionChain[] | undefined>,
  lookaheadLimit: number
): TransactionChain[] {
  const byId = new Map<number, TransactionChain>();

  for (const chain of streams.flatMap((stream) => stream ?? [])) {
    const id = getChainId(chain);
    if (id > 0) byId.set(id, chain);
  }

  return [...byId.values()]
    .sort((a, b) => getChainId(b) - getChainId(a))
    .slice(0, lookaheadLimit);
}

import type { TransactionChain } from '../../../lib/api/transactions';
import { isFinishedChainState } from '../../../lib/taskStatus';

interface TransactionChainQuerySnapshot {
  state: {
    data?: TransactionChain;
  };
}

export function transactionChainRefetchInterval(
  query: TransactionChainQuerySnapshot,
  activeIntervalMs: number
): number | false {
  const chain = query.state.data;
  return chain && isFinishedChainState(chain.state) ? false : activeIntervalMs;
}

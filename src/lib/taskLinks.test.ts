import { describe, expect, it } from 'vitest';

import {
  extractRelatedActionStateIdFromTransactionChain,
  extractRelatedTransactionChainIdFromActionState,
} from './taskLinks';

describe('taskLinks', () => {
  it('extracts explicit transaction chain IDs from action states', () => {
    expect(extractRelatedTransactionChainIdFromActionState({ transaction_chain: { id: 123 } })).toBe(123);
    expect(extractRelatedTransactionChainIdFromActionState({ transactionChainId: '124' })).toBe(124);
    expect(extractRelatedTransactionChainIdFromActionState({ chain_id: 125 })).toBe(125);
  });

  it('extracts transaction chain IDs from nested transaction payloads', () => {
    expect(
      extractRelatedTransactionChainIdFromActionState({
        transactions: [{ id: 1, transaction_chain: { id: 222 } }],
      })
    ).toBe(222);
  });

  it('falls back to the action-state ID for vpsAdmin action-state wrappers', () => {
    expect(extractRelatedTransactionChainIdFromActionState({ id: 333, finished: false, current: 1, total: 2 })).toBe(333);
  });

  it('extracts action state IDs from transaction chains', () => {
    expect(extractRelatedActionStateIdFromTransactionChain({ action_state: { id: 456 } })).toBe(456);
    expect(extractRelatedActionStateIdFromTransactionChain({ action_state_id: '457' })).toBe(457);
  });
});

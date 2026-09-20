import { describe, expect, it } from 'vitest';

import { transactionChainRefetchInterval } from './transactionChainPolling';

const ACTIVE_INTERVAL_MS = 5_000;

describe('transactionChainRefetchInterval', () => {
  it.each(['done', 'failed', 'fatal', 'resolved', 'cancelled', 'canceled'])('stops polling for terminal state %s', (state) => {
    const query = { state: { data: { id: 1, state } } };

    expect(transactionChainRefetchInterval(query, ACTIVE_INTERVAL_MS)).toBe(false);
  });

  it.each(['staged', 'queued', 'running', 'rollbacking'])('continues polling for active state %s', (state) => {
    const query = { state: { data: { id: 1, state } } };

    expect(transactionChainRefetchInterval(query, ACTIVE_INTERVAL_MS)).toBe(ACTIVE_INTERVAL_MS);
  });

  it('continues polling until the first chain response arrives', () => {
    expect(transactionChainRefetchInterval({ state: {} }, ACTIVE_INTERVAL_MS)).toBe(ACTIVE_INTERVAL_MS);
  });
});

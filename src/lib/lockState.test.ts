import { describe, expect, it } from 'vitest';

import { deriveChainLockState, isDataStale } from './lockState';

describe('lockState', () => {
  it('does not treat data as stale when refresh is reliable', () => {
    const stale = isDataStale({ updatedAt: 0, unreliable: false, ttlMs: 1000, now: 10_000 });
    expect(stale).toBe(false);

    const stale2 = isDataStale({ updatedAt: 1, unreliable: false, ttlMs: 1000, now: 10_000 });
    expect(stale2).toBe(false);
  });

  it('treats data as stale only after TTL when refresh is unreliable', () => {
    expect(isDataStale({ updatedAt: 9_500, unreliable: true, ttlMs: 1000, now: 10_000 })).toBe(false);
    expect(isDataStale({ updatedAt: 9_000, unreliable: true, ttlMs: 1000, now: 10_000 })).toBe(false);
    expect(isDataStale({ updatedAt: 8_999, unreliable: true, ttlMs: 1000, now: 10_000 })).toBe(true);
  });

  it('keeps a busy lock within TTL even if the last refetch failed', () => {
    const state = deriveChainLockState({
      chains: [{ id: 123, state: 'running' } as any],
      updatedAt: 9_500,
      unreliable: true,
      ttlMs: 1000,
      now: 10_000,
    });

    expect(state.stale).toBe(false);
    expect(state.busy).toBe(true);
    expect(state.activeChainIds).toEqual([123]);
  });

  it('degrades and stops treating the object as busy after TTL expires', () => {
    const state = deriveChainLockState({
      chains: [{ id: 123, state: 'running' } as any],
      updatedAt: 8_000,
      unreliable: true,
      ttlMs: 1000,
      now: 10_000,
    });

    expect(state.stale).toBe(true);
    expect(state.busy).toBe(false);
    // We still return last known active chain ids for diagnostics.
    expect(state.activeChainIds).toEqual([123]);
  });

  it('returns active chain ids in descending order without duplicates', () => {
    const state = deriveChainLockState({
      chains: [
        { id: 5, state: 'done' },
        { id: 11, state: 'running' },
        { id: 11, state: 'running' },
        { id: 7, state: 'queued' },
      ] as any,
      updatedAt: 1,
      unreliable: false,
    });

    expect(state.busy).toBe(true);
    expect(state.activeChainIds).toEqual([11, 7]);
  });

  it('understands numeric chain states returned by HaveAPI', () => {
    const state = deriveChainLockState({
      chains: [
        { id: 65, state: 2 },
        { id: 53, state: 4 },
        { id: 12, state: 6 },
      ] as any,
      updatedAt: 1,
      unreliable: false,
    });

    expect(state.busy).toBe(false);
    expect(state.activeChainIds).toEqual([]);
  });

  it('keeps numeric queued and rollbacking chain states busy', () => {
    const state = deriveChainLockState({
      chains: [
        { id: 66, state: 1 },
        { id: 67, state: 3 },
      ] as any,
      updatedAt: 1,
      unreliable: false,
    });

    expect(state.busy).toBe(true);
    expect(state.activeChainIds).toEqual([67, 66]);
  });
});

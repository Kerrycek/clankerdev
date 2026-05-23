import type { TransactionChain } from './api/app';
import { isActiveChainState } from './taskStatus';

/**
 * How long we keep trusting the last known lock state when refresh fails.
 *
 * Policy (from docs/spec/LIVE_UPDATES_STRATEGY.md): 30–60s.
 *
 * After this TTL expires while the query remains unreliable (offline/errors),
 * the UI must degrade and stop treating the object as locked purely based on
 * stale chain data.
 */
export const DEFAULT_LOCK_STATE_STALE_TTL_MS = 60_000;

/**
 * Return true when previously fetched data is considered too old to trust,
 * but only when the underlying refresh is unreliable (offline/errors).
 */
export function isDataStale(args: {
  updatedAt: number | undefined;
  unreliable: boolean;
  ttlMs?: number;
  now?: number;
}): boolean {
  const updatedAt = typeof args.updatedAt === 'number' ? args.updatedAt : 0;
  const ttlMs = typeof args.ttlMs === 'number' ? args.ttlMs : DEFAULT_LOCK_STATE_STALE_TTL_MS;
  const now = typeof args.now === 'number' ? args.now : Date.now();

  if (!args.unreliable) return false;
  if (!updatedAt || updatedAt <= 0) return false;

  return now - updatedAt > ttlMs;
}

export interface ChainLockState {
  /** True when the object should be treated as busy/locked by transaction chains. */
  busy: boolean;

  /** Active transaction chain ids (diagnostic / UI tooltips). */
  activeChainIds: number[];

  /**
   * True when the chain list is too old to trust due to persistent refresh failures.
   *
   * Note: when `stale` is true we deliberately set `busy=false` (degraded) even if
   * the last known chain list contained active chains.
   */
  stale: boolean;

  /** Last successful update time (ms since epoch) of the source chain list. */
  updatedAt: number;
}

/**
 * Derive busy/lock state from a TransactionChain list with a staleness TTL.
 */
export function deriveChainLockState(args: {
  chains: TransactionChain[] | undefined;
  updatedAt: number | undefined;
  /** True when refresh is unreliable (offline or the last refetch errored). */
  unreliable: boolean;
  ttlMs?: number;
  now?: number;
}): ChainLockState {
  const ids: number[] = [];

  for (const c of args.chains ?? []) {
    const id = Number((c as any).id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!isActiveChainState((c as any).state)) continue;
    ids.push(id);
  }

  const uniq: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
  }

  // Newest first.
  uniq.sort((a, b) => b - a);

  const stale = isDataStale({
    updatedAt: args.updatedAt,
    unreliable: args.unreliable,
    ttlMs: args.ttlMs,
    now: args.now,
  });

  return {
    busy: uniq.length > 0 && !stale,
    activeChainIds: uniq,
    stale,
    updatedAt: typeof args.updatedAt === 'number' ? args.updatedAt : 0,
  };
}

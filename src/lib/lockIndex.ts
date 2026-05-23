import type { TransactionChain } from './api/app';
import { extractConcernRefs } from './concerns';
import { isFinishedChainState } from './taskStatus';

export type ConcernKey = string;

export function concernKey(className: string, rowId: number): ConcernKey {
  return `${className}:${rowId}`;
}

export interface TransactionLockIndexEntry {
  chainIds: number[];
}

export type TransactionLockIndex = Map<ConcernKey, TransactionLockIndexEntry>;

/**
 * Build an index of "busy" objects based on active transaction chains.
 *
 * This is a best-effort client-side utility. The authoritative source of truth
 * is the API (server may still reject actions if it detects a conflict).
 */
export function buildTransactionLockIndex(
  chains: TransactionChain[] | undefined,
  opts?: { onlyActive?: boolean; maxDepth?: number }
): TransactionLockIndex {
  const out: TransactionLockIndex = new Map();
  const onlyActive = opts?.onlyActive ?? true;
  const maxDepth = typeof opts?.maxDepth === 'number' ? opts.maxDepth : 3;

  for (const chain of chains ?? []) {
    const id = Number((chain as any).id);
    if (!Number.isFinite(id) || id <= 0) continue;

    if (onlyActive && isFinishedChainState((chain as any).state)) continue;

    const refs = extractConcernRefs((chain as any).concerns, { maxDepth });
    for (const r of refs) {
      const key = concernKey(r.class_name, r.row_id);
      const existing = out.get(key);
      if (!existing) {
        out.set(key, { chainIds: [id] });
      } else if (!existing.chainIds.includes(id)) {
        existing.chainIds.push(id);
      }
    }
  }

  // Deterministic order for easier UI (smallest ID first is not helpful; newest first is better).
  for (const e of out.values()) {
    e.chainIds.sort((a, b) => b - a);
  }

  return out;
}

export function transactionLockChainIds(
  idx: TransactionLockIndex,
  className: string,
  rowId: number
): number[] {
  return idx.get(concernKey(className, rowId))?.chainIds ?? [];
}

/**
 * Keyset cursor helper for descending lists: uses the smallest ID on the page.
 */
export function cursorFromDescendingPage<T>(rows: T[] | undefined, getId?: (row: T) => unknown): number | null {
  let min: number | null = null;
  for (const r of rows ?? []) {
    const id = Number(getId ? getId(r) : (r as any).id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (min === null || id < min) min = id;
  }
  return min;
}

/**
 * Keyset cursor helper for ascending lists: uses the largest ID on the page.
 */
export function cursorFromAscendingPage<T>(rows: T[] | undefined, getId?: (row: T) => unknown): number | null {
  let max: number | null = null;
  for (const r of rows ?? []) {
    const id = Number(getId ? getId(r) : (r as any).id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (max === null || id > max) max = id;
  }
  return max;
}

/**
 * Keyset cursor helper for descending lists ordered by a numeric metric.
 *
 * Example: order by duration DESC with pagination param `from_duration` and
 * filter `duration < from_duration` => the next cursor is the *smallest*
 * duration on the current page.
 */
export function cursorFromDescendingNumber<T>(
  rows: T[] | undefined,
  getValue: (row: T) => unknown
): number | null {
  let min: number | null = null;
  for (const r of rows ?? []) {
    const v = Number(getValue(r));
    if (!Number.isFinite(v)) continue;
    if (min === null || v < min) min = v;
  }
  return min;
}

/**
 * Keyset cursor helper for ascending lists ordered by a numeric metric.
 *
 * Example: order by duration ASC with pagination param `from_duration` and
 * filter `duration > from_duration` => the next cursor is the *largest*
 * duration on the current page.
 */
export function cursorFromAscendingNumber<T>(
  rows: T[] | undefined,
  getValue: (row: T) => unknown
): number | null {
  let max: number | null = null;
  for (const r of rows ?? []) {
    const v = Number(getValue(r));
    if (!Number.isFinite(v)) continue;
    if (max === null || v > max) max = v;
  }
  return max;
}

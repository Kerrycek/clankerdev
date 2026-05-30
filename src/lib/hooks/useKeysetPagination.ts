import { useLayoutEffect, useMemo, useState } from 'react';

/**
 * Keyset pagination helper for HaveAPI Index actions.
 *
 * Goals:
 * - Keep pagination state in the URL (from_id/page/limit) for shareability.
 * - Maintain a local/session "visited cursor" stack so we can render numbered pages.
 * - Avoid "broken" behaviour on refresh/deep-link/filter-change:
 *   - initial render must respect URL `from_id` (no page-1 flash)
 *   - filter changes reset cursor stack before data fetching
 */

export type KeysetCursor = number | null;
export type KeysetCursorStack = KeysetCursor[];

interface KeysetState {
  /** Signature of the filter+limit set this state belongs to. */
  sig: string;
  stack: KeysetCursorStack;
  index: number;
}

function parseNumber(
  v: string | null,
  opts: {
    integer?: boolean;
    min?: number;
  }
): number | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (!t) return undefined;

  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;

  const min = typeof opts.min === 'number' ? opts.min : 1;
  const out = opts.integer === false ? n : Math.floor(n);

  if (out < min) return undefined;
  return out;
}

function clampLimit(v: number, allowed: readonly number[], fallback: number): number {
  if (!Number.isFinite(v) || v <= 0) return fallback;
  const i = Math.floor(v);
  return allowed.includes(i) ? i : fallback;
}

// Small stable hash for sessionStorage keys (FNV-1a-ish).
function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}

function readStack(storageKey: string, opts: { min: number; integer: boolean }): KeysetCursorStack | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: KeysetCursorStack = [];
    for (const item of parsed) {
      if (item === null) {
        out.push(null);
        continue;
      }
      if (typeof item === 'number' && Number.isFinite(item)) {
        const normalized = opts.integer ? Math.floor(item) : item;
        if (normalized < opts.min) continue;
        out.push(normalized);
      }
    }
    if (out.length === 0) return null;
    // Ensure page 1 cursor is always null.
    out[0] = null;
    return out;
  } catch {
    return null;
  }
}

function writeStack(storageKey: string, stack: KeysetCursorStack, opts: { integer: boolean }) {
  if (typeof window === 'undefined') return;
  try {
    const compact = stack.map((c) => {
      if (c === null) return null;
      return opts.integer ? Math.floor(c) : c;
    });
    window.sessionStorage.setItem(storageKey, JSON.stringify(compact));
  } catch {
    // ignore
  }
}

function normalizeStack(stack: KeysetCursorStack | null | undefined): KeysetCursorStack {
  const s = Array.isArray(stack) && stack.length > 0 ? [...stack] : [null];
  s[0] = null;
  return s;
}

function initialStateFor(opts: {
  sig: string;
  storageKey: string;
  urlCursor: number | null;
  cursorMin: number;
  cursorInteger: boolean;
}): KeysetState {
  const stored = normalizeStack(readStack(opts.storageKey, { min: opts.cursorMin, integer: opts.cursorInteger }));

  let nextStack: KeysetCursorStack = stored;
  let nextIndex = 0;

  if (opts.urlCursor !== null) {
    const found = nextStack.findIndex((c) => c === opts.urlCursor);
    if (found >= 0) {
      nextIndex = found;
    } else {
      // Direct link to a cursor we haven't seen in this session: allow "Prev" back to page 1.
      nextStack = [null, opts.urlCursor];
      nextIndex = 1;
    }
  }

  if (nextIndex < 0 || nextIndex >= nextStack.length) nextIndex = 0;

  return { sig: opts.sig, stack: nextStack, index: nextIndex };
}

export function useKeysetPagination(opts: {
  /** Stable identifier for the list (e.g. "vps.list" or "transaction_chains.list") */
  id: string;
  /** A stable signature of current filters/search (must NOT include from_id/page). */
  filterKey: string;
  /** Current URLSearchParams from react-router. */
  searchParams: URLSearchParams;
  /** Setter from react-router. */
  setSearchParams: (
    nextInit: URLSearchParams | string,
    navigateOpts?: { replace?: boolean }
  ) => void;
  /** Optional prefix for query params (for pages that embed multiple paginated lists). Example: 'tx_' => tx_from_id, tx_page, tx_limit. */
  paramPrefix?: string;
  /** Cursor parameter name used by the API (default: "from_id"). */
  cursorParam?: string;
  /** Cursor minimum value (default: 1 for from_id). For metric cursors like from_duration, use 0. */
  cursorMin?: number;
  /** Parse/store cursor as integer (default: true). For float cursors, set to false. */
  cursorInteger?: boolean;
  /** Extra query-string keys to delete whenever we sync pagination state (useful when cursor param switches). */
  wipeQueryKeys?: string[];
  defaultLimit?: number;
  allowedLimits?: readonly number[];
}) {
  const allowedLimits = opts.allowedLimits ?? [25, 50, 100];
  const defaultLimit = opts.defaultLimit ?? 50;

  const paramPrefix = opts.paramPrefix ?? '';
  const cursorParam = opts.cursorParam ?? 'from_id';
  const cursorMin = typeof opts.cursorMin === 'number' ? opts.cursorMin : 1;
  const cursorInteger = typeof opts.cursorInteger === 'boolean' ? opts.cursorInteger : true;

  const limitKey = `${paramPrefix}limit`;
  const cursorKey = `${paramPrefix}${cursorParam}`;
  const pageKey = `${paramPrefix}page`;

  const limit = useMemo(() => {
    const parsed = parseNumber(opts.searchParams.get(limitKey), { integer: true, min: 1 });
    return clampLimit(parsed ?? defaultLimit, allowedLimits, defaultLimit);
  }, [allowedLimits, defaultLimit, limitKey, opts.searchParams]);

  const urlCursor = useMemo(
    () => parseNumber(opts.searchParams.get(cursorKey), { integer: cursorInteger, min: cursorMin }) ?? null,
    [cursorInteger, cursorKey, cursorMin, opts.searchParams]
  );

  const sig = useMemo(
    () =>
      `${opts.id}|${opts.filterKey}|cursor=${cursorKey};min=${cursorMin};int=${cursorInteger ? 1 : 0}|limit=${limit}`,
    [cursorInteger, cursorKey, cursorMin, opts.filterKey, opts.id, limit]
  );

  const storageKey = useMemo(() => {
    // Include filterKey + limit, but keep it short for sessionStorage.
    return `vpsadmin.keyset.${opts.id}.${hashString(sig)}`;
  }, [opts.id, sig]);

  // Initialise state from URL + sessionStorage immediately (no "page 1" flash).
  const [state, setState] = useState<KeysetState>(() =>
    initialStateFor({ sig, storageKey, urlCursor, cursorMin, cursorInteger })
  );

  const isActiveSig = state.sig === sig;
  const viewStack = isActiveSig ? state.stack : ([null] as KeysetCursorStack);
  const viewIndex = isActiveSig ? state.index : 0;

  const page = viewIndex + 1;
  const cursor = viewStack[viewIndex] === null ? undefined : viewStack[viewIndex] ?? undefined;

  const syncUrl = (nextStack: KeysetCursorStack, nextIndex: number, mode: 'push' | 'replace') => {
    // Use the router-provided params as the baseline (more deterministic than window.location).
    const cur = new URLSearchParams(opts.searchParams);
    const next = new URLSearchParams(cur);

    // Limit is always explicit once the hook is active.
    next.set(limitKey, String(limit));

    // Wipe extra params (e.g. stale cursor params when switching order).
    for (const k of opts.wipeQueryKeys ?? []) next.delete(k);

    const pageNum = nextIndex + 1;
    next.set(pageKey, String(pageNum));

    const curCursor = nextStack[nextIndex] ?? null;
    if (curCursor === null) next.delete(cursorKey);
    else next.set(cursorKey, String(curCursor));

    const nextStr = next.toString();
    const curStr = cur.toString();
    if (nextStr !== curStr) {
      opts.setSearchParams(next, { replace: mode === 'replace' });
    }
  };

  // Phase 1: signature changes (filters or limit) => reset immediately (before useEffect-based fetches).
  useLayoutEffect(() => {
    if (state.sig === sig) return;

    const reset: KeysetState = { sig, stack: [null], index: 0 };
    setState(reset);
    writeStack(storageKey, reset.stack, { integer: cursorInteger });
    syncUrl(reset.stack, 0, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, storageKey]);

  // Phase 2: URL cursor changes (browser back/forward or manual edits) => align stack/index.
  useLayoutEffect(() => {
    if (state.sig !== sig) return; // handled by signature reset effect

    const cur = urlCursor;
    const stack = state.stack;
    const index = state.index;

    // Page 1 (no cursor)
    if (cur === null) {
      if (index !== 0) {
        setState((prev) => ({ ...prev, index: 0 }));
      }
      // Always normalize URL page/limit.
      syncUrl(stack, 0, 'replace');
      return;
    }

    const found = stack.findIndex((c) => c === cur);
    if (found >= 0) {
      if (found !== index) {
        setState((prev) => ({ ...prev, index: found }));
      }
      syncUrl(stack, found, 'replace');
      return;
    }

    // Unknown cursor in URL: inject so Prev works.
    const nextStack: KeysetCursorStack = [null, cur];
    const nextIndex = 1;
    setState((prev) => ({ ...prev, stack: nextStack, index: nextIndex }));
    writeStack(storageKey, nextStack, { integer: cursorInteger });
    syncUrl(nextStack, nextIndex, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, urlCursor]);

  // Persist the stack for refresh/navigation within the same filter set.
  useLayoutEffect(() => {
    if (state.sig !== sig) return;
    writeStack(storageKey, state.stack, { integer: cursorInteger });
  }, [sig, state.sig, state.stack, storageKey]);

  const goToPage = (pageNumber: number) => {
    const idx = pageNumber - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= viewStack.length) return;
    setState((prev) => ({ ...prev, sig, index: idx, stack: viewStack }));
    syncUrl(viewStack, idx, 'push');
  };

  const goPrev = () => {
    if (viewIndex <= 0) return;
    const nextIndex = viewIndex - 1;
    setState((prev) => ({ ...prev, sig, index: nextIndex, stack: viewStack }));
    syncUrl(viewStack, nextIndex, 'push');
  };

  const goNext = (nextCursor: number | null | undefined) => {
    // If we already have a forward-visited page, just move forward.
    if (viewIndex < viewStack.length - 1) {
      const nextIndex = viewIndex + 1;
      setState((prev) => ({ ...prev, sig, index: nextIndex, stack: viewStack }));
      syncUrl(viewStack, nextIndex, 'push');
      return;
    }

    if (typeof nextCursor !== 'number' || !Number.isFinite(nextCursor) || nextCursor < cursorMin) return;

    const normalized = cursorInteger ? Math.floor(nextCursor) : nextCursor;
    const nextStack = [...viewStack, normalized];
    const nextIndex = viewIndex + 1;
    setState((prev) => ({ ...prev, sig, stack: nextStack, index: nextIndex }));
    writeStack(storageKey, nextStack, { integer: cursorInteger });
    syncUrl(nextStack, nextIndex, 'push');
  };

  const setLimit = (nextLimit: number) => {
    const l = clampLimit(nextLimit, allowedLimits, defaultLimit);
    const cur = new URLSearchParams(opts.searchParams);
    const next = new URLSearchParams(cur);
    next.set(limitKey, String(l));
    next.delete(cursorKey);
    next.set(pageKey, '1');
    opts.setSearchParams(next, { replace: true });
    // Stack reset will happen via sig change.
  };

  return {
    limit,
    fromId: cursorParam === 'from_id' ? (cursor as number | undefined) : undefined,
    cursor,
    page,
    pageCount: viewStack.length,
    stack: viewStack,
    index: viewIndex,
    canPrev: viewIndex > 0,
    hasForward: viewIndex < viewStack.length - 1,
    goPrev,
    goNext,
    goToPage,
    setLimit,
    allowedLimits,
  };
}

export type KeysetPaginationState = ReturnType<typeof useKeysetPagination>;

/**
 * Helpers that try to cross-link async task objects.
 *
 * The vpsAdmin API does not always expose explicit relations in a stable shape.
 * These helpers are intentionally best-effort and should be safe to call on arbitrary objects.
 */

function coerceInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  if (typeof v === 'object' && v !== null) {
    const id = (v as LegacyAny).id;
    const n = coerceInt(id);
    if (n !== null) return n;
  }
  return null;
}

function firstObjectId(...values: unknown[]): number | null {
  for (const value of values) {
    const id = coerceInt(value);
    if (id !== null && id > 0) return id;
  }
  return null;
}

/**
 * Try to extract a related transaction chain ID from an action state object.
 *
 * Supported shapes (best-effort):
 * - { transaction_chain: { id: 123 } }
 * - { transaction_chain_id: 123 }
 * - { transactionChainId: 123 }
 * - label contains "transaction chain #123" (heuristic)
 */
export function extractRelatedTransactionChainIdFromActionState(actionState: unknown): number | null {
  if (!actionState || typeof actionState !== 'object') return null;
  const s: any = actionState;

  const directCandidates: unknown[] = [
    s.transaction_chain,
    s.transactionChain,
    s.transaction_chain_id,
    s.transactionChainId,
    s.chain_id,
    s.chainId,
    s.transaction,
    s.transactions,
    s.tx,
  ];

  for (const cand of directCandidates) {
    if (Array.isArray(cand)) {
      for (const item of cand) {
        const id = firstObjectId((item as LegacyAny)?.transaction_chain, (item as LegacyAny)?.transactionChain, (item as LegacyAny)?.transaction_chain_id);
        if (id !== null) return id;
      }
    }
    const id = coerceInt(cand);
    if (id !== null && id > 0) return id;
  }

  const label = typeof s.label === 'string' ? s.label : '';
  if (label) {
    // Avoid overly broad matches; only attempt when label mentions transaction chain explicitly.
    const m = label.match(/(?:transaction\s*chain|transaction_chain|tx\s*chain)\s*#?\s*(\d+)/i);
    if (m && m[1]) {
      const id = coerceInt(m[1]);
      if (id !== null && id > 0) return id;
    }
  }

  // vpsAdmin represents action states as wrappers around transaction chains.
  // In that case, the action state ID itself is the transaction chain ID.
  const looksLikeActionState =
    typeof s.finished === 'boolean' ||
    typeof s.status === 'boolean' ||
    typeof s.current === 'number' ||
    typeof s.total === 'number' ||
    typeof s.progress === 'number';

  if (looksLikeActionState) {
    const id = coerceInt(s.id);
    if (id !== null && id > 0) return id;
  }

  return null;
}

/**
 * Try to extract a related action state ID from a transaction chain object.
 *
 * Supported shapes (best-effort):
 * - { action_state: { id: 123 } }
 * - { action_state_id: 123 }
 * - { actionStateId: 123 }
 */
export function extractRelatedActionStateIdFromTransactionChain(chain: unknown): number | null {
  if (!chain || typeof chain !== 'object') return null;
  const c: any = chain;

  const candidates: unknown[] = [
    c.action_state,
    c.actionState,
    c.action_state_id,
    c.actionStateId,
    c.action_stateId,
    c.actionState_id,
  ];

  for (const cand of candidates) {
    const id = coerceInt(cand);
    if (id !== null && id > 0) return id;
  }

  return null;
}

import type { GateDecision, GateReason } from './types';

export type NodeGateContext = {
  busyLocal?: boolean;
  busyTransaction?: boolean;
};

function deny(reason: GateReason): GateDecision {
  return { allowed: false, reason };
}

/**
 * Minimal gate for admin node actions.
 *
 * Nodes do not currently expose a stable object_state in the app API.
 * We therefore gate only on:
 * - local transition locks (per-tab)
 * - active transaction chains (best-effort; some deployments may not support it)
 */
export function gateNodeAction(
  _action: 'maintenance.lock' | 'maintenance.unlock' | 'evacuate',
  ctx: NodeGateContext
): GateDecision {
  if (ctx.busyLocal) {
    return deny({ titleKey: 'gate.busy.local.title', descriptionKey: 'gate.busy.local.body' });
  }

  if (ctx.busyTransaction) {
    return deny({ titleKey: 'gate.busy.transaction.title', descriptionKey: 'gate.busy.transaction.body' });
  }

  return { allowed: true };
}

import { fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { hasActiveChains } from '../../../lib/taskStatus';

async function safeFetchVpsChains(vpsId: number, limit: number): Promise<TransactionChain[] | null> {
  try {
    return (await fetchTransactionChains({ className: 'Vps', rowId: vpsId, limit })).data;
  } catch {
    return null;
  }
}

function throwBusy(message: string): never {
  const err: any = new Error(message);
  err.code = 'BUSY';
  throw err;
}

/**
 * Best-effort busy preflight for VPS mutations.
 *
 * Browser-side lock state can be stale after deploys, reloads, or a failed chain
 * with numeric state values. Always verify against fresh backend chain data before
 * refusing the action.
 */
export async function preflightVpsNotBusy(args: {
  vpsId: number;
  t: (key: any, vars?: any) => string;
  /** When true, skip network calls and fail fast. */
  knownBusy?: boolean;
}): Promise<void> {
  const vpsId = Number(args.vpsId);
  if (!Number.isFinite(vpsId) || vpsId <= 0) return;

  const chains = await safeFetchVpsChains(vpsId, 10);
  if (chains === null) {
    if (args.knownBusy) throwBusy(args.t('toast.action_blocked.body'));
    return;
  }

  if (hasActiveChains(chains)) {
    throwBusy(args.t('toast.action_blocked.body'));
  }
}

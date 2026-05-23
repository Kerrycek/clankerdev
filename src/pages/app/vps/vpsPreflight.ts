import { fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { hasActiveChains } from '../../../lib/taskStatus';

async function safeFetchVpsChains(vpsId: number, limit: number): Promise<TransactionChain[]> {
  try {
    return (await fetchTransactionChains({ className: 'Vps', rowId: vpsId, limit })).data;
  } catch {
    return [];
  }
}

/**
 * Best-effort busy preflight for VPS mutations.
 *
 * - When `knownBusy` is true, skips network calls and fails fast.
 * - Otherwise queries recent transaction chains for the VPS and blocks when any are active.
 */
export async function preflightVpsNotBusy(args: {
  vpsId: number;
  t: (key: any, vars?: any) => string;
  /** When true, skip network calls and fail fast. */
  knownBusy?: boolean;
}): Promise<void> {
  const vpsId = Number(args.vpsId);
  if (!Number.isFinite(vpsId) || vpsId <= 0) return;

  if (args.knownBusy) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }

  const chains = await safeFetchVpsChains(vpsId, 10);
  if (hasActiveChains(chains)) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }
}

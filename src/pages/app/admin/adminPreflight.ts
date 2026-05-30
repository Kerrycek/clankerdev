import { fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { hasActiveChains } from '../../../lib/taskStatus';

async function safeFetchChainsByClassName(params: {
  className: string;
  rowId: number;
  limit: number;
}): Promise<TransactionChain[] | null> {
  try {
    return (
      await fetchTransactionChains({
        limit: params.limit,
        className: params.className,
        rowId: params.rowId,
      })
    ).data;
  } catch {
    return null;
  }
}

function busyError(message: string): Error & { code: string } {
  const err: any = new Error(message);
  err.code = 'BUSY';
  return err;
}

/**
 * Best-effort busy preflight for admin objects.
 *
 * Browser-side lock state can be stale or can be set by the mutation that is
 * currently starting. Verify fresh backend chain data before refusing an action.
 */
export async function preflightAdminObjectNotBusy(args: {
  className: string;
  rowId: number;
  t: (key: any, vars?: any) => string;
  /** When true, skip network calls and fail fast. */
  knownBusy?: boolean;
  limit?: number;
}): Promise<void> {
  const rowId = Number(args.rowId);
  if (!Number.isFinite(rowId) || rowId <= 0) return;

  const chains = await safeFetchChainsByClassName({
    className: args.className,
    rowId,
    limit: args.limit ?? 10,
  });

  if (chains === null) {
    if (args.knownBusy) throw busyError(args.t('toast.action_blocked.body'));
    return;
  }

  if (hasActiveChains(chains)) {
    throw busyError(args.t('toast.action_blocked.body'));
  }
}

export function preflightNodeNotBusy(args: {
  nodeId: number;
  t: (key: any, vars?: any) => string;
  knownBusy?: boolean;
}): Promise<void> {
  return preflightAdminObjectNotBusy({ className: 'Node', rowId: args.nodeId, t: args.t, knownBusy: args.knownBusy });
}

export function preflightMigrationPlanNotBusy(args: {
  planId: number;
  t: (key: any, vars?: any) => string;
  knownBusy?: boolean;
}): Promise<void> {
  return preflightAdminObjectNotBusy({
    className: 'MigrationPlan',
    rowId: args.planId,
    t: args.t,
    knownBusy: args.knownBusy,
  });
}

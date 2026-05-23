import { fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { hasActiveChains } from '../../../lib/taskStatus';

async function safeFetchChainsByClassName(params: {
  className: string;
  rowId: number;
  limit: number;
}): Promise<TransactionChain[]> {
  try {
    return (
      await fetchTransactionChains({
        limit: params.limit,
        className: params.className,
        rowId: params.rowId,
      })
    ).data;
  } catch {
    return [];
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
 * Note: not all backends support class_name+row_id queries for all objects.
 * We swallow lookup errors and treat them as "unknown".
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

  if (args.knownBusy) {
    throw busyError(args.t('toast.action_blocked.body'));
  }

  const chains = await safeFetchChainsByClassName({
    className: args.className,
    rowId,
    limit: args.limit ?? 10,
  });

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

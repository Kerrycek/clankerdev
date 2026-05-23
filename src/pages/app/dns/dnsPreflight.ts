import { fetchDnsRecordLogs, type DnsRecordLog } from '../../../lib/api/dns';
import { fetchTransactionChain, fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { extractConcernRefs } from '../../../lib/concerns';
import { hasActiveChains } from '../../../lib/taskStatus';

async function safeFetchChainsByClassName(params: {
  className: string;
  rowId: number;
  limit: number;
}): Promise<TransactionChain[]> {
  try {
    return (await fetchTransactionChains({
      limit: params.limit,
      className: params.className,
      rowId: params.rowId,
    })).data;
  } catch {
    return [];
  }
}

function extractRecentChainIds(logs: DnsRecordLog[], limit: number): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const l of logs) {
    const raw = (l.transaction_chain as any)?.id;
    const id = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

  return ids;
}

function inferZoneConcernClasses(zoneId: number, chains: TransactionChain[]): string[] {
  const out = new Set<string>();

  for (const chain of chains) {
    for (const c of extractConcernRefs(chain.concerns, { maxDepth: 3 })) {
      if (c.row_id === zoneId) out.add(c.class_name);
    }
  }

  return [...out.values()].sort();
}

async function fetchChainsByConcern(zoneId: number, classes: string[]): Promise<TransactionChain[]> {
  if (classes.length === 0) return [];

  const settled = await Promise.allSettled(
    classes.map(async (cls) => (await fetchTransactionChains({ limit: 10, className: cls, rowId: zoneId })).data)
  );

  const byId = new Map<number, TransactionChain>();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const c of s.value ?? []) {
      const id = Number((c as any)?.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      byId.set(id, c);
    }
  }

  return [...byId.values()];
}

export async function preflightDnsZoneNotBusy(args: {
  zoneId: number;
  t: (key: any, vars?: any) => string;
  concernClasses?: string[];
  /** When true, skip network calls and fail fast. */
  knownBusy?: boolean;
}): Promise<void> {
  const zoneId = Number(args.zoneId);
  if (!Number.isFinite(zoneId) || zoneId <= 0) return;

  if (args.knownBusy) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }

  // 0) Fast path: attempt a direct transaction chain lookup by the canonical DNS zone class name.
  // This is safe (we swallow lookup errors) and improves accuracy when there are no recent record logs.
  const directChains = await safeFetchChainsByClassName({ className: 'DnsZone', rowId: zoneId, limit: 10 });
  if (hasActiveChains(directChains)) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }

  // 1) If we already know the zone's concern classes, query by class_name+row_id.
  const knownClasses = (args.concernClasses ?? []).filter((x) => typeof x === 'string' && x.length > 0);
  if (knownClasses.length > 0) {
    const chains = await fetchChainsByConcern(zoneId, knownClasses);
    if (hasActiveChains(chains)) {
      const err: any = new Error(args.t('toast.action_blocked.body'));
      err.code = 'BUSY';
      throw err;
    }
    return;
  }

  // 2) Best-effort discovery through DNS record logs.
  const logs = (await fetchDnsRecordLogs({ dns_zone: zoneId, limit: 50 })).data;
  const chainIds = extractRecentChainIds(logs ?? [], 10);

  if (chainIds.length === 0) return;

  const settled = await Promise.allSettled(chainIds.map(async (id) => (await fetchTransactionChain(id)).data));
  const chainsFromLogs = settled
    .map((s) => (s.status === 'fulfilled' ? s.value : null))
    .filter(Boolean) as TransactionChain[];

  if (hasActiveChains(chainsFromLogs)) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }

  const inferred = inferZoneConcernClasses(zoneId, chainsFromLogs);
  if (inferred.length === 0) return;

  const chainsByConcern = await fetchChainsByConcern(zoneId, inferred);
  if (hasActiveChains(chainsByConcern)) {
    const err: any = new Error(args.t('toast.action_blocked.body'));
    err.code = 'BUSY';
    throw err;
  }
}

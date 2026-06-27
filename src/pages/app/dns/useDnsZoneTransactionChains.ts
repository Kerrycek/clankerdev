import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchDnsRecordLogs, type DnsRecordLog } from '../../../lib/api/dns';
import { fetchTransactionChain, fetchTransactionChains, type TransactionChain } from '../../../lib/api/transactions';
import { extractConcernRefs } from '../../../lib/concerns';
import { useTierBIntervalMs } from '../../../lib/refreshTiers';
import { deriveChainLockState } from '../../../lib/lockState';
import { useNetworkStatus } from '../../../lib/useNetworkStatus';

function extractRecentChainIds(logs: DnsRecordLog[], limit: number): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const l of logs) {
    const raw = (l.transaction_chain as LegacyAny)?.id;
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

function toTs(t: string | undefined): number {
  if (!t) return 0;
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function combineChains(a: TransactionChain[], b: TransactionChain[]): TransactionChain[] {
  const byId = new Map<number, TransactionChain>();
  for (const c of a ?? []) {
    if (typeof (c as LegacyAny)?.id === 'number') byId.set((c as LegacyAny).id, c);
  }
  for (const c of b ?? []) {
    if (typeof (c as LegacyAny)?.id === 'number') byId.set((c as LegacyAny).id, c);
  }

  const rows = [...byId.values()];
  rows.sort((x, y) => {
    const tx = toTs((x as LegacyAny).created_at);
    const ty = toTs((y as LegacyAny).created_at);
    if (tx !== ty) return ty - tx;
    return (Number((y as LegacyAny).id) ?? 0) - (Number((x as LegacyAny).id) ?? 0);
  });
  return rows;
}

async function safeFetchChainsByClassName(params: {
  className: string;
  rowId: number;
  limit?: number;
}): Promise<TransactionChain[]> {
  try {
    return (await fetchTransactionChains({ className: params.className, rowId: params.rowId, limit: params.limit })).data;
  } catch {
    return [];
  }
}

export interface DnsZoneChainDiscovery {
  /** Latest dns_record_logs-derived chain ids (best effort). */
  recentChainIds: number[];
  /** Best-effort concern class names for the dns zone itself. */
  concernClasses: string[];

  chains: TransactionChain[];
  chainsLoading: boolean;
  chainsError: unknown | null;

  busyTransaction: boolean;
  /** True when chain refresh has been failing long enough that lock state is degraded. */
  chainsStale: boolean;
  activeChainIds: number[];

  refetch: () => void;
}

/**
 * DNS zones do not reliably expose class_name/row_id for transaction chains.
 *
 * We discover relevant chains through dns_record_logs, then infer the zone's
 * concern class names from those chains, and finally query all chains by
 * class_name+row_id for a more complete view.
 */
export function useDnsZoneTransactionChains(zoneId: number): DnsZoneChainDiscovery {
  const tierBRefetchMs = useTierBIntervalMs();
  const online = useNetworkStatus();

  const directChainsQ = useQuery({
    queryKey: ['transaction_chains', 'dns_zone_direct', { zoneId }],
    queryFn: async () => safeFetchChainsByClassName({ className: 'DnsZone', rowId: zoneId, limit: 25 }),
    enabled: Number.isFinite(zoneId) && zoneId > 0,
    refetchInterval: tierBRefetchMs,
  });

  const logsQ = useQuery({
    queryKey: ['dns_record_logs', 'index', { dns_zone: zoneId, limit: 50 }],
    queryFn: async () => (await fetchDnsRecordLogs({ dns_zone: zoneId, limit: 50 })).data,
    enabled: Number.isFinite(zoneId) && zoneId > 0,
    refetchInterval: tierBRefetchMs,
  });

  const recentChainIds = useMemo(() => extractRecentChainIds(logsQ.data ?? [], 10), [logsQ.data]);

  const chainsFromLogsQ = useQuery({
    queryKey: ['transaction_chains', 'dns_zone_recent', { zoneId, ids: recentChainIds }],
    queryFn: async () => {
      const settled = await Promise.allSettled(recentChainIds.map(async (id) => (await fetchTransactionChain(id)).data));
      return settled
        .map((s) => (s.status === 'fulfilled' ? s.value : null))
        .filter(Boolean) as TransactionChain[];
    },
    enabled: recentChainIds.length > 0,
    refetchInterval: tierBRefetchMs,
  });

  const concernClasses = useMemo(() => {
    const base = [...(directChainsQ.data ?? []), ...(chainsFromLogsQ.data ?? [])];
    return inferZoneConcernClasses(zoneId, base);
  }, [chainsFromLogsQ.data, directChainsQ.data, zoneId]);

  const secondaryConcernClasses = useMemo(
    () => concernClasses.filter((cls) => cls !== 'DnsZone'),
    [concernClasses]
  );

  const chainsByConcernQ = useQuery({
    queryKey: ['transaction_chains', 'dns_zone_by_concern', { zoneId, classes: secondaryConcernClasses }],
    queryFn: async () => {
      const settled = await Promise.allSettled(
        secondaryConcernClasses.map(async (cls) =>
          (await fetchTransactionChains({ limit: 25, className: cls, rowId: zoneId })).data
        )
      );

      const byId = new Map<number, TransactionChain>();
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        for (const c of s.value ?? []) {
          if (typeof (c as LegacyAny)?.id !== 'number') continue;
          byId.set((c as LegacyAny).id, c);
        }
      }

      return [...byId.values()];
    },
    enabled: secondaryConcernClasses.length > 0,
    refetchInterval: tierBRefetchMs,
  });

  const chains = useMemo(
    () =>
      combineChains(
        combineChains(chainsFromLogsQ.data ?? [], chainsByConcernQ.data ?? []),
        directChainsQ.data ?? []
      ).slice(0, 10),
    [chainsByConcernQ.data, chainsFromLogsQ.data, directChainsQ.data]
  );

  const updatedAt = Math.max(
    directChainsQ.dataUpdatedAt,
    logsQ.dataUpdatedAt,
    chainsFromLogsQ.dataUpdatedAt,
    chainsByConcernQ.dataUpdatedAt
  );

  const lock = deriveChainLockState({
    chains,
    updatedAt,
    unreliable:
      !online ||
      directChainsQ.isError ||
      logsQ.isError ||
      chainsFromLogsQ.isError ||
      chainsByConcernQ.isError,
  });

  const busyTransaction = lock.busy;
  const activeChainIds = lock.activeChainIds;
  const chainsStale = lock.stale;

  const chainsLoading =
    directChainsQ.isLoading || logsQ.isLoading || chainsFromLogsQ.isLoading || chainsByConcernQ.isLoading;
  const chainsError =
    (directChainsQ.isError ? directChainsQ.error : null) ??
    (logsQ.isError ? logsQ.error : null) ??
    (chainsFromLogsQ.isError ? chainsFromLogsQ.error : null) ??
    (chainsByConcernQ.isError ? chainsByConcernQ.error : null);

  const refetch = () => {
    void directChainsQ.refetch();
    void logsQ.refetch();
    void chainsFromLogsQ.refetch();
    void chainsByConcernQ.refetch();
  };

  return {
    recentChainIds,
    concernClasses,
    chains,
    chainsLoading,
    chainsError,
    busyTransaction,
    chainsStale,
    activeChainIds,
    refetch,
  };
}

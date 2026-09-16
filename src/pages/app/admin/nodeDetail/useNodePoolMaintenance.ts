import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNodePools,
  fetchPool,
  type NodePool,
} from '../../../../lib/api/nodes';
import type { PoolMaintenanceGuardMap } from './NodeStorageCard';

export function useNodePoolMaintenance(
  nodeId: number,
  enabled: boolean,
  refetchInterval: number,
) {
  const queryClient = useQueryClient();
  const poolsQueryKey = ['nodes', 'pools', { nodeId, limit: 500 }] as const;
  const poolsQ = useQuery({
    queryKey: poolsQueryKey,
    queryFn: async ({ signal }) => (
      await fetchNodePools(nodeId, { limit: 500, signal })
    ).data,
    enabled,
    refetchInterval,
  });

  const guardsQueryKey = ['nodes', 'pools', 'maintenance-guards', { nodeId }] as const;
  const guardsQ = useQuery<PoolMaintenanceGuardMap>({
    queryKey: guardsQueryKey,
    queryFn: async () => ({}),
    enabled: false,
    initialData: {},
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const cancelStalePoolList = () => queryClient.cancelQueries(
    { queryKey: poolsQueryKey, exact: true },
    { silent: true, revert: false },
  );

  const refreshAfterMaintenance = async () => {
    await cancelStalePoolList();
    await queryClient.fetchQuery({
      queryKey: poolsQueryKey,
      queryFn: async ({ signal }) => (
        await fetchNodePools(nodeId, { limit: 500, signal })
      ).data,
      staleTime: 0,
    });
  };

  const setGuard = (
    poolId: number,
    guard: PoolMaintenanceGuardMap[string] | null,
  ) => {
    queryClient.setQueryData<PoolMaintenanceGuardMap>(guardsQueryKey, (current = {}) => {
      if (guard) return { ...current, [poolId]: guard };
      const { [poolId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const readMaintenance = async (poolId: number) => {
    await cancelStalePoolList();
    try {
      const latest = (await fetchPool(poolId)).data;
      const latestNodeId = typeof latest.node === 'number' ? latest.node : latest.node?.id;
      if (!Number.isSafeInteger(latestNodeId) || latestNodeId !== nodeId) {
        throw new TypeError(`pools/${poolId}: response node does not match requested node`);
      }

      const maintenanceState = typeof latest.maintenance_lock === 'string'
        ? latest.maintenance_lock.trim().toLowerCase()
        : '';
      if (!['no', 'lock', 'master_lock'].includes(maintenanceState)) {
        throw new TypeError(`pools/${poolId}: invalid maintenance state in read-back`);
      }

      const rawReason = latest.maintenance_lock_reason;
      if (rawReason !== undefined && rawReason !== null && typeof rawReason !== 'string') {
        throw new TypeError(`pools/${poolId}: invalid maintenance reason in read-back`);
      }
      const maintenanceReason = typeof rawReason === 'string' ? rawReason.trim() : '';
      const reconciledPool: NodePool = {
        ...latest,
        maintenance_lock: maintenanceState,
        maintenance_lock_reason: maintenanceReason,
      };

      // Prevent a list request that started before the mutation from publishing
      // stale state after this exact read-back has established the outcome.
      await cancelStalePoolList();
      queryClient.setQueryData<NodePool[]>(poolsQueryKey, (current) => (
        current?.map((pool) => pool.id === poolId ? reconciledPool : pool)
      ));

      return { value: maintenanceState, reason: maintenanceReason };
    } catch (error) {
      // Validation failures are as untrusted as transport failures: make sure
      // no older list response can erase the persistent verification guard.
      await cancelStalePoolList();
      throw error;
    }
  };

  return {
    guardsQ,
    poolsQ,
    readMaintenance,
    refreshAfterMaintenance,
    setGuard,
  };
}

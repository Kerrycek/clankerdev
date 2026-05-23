import type { QueryClient } from '@tanstack/react-query';

import type { ObjectRef } from './objectRef';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Pure helper: decide whether a React Query key is logically tied to an object.
 *
 * IMPORTANT:
 * - This is best-effort. The backend is authoritative.
 * - Keep this matcher conservative (prefer false negatives over false positives).
 */
export function queryKeyMatchesObject(ref: ObjectRef, queryKey: readonly unknown[]): boolean {
  const k0 = queryKey[0];
  const k1 = queryKey[1];
  const k2 = queryKey[2];

  const id = ref.id;

  // -----------------
  // VPS (app/module)
  // -----------------
  if (ref.kind === 'Vps') {
    // Main VPS queries
    if (k0 === 'vps') {
      if (k1 === 'show' && isRecord(k2) && num(k2['id']) === id) return true;
      if (k1 === 'list') return true;
      if (typeof k1 === 'number' && k1 === id) return true; // mounts/maintenance/consoleToken/etc.
      if (k1 === 'metrics' && isRecord(k2) && num(k2['vpsId']) === id) return true;
    }

    // Features are a separate resource.
    if (k0 === 'vps_feature' && k1 === 'list' && isRecord(k2) && num(k2['vpsId']) === id) return true;

    // Related objects filtered by vpsId
    if (k0 === 'ip_address' && k1 === 'list' && isRecord(k2) && num(k2['vpsId']) === id) return true;

    if (k0 === 'network_interface') {
      if ((k1 === 'list' || k1 === 'accounting') && isRecord(k2) && num(k2['vpsId']) === id) return true;
    }

    // Per-object transaction chains on detail pages
    if ((k0 === 'transaction_chain' || k0 === 'transaction_chains') && k1 === 'list' && isRecord(k2)) {
      if (k2['className'] === 'Vps' && num(k2['rowId']) === id) return true;
    }

    return false;
  }

  // --------------------
  // Dataset (app/module)
  // --------------------
  if (ref.kind === 'Dataset') {
    if (k0 === 'datasets') {
      if (k1 === 'show' && num(k2) === id) return true;
      if (k1 === 'index') return true;
      if (typeof k1 === 'number' && k1 === id) return true; // snapshots, downloads
    }

    if ((k0 === 'transaction_chain' || k0 === 'transaction_chains') && k1 === 'list' && isRecord(k2)) {
      if (k2['className'] === 'Dataset' && num(k2['rowId']) === id) return true;
    }

    return false;
  }

  // --------------------
  // DNS zone (app/module)
  // --------------------
  if (ref.kind === 'DnsZone') {
    if (k0 === 'dns_zones') {
      if (k1 === 'show' && num(k2) === id) return true;
      if (k1 === 'index') return true;
    }

    if (k0 === 'dns_records' && k1 === 'index' && isRecord(k2) && num(k2['dns_zone']) === id) return true;
    if (k0 === 'dns_record_logs' && k1 === 'index' && isRecord(k2) && num(k2['dns_zone']) === id) return true;

    if ((k0 === 'transaction_chain' || k0 === 'transaction_chains') && k1 === 'list' && isRecord(k2)) {
      if (k2['className'] === 'DnsZone' && num(k2['rowId']) === id) return true;
    }

    // DNS zone chain discovery hooks
    if (k0 === 'transaction_chains' && typeof k1 === 'string' && k1.startsWith('dns_zone_') && isRecord(k2)) {
      if (num(k2['zoneId']) === id) return true;
    }

    return false;
  }

  // -----------------
  // Node (admin/module)
  // -----------------
  if (ref.kind === 'Node') {
    if (k0 === 'nodes') {
      if (k1 === 'show' && isRecord(k2) && num(k2['id']) === id) return true;
      if (k1 === 'index') return true;
      if (k1 === 'public_status') return true; // aggregated node health summary
      if ((k1 === 'statuses' || k1 === 'metrics') && isRecord(k2) && num(k2['nodeId']) === id) return true;
    }

    if ((k0 === 'transaction_chain' || k0 === 'transaction_chains') && k1 === 'list' && isRecord(k2)) {
      if (k2['className'] === 'Node' && num(k2['rowId']) === id) return true;
    }

    return false;
  }

  // --------------------------
  // Migration plan (admin/module)
  // --------------------------
  if (ref.kind === 'MigrationPlan') {
    if (k0 === 'migration_plans') {
      if (k1 === 'show' && isRecord(k2) && num(k2['id']) === id) return true;
      if (k1 === 'list') return true;
      if (k1 === 'vps_migrations' && isRecord(k2) && num(k2['planId']) === id) return true;
    }

    if ((k0 === 'transaction_chain' || k0 === 'transaction_chains') && k1 === 'list' && isRecord(k2)) {
      if (k2['className'] === 'MigrationPlan' && num(k2['rowId']) === id) return true;
    }

    return false;
  }

  // -----------------
  // User (admin/module)
  // -----------------
  if (ref.kind === 'User') {
    if (k0 === 'users') {
      // User show pages use ['users', userId]
      if (typeof k1 === 'number' && k1 === id) return true;
      if (k1 === 'index') return true;
    }

    return false;
  }

  // -----------------
  // IP address (admin/module)
  // -----------------
  if (ref.kind === 'IpAddress') {
    if (k0 === 'ip_addresses') {
      // Admin IP detail uses ['ip_addresses', ipId]
      if (typeof k1 === 'number' && k1 === id) return true;
      if (k1 === 'index') return true;
    }

    return false;
  }

  // -----------------
  // Network (admin/module)
  // -----------------
  if (ref.kind === 'Network') {
    if (k0 === 'networks') {
      // List is module-wide
      if (k1 === 'index') return true;
      return true;
    }

    // Detail page: ['network', id]
    if (k0 === 'network' && num(k1) === id) return true;

    // Location membership list: ['location_networks', 'network', id]
    if (k0 === 'location_networks' && k1 === 'network' && num(k2) === id) return true;

    return false;
  }

  // -----------------
  // DNS resolver (admin/module)
  // -----------------
  if (ref.kind === 'DnsResolver') {
    if (k0 === 'dns_resolvers') return true;
    return false;
  }

  // Conservative default.
  return false;
}

/**
 * Invalidate all cached queries related to the given object.
 *
 * This is intended for task completion events, so the UI refreshes quickly
 * when an async backend mutation finishes.
 */
export function invalidateQueriesForObject(qc: QueryClient, ref: ObjectRef) {
  void qc.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key)) return false;
      return queryKeyMatchesObject(ref, key);
    },
  });
}

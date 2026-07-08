import { fetchUser, type User } from '../api/users';

export type SearchT = (key: string, vars?: Record<string, unknown>) => string;

export interface EnrichableSearchResult {
  primary: string;
  secondary: string;
  id?: number;
  resource?: string;
  attribute?: string;
}

export function normalizeClusterResource(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';

  const lower = s.toLowerCase();
  if (lower === 'vps') return 'Vps';
  if (lower === 'user') return 'User';
  if (lower === 'node') return 'Node';
  if (lower === 'migrationplan' || lower === 'migration_plan' || lower === 'migration-plan') return 'MigrationPlan';
  if (lower === 'dataset') return 'Dataset';
  if (lower === 'dnszone' || lower === 'dns_zone' || lower === 'dns-zone') return 'DnsZone';
  if (lower === 'transaction') return 'Transaction';
  if (lower === 'actionstate' || lower === 'action_state' || lower === 'action-state') return 'ActionState';
  if (lower === 'ipaddress' || lower === 'ip_address' || lower === 'ip-address') return 'IpAddress';
  if (lower === 'transactionchain' || lower === 'transaction_chain' || lower === 'transaction-chain') {
    return 'TransactionChain';
  }
  if (lower === 'network') return 'Network';
  return s;
}

export function parseClusterId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export function clusterResourceHref(basePath: string, resource: string, id: number): string | null {
  if (resource === 'Vps') return `${basePath}/vps/${id}`;
  if (resource === 'User') return `${basePath}/users/${id}`;
  if (resource === 'IpAddress') return `${basePath}/ip-addresses/${id}`;
  if (resource === 'TransactionChain') return `${basePath}/transactions/${id}`;
  if (resource === 'Transaction') return `${basePath}/transactions/items/${id}`;
  if (resource === 'ActionState') return `${basePath}/action-states/${id}`;
  if (resource === 'Dataset') return `${basePath}/datasets/${id}`;
  if (resource === 'DnsZone') return `${basePath}/dns/zones/${id}`;
  if (resource === 'MigrationPlan') return `${basePath}/migration-plans/${id}`;
  if (resource === 'Node') return `${basePath}/nodes/${id}`;
  if (resource === 'Network') return `${basePath}/cluster/networks/${id}`;
  return null;
}

export function clusterResourceKey(resource: string, id: number): string {
  const prefix: Record<string, string> = {
    Vps: 'vps',
    User: 'user',
    IpAddress: 'ip',
    TransactionChain: 'txc',
    Transaction: 'tx',
    ActionState: 'as',
    Dataset: 'ds',
    DnsZone: 'dns',
    MigrationPlan: 'mp',
    Node: 'node',
    Network: 'net',
  };

  return `${prefix[resource] ?? resource.toLowerCase()}:${id}`;
}

export function clusterResourceKindLabel(t: SearchT, resource: string): string {
  if (resource === 'Vps') return t('object_kind.vps');
  if (resource === 'User') return t('object_kind.user');
  if (resource === 'Node') return t('object_kind.node');
  if (resource === 'IpAddress') return t('object_kind.ip_address');
  if (resource === 'Transaction') return t('object_kind.transaction');
  if (resource === 'TransactionChain') return t('object_kind.transaction_chain');
  if (resource === 'ActionState') return t('object_kind.action_state');
  if (resource === 'Dataset') return t('object_kind.dataset');
  if (resource === 'DnsZone') return t('object_kind.dns_zone');
  if (resource === 'MigrationPlan') return t('object_kind.migration_plan');
  if (resource === 'Network') return t('object_kind.network');
  return resource;
}

export function clusterResourceRefLabel(t: SearchT, resource: string, id: number): string {
  if (resource === 'Vps') return t('common.vps_ref', { id });
  return t('common.resource_ref', { resource: clusterResourceKindLabel(t, resource), id });
}

function compactSearchParts(parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const value = String(part ?? '').trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function formatUserSearchResult<T extends EnrichableSearchResult>(t: SearchT, user: User, fallback: T): T {
  const login = String(user.login ?? '').trim();
  const fullName = String(user.full_name ?? '').trim();
  const email = String(user.email ?? '').trim();
  const userRef = clusterResourceRefLabel(t, 'User', user.id);
  const primary = login || fullName || email || fallback.primary || userRef;
  const secondaryParts = compactSearchParts([
    userRef,
    fullName !== primary ? fullName : null,
    email !== primary ? email : null,
    fallback.attribute,
  ]);

  return {
    ...fallback,
    primary,
    secondary: secondaryParts.join(' · ') || fallback.secondary,
  };
}

export async function enrichUserSearchResults<T extends EnrichableSearchResult>(
  results: T[],
  t: SearchT,
  signal: AbortSignal
): Promise<T[]> {
  if (!results.some((result) => result.resource === 'User' && typeof result.id === 'number')) {
    return results;
  }

  return Promise.all(
    results.map(async (result) => {
      if (result.resource !== 'User' || typeof result.id !== 'number') return result;
      if (signal.aborted) return result;

      try {
        const res = await fetchUser(result.id, { signal });
        if (signal.aborted) return result;
        return formatUserSearchResult(t, res.data, result);
      } catch (e: any) {
        if (e?.name === 'AbortError') return result;
        return result;
      }
    })
  );
}

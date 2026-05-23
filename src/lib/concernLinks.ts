/**
 * Helpers for turning transaction chain concern refs into UI links.
 */

/**
 * Strip namespaces (e.g. "VpsAdmin::Vps" -> "Vps").
 */
export function shortConcernClassName(className: string): string {
  const s = String(className);
  return s.split('::').filter(Boolean).slice(-1)[0] ?? s;
}

function normalizeClassKey(className: string): string {
  return shortConcernClassName(className)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * Direct object detail links, when the concern maps cleanly to an existing route.
 */
export function directConcernLink(basePath: string, className: string, rowId: number): string | null {
  const key = normalizeClassKey(className);

  if (key === 'vps') return `${basePath}/vps/${rowId}`;
  if (key === 'dataset') return `${basePath}/datasets/${rowId}`;
  if (key === 'dnszone') return `${basePath}/dns/zones/${rowId}`;

  // Admin-only objects.
  if (key === 'node') return basePath === '/admin' ? `${basePath}/nodes/${rowId}` : null;
  if (key === 'migrationplan') return basePath === '/admin' ? `${basePath}/migration-plans/${rowId}` : null;

  return null;
}


export type TxItemsFilterParam = { key: 'vps' | 'node' | 'transaction_chain'; value: string };

/**
 * Map a concern ref to a transaction-items filter parameter, when possible.
 *
 * Not all concerns can be represented as a transaction items filter.
 * We only return mappings that the UI supports natively on /transactions/items.
 */
export function txItemsFilterForConcern(className: string, rowId: number): TxItemsFilterParam | null {
  const key = normalizeClassKey(className);
  const value = String(rowId);

  if (key === 'vps') return { key: 'vps', value };
  if (key === 'node') return { key: 'node', value };
  if (key === 'transactionchain') return { key: 'transaction_chain', value };

  return null;
}

/**
 * Convenience helper: link to /transactions/items filtered by the concern, when supported.
 */
export function txItemsConcernFilterLink(basePath: string, className: string, rowId: number): string | null {
  const f = txItemsFilterForConcern(className, rowId);
  if (!f) return null;
  return `${basePath}/transactions/items?${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`;
}

/**
 * Link back to the transaction chains list filtered by the given concern.
 */
export function txConcernFilterLink(basePath: string, className: string, rowId: number): string {
  return `${basePath}/transactions?class_name=${encodeURIComponent(className)}&row_id=${encodeURIComponent(String(rowId))}`;
}

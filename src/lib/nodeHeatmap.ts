export interface HeatmapNode {
  fqdn?: unknown;
  type?: unknown;
  maintenance_lock?: unknown;
}

/** Same eligibility and per-FQDN path as legacy page_index.php. */
export function nodeHeatmapUrl(baseUrl: unknown, node: HeatmapNode): string | null {
  if (node.type !== 'node' && node.type !== 'storage') return null;
  if (node.maintenance_lock !== 'no') return null;
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) return null;
  if (typeof node.fqdn !== 'string' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(node.fqdn)) return null;
  if (node.fqdn.includes('..')) return null;
  try {
    const base = new URL(baseUrl.trim());
    // Heatmaps run in HTTPS UI deployments; do not embed mixed content or credentials.
    if (base.protocol !== 'https:' || base.username || base.password) return null;
    base.search = '';
    base.hash = '';
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/${node.fqdn}/`;
    return base.href;
  } catch {
    return null;
  }
}

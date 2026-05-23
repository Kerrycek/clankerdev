import { extractConcernRefs } from './concerns';
import type { ObjectKind, ObjectRef } from './objectRef';
import { objectRef, objectRefKey } from './objectRef';

function normalizeClassName(v: unknown): string {
  return String(v ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * Best-effort mapping of transaction chain concern class names to ObjectKind.
 *
 * The backend may emit Ruby class names with namespaces (e.g. "VpsAdmin::Vps"),
 * or nested classes (e.g. "IpAddress::Base"). We keep this mapping tolerant
 * but conservative.
 */
export function objectKindFromConcernClassName(className: string): ObjectKind | null {
  const norm = normalizeClassName(className);

  // Prefer exact matches.
  if (norm === 'vps') return 'Vps';
  if (norm === 'dataset') return 'Dataset';
  if (norm === 'dnszone') return 'DnsZone';
  if (norm === 'node') return 'Node';
  if (norm === 'migrationplan') return 'MigrationPlan';
  if (norm === 'user') return 'User';
  if (norm === 'ipaddress') return 'IpAddress';

  // Allow namespaced matches (e.g. vpsadminvps) and nested classes.
  if (norm.endsWith('vps')) return 'Vps';
  if (norm.endsWith('dataset')) return 'Dataset';
  if (norm.endsWith('dnszone')) return 'DnsZone';
  if (norm.endsWith('node')) return 'Node';
  if (norm.endsWith('migrationplan')) return 'MigrationPlan';
  if (norm.endsWith('user')) return 'User';

  // IpAddress sometimes comes as IpAddress::Base.
  if (norm.endsWith('ipaddress') || norm.endsWith('ipaddressbase')) return 'IpAddress';

  return null;
}

/**
 * Extract ObjectRef entries from a `transaction_chain.concerns` payload.
 *
 * This is used for best-effort cache invalidation on async completion.
 */
export function objectRefsFromConcerns(
  concerns: unknown,
  opts?: {
    maxDepth?: number;
    /** Maximum number of ObjectRefs returned (prevents pathological invalidation). */
    max?: number;
  }
): ObjectRef[] {
  const maxDepth = typeof opts?.maxDepth === 'number' ? opts.maxDepth : 3;
  const max = typeof opts?.max === 'number' ? opts.max : 12;

  const out: ObjectRef[] = [];
  const seen = new Set<string>();

  for (const c of extractConcernRefs(concerns, { maxDepth })) {
    const kind = objectKindFromConcernClassName(String(c.class_name));
    if (!kind) continue;

    try {
      const ref = objectRef(kind, c.row_id);
      const key = objectRefKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
      if (out.length >= max) break;
    } catch {
      // Ignore invalid ids.
    }
  }

  return out;
}

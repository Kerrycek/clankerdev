export interface ConcernRef {
  class_name: string;
  row_id: number;
  label?: string;
  /** Raw object from the API (for debugging). */
  raw?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function coerceInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  if (isRecord(v)) {
    // Some API shapes include refs as objects like { id: 123 }.
    const id = (v as LegacyAny)['id'];
    if (id !== undefined) return coerceInt(id);
  }
  return null;
}

function coerceString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : null;
  }
  return null;
}

function pickLabel(obj: Record<string, unknown>): string | undefined {
  return (
    coerceString(obj['label']) ??
    coerceString(obj['name']) ??
    coerceString(obj['hostname']) ??
    undefined
  );
}

/**
 * Best-effort extraction of transaction_chain.concerns entries.
 *
 * The API describes `concerns` as Custom. In practice it is often a list of
 * objects that include `class_name` and `row_id`, but we try to be tolerant.
 */
export function extractConcernRefs(concerns: unknown, opts?: { maxDepth?: number }): ConcernRef[] {
  const maxDepth = typeof opts?.maxDepth === 'number' ? opts.maxDepth : 3;
  const out: ConcernRef[] = [];
  const seen = new Set<string>();

  const push = (className: unknown, rowId: unknown, label: string | undefined, raw: unknown) => {
    const cls = coerceString(className);
    const rid = coerceInt(rowId);
    if (!cls || rid === null || rid <= 0) return;
    const key = `${cls}:${rid}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ class_name: cls, row_id: rid, label, raw });
  };

  const walk = (node: unknown, depth: number) => {
    if (depth > maxDepth) return;

    if (Array.isArray(node)) {
      // Common shape: tuple entries like ['Vps', 123] or ['Vps', 123, 'label'].
      if (node.length >= 2 && typeof node[0] === 'string') {
        const label = typeof node[2] === 'string' && node[2].trim() ? node[2].trim() : undefined;
        push(node[0], node[1], label, node);
      }
      for (const item of node) walk(item, depth + 1);
      return;
    }

    if (!isRecord(node)) return;

    // Common shapes:
    // { class_name: 'Vps', row_id: 123, label: '...' }
    // { className: 'Vps', rowId: 123 }
    // { class: 'Vps', id: 123 }
    const label = pickLabel(node);
    push(node['class_name'] ?? node['className'] ?? node['class'], node['row_id'] ?? node['rowId'] ?? node['id'], label, node);

    // Explore nested objects for other concerns.
    for (const v of Object.values(node)) {
      if (Array.isArray(v) || isRecord(v)) walk(v, depth + 1);
    }
  };

  walk(concerns, 0);
  return out;
}

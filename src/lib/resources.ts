/**
 * Utilities for working with HaveAPI "resource references".
 *
 * Many endpoints return nested objects for foreign keys, e.g.:
 *   { id: 10, login: 'root' }
 *
 * …or sometimes just an id.
 */

function parsePositiveId(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return undefined;
    const i = Math.floor(raw);
    return i > 0 ? i : undefined;
  }

  if (typeof raw === 'string') {
    const t = raw.trim().replace(/^#/, '');
    if (!t) return undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    const i = Math.floor(n);
    return i > 0 ? i : undefined;
  }

  return undefined;
}

export function resourceId(ref: unknown): number | undefined {
  if (ref === null || ref === undefined) return undefined;

  const direct = parsePositiveId(ref);
  if (direct !== undefined) return direct;

  if (typeof ref === 'object') {
    const id = parsePositiveId((ref as any).id);
    return id;
  }

  return undefined;
}

export function refLabel(ref: unknown): string | undefined {
  if (ref === null || ref === undefined) return undefined;

  if (typeof ref === 'string') {
    const t = ref.trim();
    return t ? t : undefined;
  }

  if (typeof ref === 'number') {
    const id = parsePositiveId(ref);
    return id !== undefined ? `#${id}` : undefined;
  }

  if (typeof ref === 'object') {
    const obj = ref as any;

    const keys = ['label', 'name', 'login', 'hostname', 'domain_name', 'fqdn'];
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }

    const id = parsePositiveId(obj?.id);
    if (id !== undefined) return `#${id}`;

    return undefined;
  }

  return undefined;
}

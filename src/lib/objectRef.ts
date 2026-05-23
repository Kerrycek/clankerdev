export type ObjectKind =
  | 'Vps'
  | 'Dataset'
  | 'DnsZone'
  | 'DnsResolver'
  | 'Node'
  | 'Network'
  | 'MigrationPlan'
  | 'User'
  | 'IpAddress';

export interface ObjectRef {
  kind: ObjectKind;
  id: number;
}

export function isObjectKind(v: unknown): v is ObjectKind {
  return (
    v === 'Vps' ||
    v === 'Dataset' ||
    v === 'DnsZone' ||
    v === 'DnsResolver' ||
    v === 'Node' ||
    v === 'Network' ||
    v === 'MigrationPlan' ||
    v === 'User' ||
    v === 'IpAddress'
  );
}

export function normalizeObjectId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

export function objectRef(kind: ObjectKind, id: unknown): ObjectRef {
  const n = normalizeObjectId(id);
  if (n === null) {
    throw new Error(`Invalid object id: ${String(id)}`);
  }
  return { kind, id: n };
}

export function objectRefKey(ref: ObjectRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function parseObjectRefKey(key: string): ObjectRef | null {
  const raw = String(key ?? '');
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;

  const kind = raw.slice(0, idx);
  const idRaw = raw.slice(idx + 1);

  if (!isObjectKind(kind)) return null;
  const id = normalizeObjectId(idRaw);
  if (id === null) return null;

  return { kind, id };
}

export function normalizeObjectRef(raw: unknown): ObjectRef | null {
  if (!raw) return null;

  // Accept serialized form "Kind:123".
  if (typeof raw === 'string') return parseObjectRefKey(raw);

  if (typeof raw !== 'object') return null;
  const anyRaw = raw as any;

  // Accept { key: "Kind:123" }.
  if (typeof anyRaw.key === 'string') {
    return parseObjectRefKey(anyRaw.key);
  }

  const kind = anyRaw.kind;
  const id = normalizeObjectId(anyRaw.id);
  if (!isObjectKind(kind) || id === null) return null;

  return { kind, id };
}

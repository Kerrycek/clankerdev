export const UNSUPPORTED_EXPORT_LIST_URL_KEYS = [
  'q',
  'enabled',
  'dataset',
  'snapshot',
  'host_ip_address',
] as const;

export type ExportSmartKey = 'id' | 'user' | 'unsupported';

export function parseExportListUserId(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const match = /^#?(\d+)$/.exec(raw);
  if (!match?.[1]) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeExportListSearchParams(searchParams: URLSearchParams, allowUserFilter: boolean) {
  const next = new URLSearchParams(searchParams);

  for (const key of UNSUPPORTED_EXPORT_LIST_URL_KEYS) next.delete(key);
  if (!allowUserFilter) {
    next.delete('user');
  } else if (next.has('user')) {
    const userId = parseExportListUserId(next.get('user'));
    if (userId === null) next.delete('user');
    else next.set('user', String(userId));
  }

  const changed = next.toString() !== searchParams.toString();
  if (changed) {
    next.delete('from_id');
    next.set('page', '1');
  }

  return { changed, searchParams: next };
}

export function canonicalExportSmartKey(raw: string): ExportSmartKey | null {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return null;

  if (['id', '#', 'export'].includes(key)) return 'id';
  if (['user', 'owner', 'login'].includes(key)) return 'user';
  if (
    [
      'q',
      'query',
      'search',
      'text',
      'enabled',
      'active',
      'state',
      'dataset',
      'ds',
      'snapshot',
      'snap',
      'host',
      'address',
      'host_ip_address',
    ].includes(key)
  ) {
    return 'unsupported';
  }

  return null;
}

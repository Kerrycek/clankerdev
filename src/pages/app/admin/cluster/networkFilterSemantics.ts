const unsupportedNetworkIndexParams = ['q', 'ip_version', 'role', 'managed'] as const;

export function normalizeLegacyNetworkSearch(searchParams: URLSearchParams): {
  changed: boolean;
  searchParams: URLSearchParams;
} {
  const next = new URLSearchParams(searchParams);
  let changed = false;

  for (const key of unsupportedNetworkIndexParams) {
    if (!next.has(key)) continue;
    next.delete(key);
    changed = true;
  }

  if (changed) {
    next.delete('from_id');
    next.set('page', '1');
  }

  return { changed, searchParams: next };
}

export interface NormalizedLegacyMigrationPlansUrl {
  changed: boolean;
  href: string;
}

export function updateMigrationPlanFilterSearchParams(input: {
  searchParams: URLSearchParams;
  state: string;
  user: string;
}): URLSearchParams | null {
  const next = new URLSearchParams(input.searchParams);
  if (input.state) next.set('state', input.state);
  else next.delete('state');

  const user = input.user.trim();
  if (user) next.set('user', user);
  else next.delete('user');

  return next.toString() === input.searchParams.toString() ? null : next;
}

function hrefWithSearch(path: string, searchParams: URLSearchParams): string {
  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Remove the text-search parameter once advertised by the new UI even though
 * MigrationPlan::Index never supported it. Reset keyset pagination at the
 * same time so the canonical URL cannot reopen an unrelated stale page.
 */
export function normalizeLegacyMigrationPlansUrl(input: {
  basePath: string;
  searchParams: URLSearchParams;
}): NormalizedLegacyMigrationPlansUrl {
  const path = `${input.basePath}/migration-plans`;

  if (!input.searchParams.has('q')) {
    return {
      changed: false,
      href: hrefWithSearch(path, input.searchParams),
    };
  }

  const normalized = new URLSearchParams(input.searchParams);
  normalized.delete('q');
  normalized.delete('from_id');
  normalized.delete('page');

  return {
    changed: true,
    href: hrefWithSearch(path, normalized),
  };
}

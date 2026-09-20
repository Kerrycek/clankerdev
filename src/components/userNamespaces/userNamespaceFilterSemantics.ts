import type { UserRole } from '../../lib/roles';

export type UserNamespaceIndexKind = 'namespace' | 'map';

export interface NormalizedUserNamespaceUrl {
  changed: boolean;
  href: string;
}

function validResourceId(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function canFilterUserNamespaceOwners(input: {
  viewerRole: UserRole;
  showAdminFields?: boolean;
  fixedOwnerId?: number;
}): boolean {
  return input.viewerRole === 'admin' && Boolean(input.showAdminFields) && !validResourceId(input.fixedOwnerId);
}

function hrefWithSearch(pathname: string, searchParams: URLSearchParams): string {
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function removeInvalidInteger(
  searchParams: URLSearchParams,
  key: string,
  minimum: number
): void {
  const values = searchParams.getAll(key);
  if (values.length === 0) return;
  const value = values[0] ?? '';
  const numeric = Number(value);
  if (
    values.length !== 1 ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(numeric) ||
    numeric < minimum
  ) {
    searchParams.delete(key);
  }
}

/**
 * Canonicalize links created before the exact HaveAPI contracts were known.
 * Pagination is reset whenever a scope/filter is removed so the replacement
 * URL cannot open a cursor belonging to the discarded filter set.
 */
export function normalizeUserNamespaceUrl(input: {
  kind: UserNamespaceIndexKind;
  pathname: string;
  searchParams: URLSearchParams;
  viewerRole: UserRole;
  showAdminFields?: boolean;
  fixedOwnerId?: number;
}): NormalizedUserNamespaceUrl {
  const normalized = new URLSearchParams(input.searchParams);
  const allowOwnerFilters = canFilterUserNamespaceOwners(input);

  normalized.delete('q');
  normalized.delete('search');
  if (!allowOwnerFilters) {
    normalized.delete('user');
  } else {
    removeInvalidInteger(normalized, 'user', 1);
  }

  if (input.kind === 'namespace') {
    normalized.delete('user_namespace');
    normalized.delete('label');
    removeInvalidInteger(normalized, 'size', 1);
    if (!allowOwnerFilters) normalized.delete('block_count');
    else removeInvalidInteger(normalized, 'block_count', 0);
  } else {
    normalized.delete('size');
    normalized.delete('block_count');
    normalized.delete('label');
    removeInvalidInteger(normalized, 'user_namespace', 1);
  }

  const changed = normalized.toString() !== input.searchParams.toString();
  if (changed) {
    normalized.delete('from_id');
    normalized.delete('page');
  }

  return {
    changed,
    href: hrefWithSearch(input.pathname, normalized),
  };
}

import { useQuery } from '@tanstack/react-query';

import { fetchNodes } from '../../../lib/api/nodes';
import { searchUsers } from '../../../lib/api/users';
import { parseNumericToken } from '../../../lib/smartFilter';

import { normalizeVpsListStateFilter } from './vpsListSemantics';

type VpsListFilterKey = 'hostname' | 'node' | 'user' | 'user_namespace_map' | 'location' | 'state' | 'ip' | 'id';

export type VpsListMode = 'app' | 'admin';

export function numericParam(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function canonicalKey(raw: string): VpsListFilterKey | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;

  if (['q', 'host', 'hostname', 'h'].includes(key)) return 'hostname';
  if (['ip', 'addr', 'address'].includes(key)) return 'ip';
  if (['node', 'n'].includes(key)) return 'node';
  if (['user', 'u', 'owner'].includes(key)) return 'user';
  if (['location', 'loc', 'l'].includes(key)) return 'location';
  if (['state', 'status', 's'].includes(key)) return 'state';
  if (['map', 'nsmap', 'user_namespace_map', 'uidmap'].includes(key)) return 'user_namespace_map';
  if (['id', 'vps', '#'].includes(key)) return 'id';

  return null;
}

export function isStateLiteral(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['running', 'stopped', 'stop', 'busy', 'locked', 'failed', 'failure', 'error', 'all'].includes(normalized);
}

export function normalizeVpsListSearchParams(input: URLSearchParams, mode: VpsListMode) {
  const next = new URLSearchParams(input);
  const filterKeys = ['q', 'node', 'user', 'user_namespace_map', 'location', 'state'] as const;
  const q = (next.get('q') ?? '').trim();
  if (q) next.set('q', q);
  else next.delete('q');

  for (const key of ['node', 'user_namespace_map', 'location'] as const) {
    const value = numericParam(next.get(key) ?? '');
    if (value !== undefined) next.set(key, String(value));
    else next.delete(key);
  }

  if (mode === 'admin') {
    const user = numericParam(next.get('user') ?? '');
    if (user !== undefined) next.set('user', String(user));
    else next.delete('user');
  } else {
    next.delete('user');
  }

  const state = normalizeVpsListStateFilter(next.get('state'));
  if (state === 'all') next.delete('state');
  else next.set('state', state);

  if (filterKeys.some((key) => next.get(key) !== input.get(key))) {
    next.delete('from_id');
    next.set('page', '1');
  }

  return { searchParams: next, changed: next.toString() !== input.toString() };
}

export function useVpsListSmartSuggestionQueries(debouncedSmartNeedle: string, mode: VpsListMode) {
  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedSmartNeedle }],
    enabled:
      mode === 'admin' &&
      debouncedSmartNeedle.length >= 2 &&
      debouncedSmartNeedle !== '?' &&
      !debouncedSmartNeedle.includes(':') &&
      !debouncedSmartNeedle.includes(' ') &&
      parseNumericToken(debouncedSmartNeedle) === null,
    queryFn: async () => (await searchUsers({ q: debouncedSmartNeedle, limit: 6 })).data,
    staleTime: 10_000,
  });

  const nodesSuggestQuery = useQuery({
    queryKey: ['nodes', 'index', { limit: 250 }],
    enabled:
      mode === 'admin' &&
      debouncedSmartNeedle.length >= 1 &&
      debouncedSmartNeedle !== '?' &&
      !debouncedSmartNeedle.includes(':') &&
      !debouncedSmartNeedle.includes(' '),
    queryFn: async () => (await fetchNodes({ limit: 250 })).data,
    staleTime: 60_000,
  });

  return { userSuggestQuery, nodesSuggestQuery };
}

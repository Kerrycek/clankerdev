import type { ActionState } from '../../lib/api/actionStates';
import type { OperationVisibility } from '../../lib/operationTaxonomy';
import { classifyActionState } from '../../lib/operationTaxonomy';

export type ActionStateOrder = 'newest' | 'oldest';
export type ActionStateVisibilityFilter = 'all' | OperationVisibility;
export type ActionStateSmartKey = 'q' | 'errors' | 'order' | 'id' | 'visibility';

export const ACTION_STATE_VISIBILITY_FILTERS: ActionStateVisibilityFilter[] = ['all', 'user', 'system', 'admin'];

export function normalizeIds(ids: number[], limit: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of ids) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    const id = Math.floor(n);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

export function canonicalActionStateSmartKey(raw: string): ActionStateSmartKey | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;

  if (['q', 'query', 'label', 'name', 'search', 'text'].includes(k)) return 'q';
  if (['errors', 'error', 'err', 'failed', 'fail'].includes(k)) return 'errors';
  if (['order', 'sort'].includes(k)) return 'order';
  if (['id', '#', 'action', 'action_state', 'action_state_id', 'as'].includes(k)) return 'id';
  if (['visibility', 'scope', 'kind', 'activity'].includes(k)) return 'visibility';
  return null;
}

export function parseBoolToken(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

export function parseOrderToken(value: string): ActionStateOrder | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'newest' || v === 'latest' || v === 'desc' || v === 'down') return 'newest';
  if (v === 'oldest' || v === 'asc' || v === 'up') return 'oldest';
  return null;
}

export function parseVisibilityToken(value: string): ActionStateVisibilityFilter | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'all' || v === 'any' || v === '*') return 'all';
  if (v === 'user' || v === 'users' || v === 'mine' || v === 'human') return 'user';
  if (v === 'system' || v === 'sys' || v === 'background' || v === 'noise') return 'system';
  if (v === 'admin' || v === 'administrator' || v === 'operator') return 'admin';
  return null;
}

export function actionStateVisibilityFromUrl(raw: string | null): ActionStateVisibilityFilter {
  return raw ? parseVisibilityToken(raw) ?? 'all' : 'all';
}

export function actionStateMatchesVisibilityFilter(
  state: ActionState,
  visibility: ActionStateVisibilityFilter,
): boolean {
  if (visibility === 'all') return true;
  return classifyActionState(state).visibility === visibility;
}

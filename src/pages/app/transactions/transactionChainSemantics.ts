import type { ToneVariant } from '../../../components/ui/tone';
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';
import { extractConcernRefs } from '../../../lib/concerns';
import { chainBadgeFromState, type BadgeVariant } from '../../../lib/taskStatus';
import type { TransactionChain } from '../../../lib/api/transactions';

export const CHAIN_STATES = ['staged', 'queued', 'done', 'rollbacking', 'failed', 'fatal', 'resolved'] as const;

export type ChainState = (typeof CHAIN_STATES)[number];
export type SmartKey = 'q' | 'state' | 'errors' | 'class_name' | 'row_id' | 'user' | 'user_session' | 'id';
export type TransactionChainsTranslator = (key: string, params?: Record<string, unknown>) => string;

export interface TransactionChainRow {
  c: TransactionChain;
  pinned: boolean;
}

function variantToSemantic(variant: BadgeVariant): Exclude<ToneVariant, 'muted'> {
  if (variant === 'ok' || variant === 'warn' || variant === 'danger' || variant === 'info' || variant === 'neutral') {
    return variant;
  }
  return 'neutral';
}

export function canonicalKey(raw: string): SmartKey | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;

  if (['q', 'query', 'label', 'name', 'search'].includes(k)) return 'q';
  if (['state', 'st', 'status'].includes(k)) return 'state';
  if (['errors', 'error', 'err', 'failed', 'fail'].includes(k)) return 'errors';
  if (['class', 'class_name', 'concern', 'object', 'type'].includes(k)) return 'class_name';
  if (['row', 'row_id', 'rid', 'concern_id', 'object_id'].includes(k)) return 'row_id';
  if (['user', 'u', 'owner'].includes(k)) return 'user';
  if (['session', 'user_session', 'user_session_id', 'sid'].includes(k)) return 'user_session';
  if (['id', '#', 'chain'].includes(k)) return 'id';
  return null;
}

export function parseBoolToken(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

export function inferChainState(value: string): ChainState | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const exact = CHAIN_STATES.find((s) => String(s).toLowerCase() === v);
  if (exact) return exact;
  const byPrefix = CHAIN_STATES.filter((s) => String(s).toLowerCase().startsWith(v));
  if (byPrefix.length === 1) return byPrefix[0] ?? null;
  return null;
}

export function looksLikeConcernClass(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[A-Z][A-Za-z0-9_:]*$/.test(v);
}

export function parseChainState(value: string | null): ChainState | '' {
  if (!value) return '';
  return (CHAIN_STATES as readonly string[]).includes(value) ? (value as ChainState) : '';
}

export function parseBool(value: string | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function parseChainIdSearch(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const m = t.match(/^#?\s*(\d+)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export function safePositiveNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

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

export function refId(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return Math.floor(n);
    return null;
  }
  if (typeof v === 'object' && v !== null) {
    const obj = v as { id?: unknown };
    if (typeof obj.id === 'number' && Number.isFinite(obj.id)) return Math.floor(obj.id);
    if (typeof obj.id === 'string') {
      const n = Number(obj.id);
      if (Number.isFinite(n)) return Math.floor(n);
    }
  }
  return null;
}

export function getChainId(chain: TransactionChain): number {
  if (typeof chain.id === 'number' && Number.isFinite(chain.id)) return Math.floor(chain.id);
  const n = Number(chain.id);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export function getChainLabel(chain: TransactionChain): string | undefined {
  return typeof chain.label === 'string' && chain.label.trim() ? chain.label : undefined;
}

export function getChainState(chain: TransactionChain): string {
  return typeof chain.state === 'string' ? chain.state : '';
}

export function getChainCreatedAt(chain: TransactionChain): string {
  return typeof chain.created_at === 'string' ? chain.created_at : '';
}

export function getChainConcerns(chain: TransactionChain): unknown {
  return chain.concerns;
}

export function getChainUserRef(chain: TransactionChain): unknown {
  return chain['user'] ?? chain['user_id'] ?? chain['userId'];
}

export function getChainUserSessionRef(chain: TransactionChain): unknown {
  return chain['user_session'] ?? chain['userSession'] ?? chain['user_session_id'] ?? chain['userSessionId'];
}

export function chainRowVariantFromState(state: unknown): TableRowVariant {
  return variantToSemantic(chainBadgeFromState(state).variant);
}

export function chainDotVariantFromState(state: unknown): StatusDotVariant {
  return variantToSemantic(chainBadgeFromState(state).variant);
}

export function chainFilterToneFromState(state: unknown): Exclude<ToneVariant, 'muted'> {
  return variantToSemantic(chainBadgeFromState(state).variant);
}

export function chainMatchesConcern(chain: TransactionChain, className?: string, rowId?: number): boolean {
  if (!className && !rowId) return true;
  const refs = extractConcernRefs(getChainConcerns(chain), { maxDepth: 3 });
  return refs.some((r) => {
    const clsOk = className ? r.class_name === className : true;
    const idOk = rowId ? r.row_id === rowId : true;
    return clsOk && idOk;
  });
}

export function chainMatchesUser(chain: TransactionChain, userId?: number): boolean {
  if (!userId) return true;
  return refId(getChainUserRef(chain)) === userId;
}

export function chainMatchesUserSession(chain: TransactionChain, sessionId?: number): boolean {
  if (!sessionId) return true;
  return refId(getChainUserSessionRef(chain)) === sessionId;
}

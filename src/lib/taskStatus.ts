import { staticT } from './staticI18n';

export type BadgeVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'black';

export interface BadgeSpec {
  variant: BadgeVariant;
  label: string;
}

type Translator = (key: any, vars?: Record<string, unknown>) => string;

function isTranslator(value: unknown): value is Translator {
  return typeof value === 'function';
}

function resolveTranslator(t?: Translator): Translator {
  if (t) return t;
  return (key: any, vars?: Record<string, unknown>) => staticT(String(key), vars);
}

function taskStateLabel(rawState: unknown, t?: Translator): string {
  const tt = resolveTranslator(t);
  const state = String(rawState ?? '').trim().toLowerCase();

  if (state === 'done') return tt('common.done');
  if (state === 'failed') return tt('common.failed');
  if (state === 'fatal') return tt('task_state.fatal');
  if (state === 'failing') return tt('task_state.failing');
  if (state === 'running') return tt('state.running');
  if (state === 'resolved') return tt('state.resolved');
  if (state === 'cancelled' || state === 'canceled') return tt('state.canceled');
  if (state === 'cancelling' || state === 'canceling') return tt('task_state.cancelling');
  if (state === 'rollbacking') return tt('task_state.rollbacking');
  if (state === 'queued') return tt('task_state.queued');
  if (state === 'waiting') return tt('task_state.waiting');
  if (state === 'staged') return tt('task_state.staged');
  if (state === 'unknown' || !state) return tt('state.unknown');

  return String(rawState ?? '').trim() || tt('state.unknown');
}

// ----------------------
// Generic object/runtime states
// ----------------------

/**
 * VPS runtime state (is_running).
 *
 * Spec (P0-2):
 * - running → ok (green)
 * - stopped → danger (red)
 * - unknown → neutral
 */
export function runtimeStateBadge(isRunning: unknown, t: Translator): BadgeSpec {
  if (isRunning === true) return { variant: 'ok', label: t('state.running') };
  if (isRunning === false) return { variant: 'danger', label: t('state.stopped') };
  return { variant: 'neutral', label: t('state.unknown') };
}

/**
 * Generic lifecycle/object_state mapping (spec §3.2.3.1).
 *
 * Used by lifetime-enabled resources (e.g. VPS, User, Dataset).
 */
export function objectStateBadge(objectState: unknown, t: Translator): BadgeSpec {
  const st = String(objectState ?? '').trim();

  // Core object lifetimes (spec §3.2.3.1)
  if (st === 'active') return { variant: 'ok', label: t('state.active') };
  if (st === 'suspended') return { variant: 'warn', label: t('state.suspended') };
  if (st === 'soft_delete' || st === 'soft deleted' || st === 'soft_deleted') return { variant: 'neutral', label: t('state.soft_delete') };
  if (st === 'hard_delete' || st === 'hard deleted' || st === 'hard_deleted') return { variant: 'danger', label: t('state.hard_delete') };
  if (st === 'deleted') return { variant: 'neutral', label: t('state.deleted') };

  // Other common “state” fields used across resources
  if (st === 'inactive') return { variant: 'warn', label: t('state.inactive') };
  if (st === 'maintenance') return { variant: 'warn', label: t('state.maintenance') };

  // Some resources still use a generic string state
  if (st === 'stopped') return { variant: 'danger', label: t('state.stopped') };

  // Unknown / custom state
  if (st) return { variant: 'neutral', label: st };
  return { variant: 'neutral', label: t('state.unknown') };
}

// ----------------------
// Transaction chains
// ----------------------

export function isFinishedChainState(state: unknown): boolean {
  const st = String(state ?? '').trim();
  return ['done', 'failed', 'fatal', 'resolved', 'cancelled', 'canceled'].includes(st);
}

/** A chain is considered "active" (locking) when it is not finished. */
export function isActiveChainState(state: unknown): boolean {
  return !isFinishedChainState(state);
}

/** Convenience helper: return true when any chain in the list is active (not finished). */
export function hasActiveChains(chains: Array<{ state?: unknown }> | undefined): boolean {
  return (chains ?? []).some((c) => isActiveChainState((c as any).state));
}

export function isFailedChainState(state: unknown): boolean {
  return ['failed', 'fatal'].includes(String(state ?? ''));
}

export function chainBadgeFromState(state: unknown, t?: Translator): BadgeSpec {
  const tt = resolveTranslator(t);
  const st = String(state ?? '').trim() || 'unknown';

  // Finished
  if (st === 'done' || st === 'resolved') return { variant: 'ok', label: taskStateLabel(st, tt) };
  if (st === 'failed' || st === 'fatal') return { variant: 'danger', label: taskStateLabel(st, tt) };
  if (st === 'cancelled' || st === 'canceled') return { variant: 'neutral', label: taskStateLabel(st, tt) };
  if (st === 'unknown') return { variant: 'neutral', label: taskStateLabel(st, tt) };

  // Cancellation in progress.
  if (st === 'cancelling' || st === 'canceling') return { variant: 'warn', label: taskStateLabel(st, tt) };

  // Active (in-progress) states should be a consistent “working” color.
  if (st === 'rollbacking') return { variant: 'warn', label: taskStateLabel(st, tt) };
  if (st === 'queued' || st === 'staged') return { variant: 'warn', label: taskStateLabel(st, tt) };

  // If the backend introduces new active states, default them to “working”.
  if (isActiveChainState(st)) return { variant: 'warn', label: taskStateLabel(st, tt) };

  return { variant: 'neutral', label: taskStateLabel(st, tt) };
}

/**
 * Convert TransactionChain.progress/size into a percent.
 *
 * In the API, `progress` is "how many transactions are finished" and `size` is
 * "number of transactions in the chain".
 */
export function chainProgressPercent(c: { progress?: unknown; size?: unknown }): number | null {
  const cur = (c as any)?.progress;
  const total = (c as any)?.size;

  if (typeof cur !== 'number' || typeof total !== 'number' || total <= 0) return null;

  const pct = (cur / total) * 100;
  if (!Number.isFinite(pct)) return null;

  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function chainProgressLabel(c: { progress?: unknown; size?: unknown }): string | null {
  const cur = (c as any)?.progress;
  const total = (c as any)?.size;

  if (typeof cur !== 'number' || typeof total !== 'number' || total <= 0) return null;

  return `${Math.max(0, Math.round(cur))}/${Math.round(total)}`;
}

// ----------------------
// Individual transactions
// ----------------------

/**
 * Transaction state badge.
 *
 * Supports both historical call shapes:
 * - transactionBadge(tx)
 * - transactionBadge(done, success)
 * - transactionBadge(tx, t)
 * - transactionBadge(done, success, t)
 */
export function transactionBadge(
  txOrDone: { done?: unknown; success?: unknown } | unknown,
  successOrTranslator?: unknown,
  maybeTranslator?: Translator
): BadgeSpec {
  const isObj = Boolean(txOrDone) && typeof txOrDone === 'object';
  const doneRaw = isObj ? (txOrDone as any).done : txOrDone;
  const successRaw = isTranslator(successOrTranslator) ? undefined : successOrTranslator;
  const tt = resolveTranslator(isTranslator(successOrTranslator) ? successOrTranslator : maybeTranslator);

  const done = String(doneRaw ?? '').trim() || 'unknown';
  const success = typeof successRaw === 'number' ? (successRaw as number) : null;

  // Finished
  if (done === 'done') {
    if (success === 1) return { variant: 'ok', label: tt('common.done') };
    if (success === 0) return { variant: 'danger', label: tt('common.failed') };
    return { variant: 'neutral', label: tt('common.done') };
  }

  // Some backends use explicit failure states.
  if (done === 'failed' || done === 'fatal') return { variant: 'danger', label: taskStateLabel(done, tt) };

  // Unknown
  if (done === 'unknown') return { variant: 'neutral', label: tt('state.unknown') };

  // In progress / queued / waiting
  return { variant: 'warn', label: taskStateLabel(done, tt) };
}

// ----------------------
// Action states
// ----------------------

export function isFinishedActionState(s: { finished?: unknown }): boolean {
  return Boolean((s as any).finished);
}

export function isFailingActionState(s: { status?: unknown }): boolean {
  return (s as any).status === false;
}

export function actionStateBadge(s: { finished?: unknown; status?: unknown }, t?: Translator): BadgeSpec {
  const tt = resolveTranslator(t);

  if (isFinishedActionState(s)) {
    return isFailingActionState(s) ? { variant: 'danger', label: tt('common.failed') } : { variant: 'ok', label: tt('common.done') };
  }

  // Active action states should use the same “working” color across the UI.
  if (isFailingActionState(s)) return { variant: 'danger', label: tt('task_state.failing') };
  return { variant: 'warn', label: tt('state.running') };
}

export function actionStateProgressPercent(s: { current?: unknown; total?: unknown }): number | null {
  const cur = (s as any).current;
  const total = (s as any).total;
  if (typeof cur !== 'number' || typeof total !== 'number' || total <= 0) return null;
  const p = (cur / total) * 100;
  if (!Number.isFinite(p)) return null;
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function actionStateProgressLabel(s: { current?: unknown; total?: unknown; unit?: unknown }): string | null {
  const cur = (s as any).current;
  const total = (s as any).total;
  const unit = typeof (s as any).unit === 'string' ? ((s as any).unit as string) : '';
  if (typeof cur !== 'number' || typeof total !== 'number') return null;
  const u = unit ? ` ${unit}` : '';
  return `${cur}/${total}${u}`;
}

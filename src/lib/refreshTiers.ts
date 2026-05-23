import { useDocumentVisibility } from './useDocumentVisibility';

// Refresh tier constants (ms)
//
// These values should be used instead of ad-hoc refetchInterval numbers.
// See: docs/spec/LIVE_UPDATES_STRATEGY.md

export const TIER_A_VISIBLE_MS = 5000;
export const TIER_A_HIDDEN_MS = 20000;

// Tier B – Detail surfaces (moderate)
//
// Used for:
// - object detail pages (transaction chains, recent activity)
// - admin detail pages where data should feel live but is not mission-critical
//
// Target latency:
// - update within ~15s while visible

export const TIER_B_VISIBLE_MS = 15000;
export const TIER_B_HIDDEN_MS = 60000;

// Tier C – Slower detail surfaces
//
// Used for:
// - secondary status tables
// - user session lists
//
// Target latency:
// - update within ~30s while visible

export const TIER_C_VISIBLE_MS = 30000;
export const TIER_C_HIDDEN_MS = 120000;

// Tier Slow – Low-frequency surfaces
//
// Used for:
// - public status indexes
// - heavier metrics/status lists
//
// Target latency:
// - update within ~60s while visible

export const TIER_SLOW_VISIBLE_MS = 60000;
export const TIER_SLOW_HIDDEN_MS = 300000;

export const ACTION_STATE_POLL_VISIBLE_MS = 3000;
export const ACTION_STATE_POLL_HIDDEN_MS = 10000;

// Fast poll – used for a small number of blocking/interactive wait loops
// (e.g. blocking progress modal) where a slightly faster cadence improves UX.

export const FAST_POLL_VISIBLE_MS = 2000;
export const FAST_POLL_HIDDEN_MS = 5000;

export function tierAIntervalMs(docVisible: boolean): number {
  return docVisible ? TIER_A_VISIBLE_MS : TIER_A_HIDDEN_MS;
}

export function tierBIntervalMs(docVisible: boolean): number {
  return docVisible ? TIER_B_VISIBLE_MS : TIER_B_HIDDEN_MS;
}

export function tierCIntervalMs(docVisible: boolean): number {
  return docVisible ? TIER_C_VISIBLE_MS : TIER_C_HIDDEN_MS;
}

export function tierSlowIntervalMs(docVisible: boolean): number {
  return docVisible ? TIER_SLOW_VISIBLE_MS : TIER_SLOW_HIDDEN_MS;
}

export function actionStatePollIntervalMs(docVisible: boolean): number {
  return docVisible ? ACTION_STATE_POLL_VISIBLE_MS : ACTION_STATE_POLL_HIDDEN_MS;
}

export function fastPollIntervalMs(docVisible: boolean): number {
  return docVisible ? FAST_POLL_VISIBLE_MS : FAST_POLL_HIDDEN_MS;
}

export function useTierAIntervalMs(): number {
  return tierAIntervalMs(useDocumentVisibility());
}

export function useTierBIntervalMs(): number {
  return tierBIntervalMs(useDocumentVisibility());
}

export function useTierCIntervalMs(): number {
  return tierCIntervalMs(useDocumentVisibility());
}

export function useTierSlowIntervalMs(): number {
  return tierSlowIntervalMs(useDocumentVisibility());
}

export function useActionStatePollIntervalMs(): number {
  return actionStatePollIntervalMs(useDocumentVisibility());
}

export function useFastPollIntervalMs(): number {
  return fastPollIntervalMs(useDocumentVisibility());
}

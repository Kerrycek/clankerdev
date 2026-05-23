import { describe, expect, it } from 'vitest';

import {
  ACTION_STATE_POLL_HIDDEN_MS,
  ACTION_STATE_POLL_VISIBLE_MS,
  FAST_POLL_HIDDEN_MS,
  FAST_POLL_VISIBLE_MS,
  TIER_A_HIDDEN_MS,
  TIER_A_VISIBLE_MS,
  TIER_B_HIDDEN_MS,
  TIER_B_VISIBLE_MS,
  TIER_C_HIDDEN_MS,
  TIER_C_VISIBLE_MS,
  TIER_SLOW_HIDDEN_MS,
  TIER_SLOW_VISIBLE_MS,
  actionStatePollIntervalMs,
  fastPollIntervalMs,
  tierAIntervalMs,
  tierBIntervalMs,
  tierCIntervalMs,
  tierSlowIntervalMs,
} from './refreshTiers';

describe('refresh tiers', () => {
  it('tier A intervals match constants', () => {
    expect(tierAIntervalMs(true)).toBe(TIER_A_VISIBLE_MS);
    expect(tierAIntervalMs(false)).toBe(TIER_A_HIDDEN_MS);
    expect(TIER_A_HIDDEN_MS).toBeGreaterThan(TIER_A_VISIBLE_MS);
  });

  it('tier B intervals match constants', () => {
    expect(tierBIntervalMs(true)).toBe(TIER_B_VISIBLE_MS);
    expect(tierBIntervalMs(false)).toBe(TIER_B_HIDDEN_MS);
    expect(TIER_B_HIDDEN_MS).toBeGreaterThan(TIER_B_VISIBLE_MS);
  });

  it('tier C intervals match constants', () => {
    expect(tierCIntervalMs(true)).toBe(TIER_C_VISIBLE_MS);
    expect(tierCIntervalMs(false)).toBe(TIER_C_HIDDEN_MS);
    expect(TIER_C_HIDDEN_MS).toBeGreaterThan(TIER_C_VISIBLE_MS);
  });

  it('slow tier intervals match constants', () => {
    expect(tierSlowIntervalMs(true)).toBe(TIER_SLOW_VISIBLE_MS);
    expect(tierSlowIntervalMs(false)).toBe(TIER_SLOW_HIDDEN_MS);
    expect(TIER_SLOW_HIDDEN_MS).toBeGreaterThan(TIER_SLOW_VISIBLE_MS);
  });

  it('action state poll intervals match constants', () => {
    expect(actionStatePollIntervalMs(true)).toBe(ACTION_STATE_POLL_VISIBLE_MS);
    expect(actionStatePollIntervalMs(false)).toBe(ACTION_STATE_POLL_HIDDEN_MS);
    expect(ACTION_STATE_POLL_HIDDEN_MS).toBeGreaterThan(ACTION_STATE_POLL_VISIBLE_MS);
  });

  it('fast poll intervals match constants', () => {
    expect(fastPollIntervalMs(true)).toBe(FAST_POLL_VISIBLE_MS);
    expect(fastPollIntervalMs(false)).toBe(FAST_POLL_HIDDEN_MS);
    expect(FAST_POLL_HIDDEN_MS).toBeGreaterThan(FAST_POLL_VISIBLE_MS);
  });
});

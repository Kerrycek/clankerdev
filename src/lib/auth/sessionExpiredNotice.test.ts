import { describe, expect, it } from 'vitest';

import { consumeSessionExpiredNotice, markSessionExpiredNotice } from './sessionExpiredNotice';

describe('sessionExpiredNotice', () => {
  it('consumes a fresh session-expired marker exactly once', () => {
    markSessionExpiredNotice(1_000);

    expect(consumeSessionExpiredNotice(1_500)).toBe(true);
    expect(consumeSessionExpiredNotice(1_500)).toBe(false);
  });

  it('ignores stale markers', () => {
    markSessionExpiredNotice(1_000);

    expect(consumeSessionExpiredNotice(1_000 + 10 * 60 * 1000)).toBe(false);
  });
});

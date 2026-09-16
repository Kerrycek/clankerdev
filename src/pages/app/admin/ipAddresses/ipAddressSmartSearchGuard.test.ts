import { describe, expect, test } from 'vitest';

import {
  isIpAddressSmartFeedbackCurrent,
  shouldCancelIpAddressLookup,
} from './ipAddressSmartSearchGuard';

describe('shouldCancelIpAddressLookup', () => {
  test('keeps a lookup started after the current URL commit when its passive effect runs late', () => {
    const currentSignature = 'limit=50&version=4&assigned_to_interface=1&user=48&page=1';

    expect(shouldCancelIpAddressLookup(currentSignature, currentSignature)).toBe(false);
  });

  test('cancels a lookup when the URL advances beyond its starting signature', () => {
    expect(
      shouldCancelIpAddressLookup(
        'limit=50&user=48&page=1',
        'limit=50&user=48&version=6&page=1'
      )
    ).toBe(true);
  });

  test('keeps lookup feedback when a late effect observes the same URL', () => {
    const currentSignature = 'limit=50&page=1';

    expect(
      isIpAddressSmartFeedbackCurrent(currentSignature, currentSignature)
    ).toBe(true);
  });

  test('discards lookup feedback after a real URL change', () => {
    expect(
      isIpAddressSmartFeedbackCurrent(
        'limit=50&page=1',
        'limit=50&page=1&version=6'
      )
    ).toBe(false);
    expect(isIpAddressSmartFeedbackCurrent(null, 'limit=50&page=1')).toBe(false);
  });
});

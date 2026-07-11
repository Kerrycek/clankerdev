import { describe, expect, it } from 'vitest';

import { requestReviewActions } from './RequestReviewActions';

describe('requestReviewActions', () => {
  it('keeps decided requests editable for admins', () => {
    expect(requestReviewActions({ id: 1, state: 'approved' }, true)).toEqual([
      'deny',
      'ignore',
      'request_correction',
    ]);
    expect(requestReviewActions({ id: 2, state: 'denied' }, true)).toEqual([
      'approve',
      'ignore',
      'request_correction',
    ]);
    expect(requestReviewActions({ id: 3, state: 'ignored' }, true)).toEqual([
      'approve',
      'deny',
      'request_correction',
    ]);
  });

  it('does not expose review actions outside admin mode', () => {
    expect(requestReviewActions({ id: 4, state: 'denied' }, false)).toEqual([]);
  });
});

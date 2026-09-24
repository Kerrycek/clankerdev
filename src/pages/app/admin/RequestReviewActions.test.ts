import { describe, expect, it } from 'vitest';

import { requestReviewActions } from './RequestReviewActions';
import {
  requestBulkReviewActions,
  requestCanEnterBulkReview,
  requestMissingRequiredUser,
  requestNodeSupportsTemplate,
  safePositiveInteger,
} from './RequestReviewModel';

describe('requestReviewActions', () => {
  it.each([
    ['approved', ['deny', 'ignore', 'request_correction']],
    ['denied', ['approve', 'ignore', 'request_correction']],
    ['ignored', ['approve', 'deny', 'request_correction']],
    ['pending_correction', ['approve', 'deny', 'ignore']],
  ])('allows revisiting %s registrations without repeating the same state', (state, actions) => {
    expect(requestReviewActions('registration', { id: 1, state }, true)).toEqual(actions);
  });

  it('fails closed for unknown states', () => {
    expect(requestReviewActions('registration', { id: 5 }, true)).toEqual([]);
    expect(requestReviewActions('registration', { id: 5, state: 'unknown' }, true)).toEqual([]);
  });

  it('does not strand change requests in a correction state applicants cannot resubmit', () => {
    expect(requestReviewActions('change', { id: 4, state: 'awaiting', user: { id: 42 } }, true)).toEqual([
      'approve',
      'deny',
      'ignore',
    ]);
    expect(requestReviewActions('change', { id: 5, state: 'approved' }, true)).toEqual([]);
  });

  it('keeps orphaned change requests read-only without blocking new registrations', () => {
    const orphan = { id: 5, state: 'awaiting', user: null, raw_user_id: 42 };
    const newRegistration = { id: 6, state: 'awaiting', user: null };
    expect(requestMissingRequiredUser('change', orphan)).toBe(true);
    expect(requestReviewActions('change', orphan, true)).toEqual([]);
    expect(requestMissingRequiredUser('registration', newRegistration)).toBe(false);
    expect(requestReviewActions('registration', newRegistration, true)).toEqual([
      'approve',
      'deny',
      'ignore',
      'request_correction',
    ]);
    expect(requestReviewActions('registration', orphan, true)).toEqual([]);
    expect(requestReviewActions('change', { ...orphan, user: { id: 1.5 } }, true)).toEqual([]);
    expect(requestReviewActions('change', { ...orphan, user: { id: Number.MAX_SAFE_INTEGER + 1 } }, true)).toEqual([]);
  });

  it('offers the complete registration decision set while awaiting', () => {
    expect(requestReviewActions('registration', { id: 6, state: 'awaiting' }, true)).toEqual([
      'approve',
      'deny',
      'ignore',
      'request_correction',
    ]);
  });

  it('admits only awaiting requests with a safe action into bulk review', () => {
    expect(requestBulkReviewActions('registration', { id: 6, state: 'awaiting' }, true)).toEqual([
      'deny',
      'ignore',
      'request_correction',
    ]);
    expect(requestBulkReviewActions('change', { id: 7, state: 'awaiting', user: { id: 42 } }, true)).toEqual([
      'approve',
      'deny',
      'ignore',
    ]);

    for (const state of ['approved', 'denied', 'ignored', 'pending_correction']) {
      expect(requestBulkReviewActions('registration', { id: 8, state }, true)).toEqual([]);
    }
    expect(requestBulkReviewActions('change', { id: 9, state: 'awaiting', user: null, raw_user_id: 42 }, true)).toEqual([]);
    expect(requestBulkReviewActions('change', { id: 10, state: 'awaiting', user: { id: 42 } }, false)).toEqual([]);
    expect(requestCanEnterBulkReview('change', { id: 11, state: 'awaiting', user: { id: 42 } }, true, false)).toBe(true);
    expect(requestCanEnterBulkReview('change', { id: 11, state: 'awaiting', user: { id: 42 } }, true, true)).toBe(false);
  });

  it('does not expose review actions outside admin mode', () => {
    expect(requestReviewActions('registration', { id: 7, state: 'denied' }, false)).toEqual([]);
  });

  it('accepts only exact positive integer resource ids', () => {
    expect(safePositiveInteger('9')).toBe(9);
    expect(safePositiveInteger('2.9')).toBeUndefined();
    expect(safePositiveInteger('1e3')).toBeUndefined();
    expect(safePositiveInteger('9007199254740992')).toBeUndefined();
  });

  it('offers explicit nodes only when cgroup compatibility is proven', () => {
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_v2' },
      { cgroup_version: 'cgroup_v2' },
    )).toBe(true);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'v1' },
      { cgroup_version: 'cgroup_v2' },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { id: 9 },
      { cgroup_version: 'cgroup_any' },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_v1' },
      { id: 5 },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_invalid' },
      { cgroup_version: 'cgroup_any' },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_invalid' },
      { cgroup_version: 'cgroup_invalid' },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_any' },
      { cgroup_version: 'cgroup_any' },
    )).toBe(false);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_v2' },
      { cgroup_version: 'cgroup_any' },
    )).toBe(true);
    expect(requestNodeSupportsTemplate(
      { cgroup_version: 'cgroup_v2' },
      { cgroup_version: 'cgroup_any', supported: false },
    )).toBe(false);
  });
});

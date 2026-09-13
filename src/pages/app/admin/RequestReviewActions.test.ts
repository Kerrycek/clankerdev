import { describe, expect, it } from 'vitest';

import { requestReviewActions } from './RequestReviewActions';
import { requestNodeSupportsTemplate, safePositiveInteger } from './RequestReviewModel';

describe('requestReviewActions', () => {
  it('fails closed once a request is no longer awaiting review', () => {
    expect(requestReviewActions('registration', { id: 1, state: 'approved' }, true)).toEqual([]);
    expect(requestReviewActions('registration', { id: 2, state: 'denied' }, true)).toEqual([]);
    expect(requestReviewActions('registration', { id: 3, state: 'ignored' }, true)).toEqual([]);
    expect(requestReviewActions('registration', { id: 4, state: 'pending_correction' }, true)).toEqual([]);
    expect(requestReviewActions('registration', { id: 5 }, true)).toEqual([]);
  });

  it('does not strand change requests in a correction state applicants cannot resubmit', () => {
    expect(requestReviewActions('change', { id: 4, state: 'awaiting' }, true)).toEqual([
      'approve',
      'deny',
      'ignore',
    ]);
    expect(requestReviewActions('change', { id: 5, state: 'approved' }, true)).toEqual([]);
  });

  it('offers the complete registration decision set only while awaiting', () => {
    expect(requestReviewActions('registration', { id: 6, state: 'awaiting' }, true)).toEqual([
      'approve',
      'deny',
      'ignore',
      'request_correction',
    ]);
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

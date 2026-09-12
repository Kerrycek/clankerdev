import { describe, expect, it } from 'vitest';

import {
  fraudCheckStatus,
  inferRequestReviewType,
  isResolvedRequestReviewState,
  requestMatchesReviewTarget,
  requestResourceLabel,
  safeRequestsReturnTo,
} from './RequestDetailModel';

describe('inferRequestReviewType', () => {
  it('distinguishes request payloads and fails closed for ambiguous shapes', () => {
    expect(inferRequestReviewType({ id: 1, login: 'alice', ip_fraud_score: 10 })).toBe('registration');
    expect(inferRequestReviewType({ id: 2, change_reason: 'Moved' })).toBe('change');
    expect(inferRequestReviewType({ id: 3, type: 'registration', change_reason: 'unexpected' })).toBe('registration');
    expect(inferRequestReviewType({ id: 4, login: 'alice', change_reason: 'ambiguous' })).toBeNull();
    expect(inferRequestReviewType({ id: 5, full_name: 'Not enough evidence' })).toBeNull();
    expect(inferRequestReviewType({
      id: 6,
      login: null,
      year_of_birth: null,
      os_template: null,
      location: null,
      ip_fraud_score: null,
      mail_fraud_score: null,
    })).toBeNull();
  });
});

describe('requestMatchesReviewTarget', () => {
  const registration = { id: 42, state: 'awaiting', login: 'alice' };

  it('requires the exact subtype, id and optional state', () => {
    expect(requestMatchesReviewTarget(registration, 'registration', 42)).toBe(true);
    expect(requestMatchesReviewTarget(registration, 'registration', 42, 'awaiting')).toBe(true);
    expect(requestMatchesReviewTarget(registration, 'registration', 41)).toBe(false);
    expect(requestMatchesReviewTarget(registration, 'change', 42)).toBe(false);
    expect(requestMatchesReviewTarget(registration, 'registration', 42, 'approved')).toBe(false);
  });

  it('rejects malformed ids instead of coercing them to another target', () => {
    expect(requestMatchesReviewTarget({ ...registration, id: '42.5' }, 'registration', 42)).toBe(false);
    expect(requestMatchesReviewTarget({ ...registration, id: true }, 'registration', 1)).toBe(false);
    expect(requestMatchesReviewTarget({ ...registration, id: undefined }, 'registration', 42)).toBe(false);
  });
});

describe('isResolvedRequestReviewState', () => {
  it.each(['approved', 'denied', 'ignored', 'pending_correction'])('accepts terminal state %s', (state) => {
    expect(isResolvedRequestReviewState(state)).toBe(true);
  });

  it.each(['awaiting', '', undefined, 'unknown'])('rejects non-terminal state %s', (state) => {
    expect(isResolvedRequestReviewState(state)).toBe(false);
  });
});

describe('safeRequestsReturnTo', () => {
  it('preserves overview filters', () => {
    expect(safeRequestsReturnTo('/admin/requests?state=ignored&type=registration#results', '/admin')).toBe(
      '/admin/requests?state=ignored&type=registration#results',
    );
  });

  it('fails closed for external URLs and detail routes', () => {
    expect(safeRequestsReturnTo('https://example.test/admin/requests', '/admin')).toBe('/admin/requests');
    expect(safeRequestsReturnTo('//example.test/admin/requests', '/admin')).toBe('/admin/requests');
    expect(safeRequestsReturnTo('/admin/requests/registration/12', '/admin')).toBe('/admin/requests');
    expect(safeRequestsReturnTo('/app/requests', '/admin')).toBe('/admin/requests');
  });
});

describe('fraudCheckStatus', () => {
  it('distinguishes pending, failed, and successful checks', () => {
    expect(fraudCheckStatus(undefined, undefined)).toBe('pending');
    expect(fraudCheckStatus(false, true)).toBe('pending');
    expect(fraudCheckStatus(true, false)).toBe('failed');
    expect(fraudCheckStatus(true, true)).toBe('success');
  });
});

describe('requestResourceLabel', () => {
  it('prefers human-readable resource attributes and falls back to id', () => {
    expect(requestResourceLabel({ id: 3, label: 'Prague' })).toBe('Prague');
    expect(requestResourceLabel({ id: 4, code: 'cs' })).toBe('cs');
    expect(requestResourceLabel({ id: 5 })).toBe('#5');
    expect(requestResourceLabel(undefined)).toBe('—');
  });
});

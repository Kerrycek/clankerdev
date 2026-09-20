import { describe, expect, test } from 'vitest';

import {
  parsePaymentHistoryId,
  paymentHistoryDateBoundary,
  paymentHistoryMonths,
} from './PaymentHistoryModel';

describe('PaymentHistoryModel', () => {
  test('accepts positive integer IDs with an optional hash', () => {
    expect(parsePaymentHistoryId('42')).toBe(42);
    expect(parsePaymentHistoryId(' #42 ')).toBe(42);
    expect(parsePaymentHistoryId('0')).toBeUndefined();
    expect(parsePaymentHistoryId('4.2')).toBeUndefined();
    expect(parsePaymentHistoryId('member')).toBeUndefined();
  });

  test('calculates the same rounded average-month duration as the legacy UI', () => {
    expect(paymentHistoryMonths('2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z')).toBe(3);
    expect(paymentHistoryMonths('invalid', '2026-04-01T00:00:00Z')).toBeUndefined();
    expect(paymentHistoryMonths('2026-04-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBeUndefined();
  });

  test('normalizes date filters to inclusive account-time-zone boundaries', () => {
    expect(paymentHistoryDateBoundary('2026-09-20')).toBe('2026-09-20T00:00:00.000Z');
    expect(paymentHistoryDateBoundary('2026-09-20', true)).toBe('2026-09-20T23:59:59.999Z');
    expect(paymentHistoryDateBoundary('2026-09-20', false, 'Europe/Prague')).toBe('2026-09-19T22:00:00.000Z');
    expect(paymentHistoryDateBoundary('2026-09-20', true, 'Europe/Prague')).toBe('2026-09-20T21:59:59.999Z');
    expect(paymentHistoryDateBoundary('2026-03-29', true, 'Europe/Prague')).toBe('2026-03-29T21:59:59.999Z');
    expect(paymentHistoryDateBoundary('2026-02-30')).toBeUndefined();
    expect(paymentHistoryDateBoundary('20. 9. 2026')).toBeUndefined();
    expect(paymentHistoryDateBoundary('2026-09-20', false, 'Not/A_Zone')).toBeUndefined();
  });
});

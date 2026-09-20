import { describe, expect, test } from 'vitest';

import {
  parsePaymentHistoryId,
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
});

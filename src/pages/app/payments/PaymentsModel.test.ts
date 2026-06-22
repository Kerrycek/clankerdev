import { describe, expect, test } from 'vitest';

import {
  buildManualPaymentPreview,
  buildPaymentSettingsReview,
  normalizePaymentInstructions,
  paidUntilSubtitleToken,
  parsePositiveInt,
  resourceRefLabel,
} from './PaymentsModel';

describe('PaymentsModel', () => {
  test('parsePositiveInt accepts positive numbers and floors decimals', () => {
    expect(parsePositiveInt('3')).toBe(3);
    expect(parsePositiveInt('3.9')).toBe(3);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
  });

  test('paidUntilSubtitleToken maps status to translation descriptors', () => {
    expect(paidUntilSubtitleToken({ status: 'overdue' })).toEqual({
      kind: 'text',
      key: 'payments.my.stat.paid_until.missing',
    });
    expect(paidUntilSubtitleToken({ status: 'overdue', days: -4 })).toEqual({
      kind: 'plural',
      key: 'payments.my.stat.paid_until.expired',
      count: 4,
    });
    expect(paidUntilSubtitleToken({ status: 'paid', days: 12 })).toEqual({
      kind: 'plural',
      key: 'payments.my.stat.paid_until.in_days',
      count: 12,
    });
  });

  test('resourceRefLabel prefers login and includes numeric id', () => {
    expect(resourceRefLabel({ id: 7, login: 'alice' })).toBe('alice (#7)');
    expect(resourceRefLabel({ id: 8, label: 'Alice Example' })).toBe('Alice Example (#8)');
    expect(resourceRefLabel({ id: 9 })).toBe('#9');
    expect(resourceRefLabel(undefined)).toBe('—');
  });

  test('normalizes payment instructions safely', () => {
    expect(normalizePaymentInstructions({ instructions: '  VS: 42\n' })).toBe('VS: 42');
    expect(normalizePaymentInstructions(undefined)).toBe('');
  });

  test('buildPaymentSettingsReview flags backward and cleared paid-until changes', () => {
    expect(
      buildPaymentSettingsReview({
        currentMonthly: 100,
        nextMonthly: 100,
        currentPaidUntil: '2026-04-01T00:00:00.000Z',
        nextPaidUntilIso: '2026-03-01T00:00:00.000Z',
      })
    ).toMatchObject({
      monthlyChanged: false,
      paidUntilChanged: true,
      hasChanges: true,
      movesPaidUntilBackward: true,
      clearsPaidUntil: false,
    });

    expect(
      buildPaymentSettingsReview({
        currentMonthly: 100,
        nextMonthly: 120,
        currentPaidUntil: '2026-04-01T00:00:00.000Z',
        nextPaidUntilIso: null,
      })
    ).toMatchObject({
      monthlyChanged: true,
      paidUntilChanged: true,
      clearsPaidUntil: true,
    });
  });

  test('buildManualPaymentPreview validates monthly payment and months', () => {
    expect(buildManualPaymentPreview({ monthlyPayment: undefined, rawMonths: '1' })).toMatchObject({
      canSubmit: false,
      validationKey: 'admin.user.payments.add_payment.validation.no_monthly_payment',
    });
    expect(buildManualPaymentPreview({ monthlyPayment: 100, rawMonths: '0' })).toMatchObject({
      canSubmit: false,
      validationKey: 'admin.user.payments.add_payment.validation.months',
    });
    expect(buildManualPaymentPreview({ monthlyPayment: 100, rawMonths: '3' })).toEqual({
      months: 3,
      amount: 300,
      canSubmit: true,
    });
  });
});

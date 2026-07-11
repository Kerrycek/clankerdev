import { describe, expect, test } from 'vitest';

import {
  buildIncomingPaymentAssignReview,
  buildIncomingPaymentReviewSearchTargets,
  buildIncomingPaymentStateReview,
  buildIncomingPaymentsReconciliationSummary,
  canonicalIncomingPaymentSmartKey,
  describeIncomingPaymentState,
  formatIncomingPaymentMoney,
  incomingPaymentAccountedAmountLabel,
  incomingPaymentReceivedAmountLabel,
  incomingPaymentStateFilterOptions,
  incomingPaymentUserLabel,
  normalizeIncomingPaymentState,
  parseIncomingPaymentStateValue,
  parsePositivePaymentId,
} from './IncomingPaymentsModel';

const payment = {
  id: 300,
  state: 'unmatched',
  amount: 1000,
  currency: 'CZK',
  src_amount: 40,
  src_currency: 'EUR',
};

describe('IncomingPaymentsModel', () => {
  test('normalizes incoming payment states and filter options', () => {
    expect(incomingPaymentStateFilterOptions()).toEqual(['', 'queued', 'unmatched', 'processed', 'ignored']);
    expect(normalizeIncomingPaymentState(' PROCESSED ')).toBe('processed');
    expect(normalizeIncomingPaymentState('unknown')).toBe('');
    expect(parseIncomingPaymentStateValue('any')).toBe('');
    expect(parseIncomingPaymentStateValue('ignored')).toBe('ignored');
    expect(parseIncomingPaymentStateValue('bad')).toBeNull();
  });

  test('maps smart filter keys to canonical domains', () => {
    expect(canonicalIncomingPaymentSmartKey('tx')).toBe('q');
    expect(canonicalIncomingPaymentSmartKey('transaction_id')).toBe('q');
    expect(canonicalIncomingPaymentSmartKey('st')).toBe('state');
    expect(canonicalIncomingPaymentSmartKey('u')).toBe('user');
    expect(canonicalIncomingPaymentSmartKey('weird')).toBeNull();
  });

  test('parses positive payment ids', () => {
    expect(parsePositivePaymentId('42')).toBe(42);
    expect(parsePositivePaymentId('42.9')).toBe(42);
    expect(parsePositivePaymentId('0')).toBeUndefined();
    expect(parsePositivePaymentId('abc')).toBeUndefined();
  });

  test('formats incoming payment labels', () => {
    expect(formatIncomingPaymentMoney(1000, 'CZK')).toMatch(/1/);
    expect(formatIncomingPaymentMoney(1.25, 'TOKEN')).toBe('1.25 TOKEN');
    expect(incomingPaymentUserLabel({ id: 7, login: 'alice' })).toBe('alice');
    expect(incomingPaymentUserLabel({ id: 8 })).toBe('#8');
    expect(incomingPaymentReceivedAmountLabel(payment)).toMatch(/40/);
    expect(incomingPaymentAccountedAmountLabel(payment)).toMatch(/1/);
  });

  test('builds assignment review with validation and processed-state hint', () => {
    expect(buildIncomingPaymentAssignReview({ payment, rawUserId: '' })).toMatchObject({
      userId: null,
      canSubmit: false,
      validationKey: 'payments.incoming.review.assign.validation.missing_user',
      marksProcessed: true,
    });

    expect(buildIncomingPaymentAssignReview({ payment, rawUserId: '123' })).toMatchObject({
      userId: 123,
      canSubmit: true,
      marksProcessed: true,
    });

    expect(buildIncomingPaymentAssignReview({ payment: { ...payment, user: { id: 123, login: 'alice' } }, rawUserId: '456' })).toMatchObject({
      canSubmit: false,
      alreadyAssigned: true,
      validationKey: 'payments.incoming.review.assign.validation.already_assigned',
    });
  });

  test('builds state review impact, warnings and confirmation gates', () => {
    expect(buildIncomingPaymentStateReview({ payment, nextState: 'unmatched' })).toMatchObject({
      hasChange: false,
      canSubmit: false,
      impactKey: 'payments.incoming.review.state.no_change',
    });

    expect(buildIncomingPaymentStateReview({ payment, nextState: 'processed' })).toMatchObject({
      hasChange: true,
      canSubmit: true,
      badgeVariant: 'warn',
      warningKey: 'payments.incoming.review.state.warning.processed_without_user',
    });

    expect(buildIncomingPaymentStateReview({ payment, nextState: 'ignored' })).toMatchObject({
      hasChange: true,
      canSubmit: true,
      warningKey: 'payments.incoming.review.state.warning.ignored',
    });

    expect(
      buildIncomingPaymentStateReview({
        payment: { ...payment, user: { id: 123, login: 'alice' } },
        nextState: 'processed',
      })
    ).toMatchObject({
      canSubmit: true,
      badgeVariant: 'ok',
    });
  });

  test('summarizes reconciliation state for the current page', () => {
    expect(
      buildIncomingPaymentsReconciliationSummary([
        { ...payment, id: 1, state: 'queued' },
        { ...payment, id: 2, state: 'unmatched' },
        { ...payment, id: 3, state: 'processed' },
        { ...payment, id: 4, state: 'processed', user: { id: 7, login: 'alice' } },
        { ...payment, id: 5, state: 'ignored' },
        { ...payment, id: 6, state: 'unexpected' },
      ])
    ).toEqual({
      total: 6,
      queued: 1,
      unmatched: 1,
      processed: 2,
      ignored: 1,
      unknown: 1,
      assigned: 1,
      unassigned: 5,
      needsReview: 2,
      processedWithoutUser: 1,
    });
  });

  test('describes reconciliation state and review search targets', () => {
    expect(describeIncomingPaymentState({ state: 'processed' })).toMatchObject({
      badgeVariant: 'warn',
      explanationKey: 'payments.incoming.reconcile.state.processed_unassigned.explanation',
      warningKey: 'payments.incoming.reconcile.state.processed_unassigned.warning',
    });

    expect(describeIncomingPaymentState({ state: 'processed', user: { id: 7, login: 'alice' } })).toMatchObject({
      badgeVariant: 'ok',
      explanationKey: 'payments.incoming.reconcile.state.processed.explanation',
      warningKey: undefined,
    });

    expect(
      buildIncomingPaymentReviewSearchTargets({
        ...payment,
        vs: '123456',
        transaction_id: 'TX-300',
        account_name: 'Main account',
        user_ident: 'VS:123456',
      }).map((target) => `${target.key}:${target.value}`)
    ).toEqual(['vs:123456', 'transaction:TX-300', 'account:Main account', 'ident:VS:123456']);
  });
});

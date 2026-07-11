import { describe, expect, test } from 'vitest';

import {
  buildIncomingPaymentBulkReview,
  incomingPaymentBulkActionTargetState,
  normalizeIncomingPaymentBulkAction,
  selectIncomingPaymentNeedsReviewIds,
} from './IncomingPaymentsBulkModel';

const rows = [
  { id: 1, state: 'queued' },
  { id: 2, state: 'unmatched' },
  { id: 3, state: 'processed' },
  { id: 4, state: 'unmatched', user: { id: 10, login: 'alice' } },
  { id: 5, state: 'unexpected' },
];

describe('IncomingPaymentsBulkModel', () => {
  test('normalizes actions and target states', () => {
    expect(normalizeIncomingPaymentBulkAction('mark_ignored')).toBe('mark_ignored');
    expect(normalizeIncomingPaymentBulkAction('bad')).toBe('mark_unmatched');
    expect(incomingPaymentBulkActionTargetState('mark_queued')).toBe('queued');
    expect(incomingPaymentBulkActionTargetState('mark_processed')).toBe('processed');
  });

  test('builds an ignore review without typed confirmation', () => {
    const review = buildIncomingPaymentBulkReview({
      rows,
      selectedIds: [1, 2, 3, 4, 5, 999],
      action: 'mark_ignored',
    });

    expect(review).toMatchObject({
      targetState: 'ignored',
      selectedCount: 6,
      eligibleIds: [1, 2, 3],
      eligibleCount: 3,
      skippedAssigned: 1,
      skippedUnknownState: 1,
      skippedMissing: 1,
      requiresConfirmation: true,
      confirmationTarget: undefined,
      confirmationMatches: true,
      canSubmit: true,
    });
  });

  test('allows processed state but highlights unassigned processed risk', () => {
    const review = buildIncomingPaymentBulkReview({
      rows,
      selectedIds: [1, 4],
      action: 'mark_processed',
    });

    expect(review).toMatchObject({
      targetState: 'processed',
      eligibleIds: [1, 4],
      unassignedProcessedCount: 1,
      requiresConfirmation: true,
      confirmationTarget: undefined,
      canSubmit: true,
    });
  });

  test('skips already-target rows and selects visible review candidates', () => {
    expect(
      buildIncomingPaymentBulkReview({
        rows,
        selectedIds: [1, 2, 2],
        action: 'mark_unmatched',
      })
    ).toMatchObject({
      selectedCount: 2,
      eligibleIds: [1],
      skippedAlreadyTarget: 1,
      canSubmit: true,
    });

    expect(selectIncomingPaymentNeedsReviewIds(rows)).toEqual([1, 2]);
  });
});

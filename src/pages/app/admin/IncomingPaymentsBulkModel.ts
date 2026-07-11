import type { IncomingPayment } from '../../../lib/api/payments';
import { normalizeIncomingPaymentState, type KnownIncomingPaymentState } from './IncomingPaymentsModel';

export const INCOMING_PAYMENT_BULK_ACTIONS = [
  'mark_unmatched',
  'mark_queued',
  'mark_ignored',
  'mark_processed',
] as const;

export type IncomingPaymentBulkAction = (typeof INCOMING_PAYMENT_BULK_ACTIONS)[number];

export type IncomingPaymentBulkReview = {
  action: IncomingPaymentBulkAction;
  targetState: KnownIncomingPaymentState;
  selectedCount: number;
  eligibleIds: number[];
  eligibleCount: number;
  skippedMissing: number;
  skippedAssigned: number;
  skippedAlreadyTarget: number;
  skippedUnknownState: number;
  unassignedProcessedCount: number;
  requiresConfirmation: boolean;
  confirmationTarget?: string;
  confirmationMatches: boolean;
  canSubmit: boolean;
};

export function incomingPaymentBulkActionOptions(): IncomingPaymentBulkAction[] {
  return [...INCOMING_PAYMENT_BULK_ACTIONS];
}

export function isIncomingPaymentBulkAction(value: unknown): value is IncomingPaymentBulkAction {
  return INCOMING_PAYMENT_BULK_ACTIONS.includes(String(value ?? '') as IncomingPaymentBulkAction);
}

export function normalizeIncomingPaymentBulkAction(value: unknown): IncomingPaymentBulkAction {
  const v = String(value ?? '').trim();
  return isIncomingPaymentBulkAction(v) ? v : 'mark_unmatched';
}

export function incomingPaymentBulkActionTargetState(action: IncomingPaymentBulkAction): KnownIncomingPaymentState {
  if (action === 'mark_queued') return 'queued';
  if (action === 'mark_ignored') return 'ignored';
  if (action === 'mark_processed') return 'processed';
  return 'unmatched';
}

function normalizeSelectedIds(ids: Iterable<number>): number[] {
  return Array.from(new Set(Array.from(ids).filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.floor(id))));
}

function bulkActionNeedsReview(targetState: KnownIncomingPaymentState, eligibleCount: number, unassignedProcessedCount: number): boolean {
  if (eligibleCount <= 0) return false;
  if (targetState === 'ignored') return true;
  if (targetState === 'processed' && unassignedProcessedCount > 0) return true;
  return false;
}

export function buildIncomingPaymentBulkReview(input: {
  rows: IncomingPayment[];
  selectedIds: Iterable<number>;
  action: IncomingPaymentBulkAction;
}): IncomingPaymentBulkReview {
  const targetState = incomingPaymentBulkActionTargetState(input.action);
  const selectedIds = normalizeSelectedIds(input.selectedIds);
  const rowsById = new Map(input.rows.map((row) => [row.id, row]));

  const eligibleIds: number[] = [];
  let skippedMissing = 0;
  let skippedAssigned = 0;
  let skippedAlreadyTarget = 0;
  let skippedUnknownState = 0;
  let unassignedProcessedCount = 0;

  for (const id of selectedIds) {
    const row = rowsById.get(id);
    if (!row) {
      skippedMissing += 1;
      continue;
    }

    const currentState = normalizeIncomingPaymentState(row.state);
    if (!currentState) {
      skippedUnknownState += 1;
      continue;
    }

    if (currentState === targetState) {
      skippedAlreadyTarget += 1;
      continue;
    }

    const assigned = Boolean(row.user);
    if (assigned && targetState !== 'processed') {
      skippedAssigned += 1;
      continue;
    }

    if (!assigned && targetState === 'processed') unassignedProcessedCount += 1;
    eligibleIds.push(id);
  }

  const confirmationTarget = undefined;
  const requiresConfirmation = bulkActionNeedsReview(targetState, eligibleIds.length, unassignedProcessedCount);
  const confirmationMatches = true;

  return {
    action: input.action,
    targetState,
    selectedCount: selectedIds.length,
    eligibleIds,
    eligibleCount: eligibleIds.length,
    skippedMissing,
    skippedAssigned,
    skippedAlreadyTarget,
    skippedUnknownState,
    unassignedProcessedCount,
    requiresConfirmation,
    confirmationTarget,
    confirmationMatches,
    canSubmit: eligibleIds.length > 0,
  };
}

export function selectIncomingPaymentNeedsReviewIds(rows: IncomingPayment[]): number[] {
  return rows
    .filter((row) => !row.user)
    .filter((row) => {
      const state = normalizeIncomingPaymentState(row.state);
      return state === 'queued' || state === 'unmatched';
    })
    .map((row) => row.id);
}

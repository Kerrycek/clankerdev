import React, { useMemo, useState } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Select } from '../../../components/ui/Select';
import type { IncomingPayment } from '../../../lib/api/payments';
import { incomingPaymentStateLabelKey } from '../../../lib/paymentsBadges';
import {
  buildIncomingPaymentBulkReview,
  incomingPaymentBulkActionOptions,
  normalizeIncomingPaymentBulkAction,
  selectIncomingPaymentNeedsReviewIds,
  type IncomingPaymentBulkAction,
  type IncomingPaymentBulkReview,
} from './IncomingPaymentsBulkModel';

function skippedTotal(review: IncomingPaymentBulkReview): number {
  return review.skippedAlreadyTarget + review.skippedAssigned + review.skippedMissing + review.skippedUnknownState;
}

export function IncomingPaymentsBulkActions(props: {
  rows: IncomingPayment[];
  selectedIds: ReadonlySet<number>;
  action: IncomingPaymentBulkAction;
  applying: boolean;
  onActionChange: (action: IncomingPaymentBulkAction) => void;
  onReplaceSelection: (ids: number[]) => void;
  onClearSelection: () => void;
  onApply: (review: IncomingPaymentBulkReview) => Promise<void>;
}) {
  const { t } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(false);

  const selectedIds = useMemo(() => Array.from(props.selectedIds), [props.selectedIds]);
  const review = useMemo(
    () =>
      buildIncomingPaymentBulkReview({
        rows: props.rows,
        selectedIds,
        action: props.action,
      }),
    [props.action, props.rows, selectedIds]
  );

  const needsReviewIds = useMemo(() => selectIncomingPaymentNeedsReviewIds(props.rows), [props.rows]);
  const allVisibleIds = useMemo(() => props.rows.map((row) => row.id), [props.rows]);
  const skipped = skippedTotal(review);

  return (
    <Card testId="admin.payments.incoming.bulk.card">
      <CardHeader
        title={t('payments.incoming.bulk.title')}
        subtitle={t('payments.incoming.bulk.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => props.onReplaceSelection(needsReviewIds)}
              disabled={needsReviewIds.length === 0}
              testId="admin.payments.incoming.bulk.select_needs_review"
            >
              {t('payments.incoming.bulk.select_needs_review')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => props.onReplaceSelection(allVisibleIds)}
              disabled={allVisibleIds.length === 0}
              testId="admin.payments.incoming.bulk.select_visible"
            >
              {t('payments.incoming.bulk.select_visible')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={props.onClearSelection}
              disabled={review.selectedCount === 0}
              testId="admin.payments.incoming.bulk.clear"
            >
              {t('common.clear')}
            </Button>
          </div>
        }
      />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('payments.incoming.bulk.selected')}</div>
              <div className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
                {review.selectedCount}
                <Badge variant={review.eligibleCount > 0 ? 'info' : 'neutral'}>{t('payments.incoming.bulk.eligible', { count: review.eligibleCount })}</Badge>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('payments.incoming.bulk.action')}</div>
              <Select
                value={props.action}
                onChange={(event) => {
                  props.onActionChange(normalizeIncomingPaymentBulkAction(event.target.value));
                }}
                testId="admin.payments.incoming.bulk.action"
              >
                {incomingPaymentBulkActionOptions().map((action) => (
                  <option key={action} value={action}>
                    {t(`payments.incoming.bulk.action.${action}`)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('payments.incoming.bulk.target_state')}</div>
              <div className="mt-2">
                <Badge variant={review.targetState === 'processed' ? 'ok' : review.targetState === 'ignored' ? 'warn' : 'info'}>
                  {t(incomingPaymentStateLabelKey(review.targetState))}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant={review.requiresConfirmation ? 'danger' : 'primary'}
            onClick={() => {
              setReviewOpen(true);
            }}
            disabled={review.eligibleCount === 0 || props.applying}
            testId="admin.payments.incoming.bulk.review.open"
          >
            {t('payments.incoming.bulk.review_open')}
          </Button>
        </div>

        {review.selectedCount > 0 ? (
          <div className="mt-3 text-xs text-muted" data-testid="admin.payments.incoming.bulk.summary">
            {t('payments.incoming.bulk.summary', {
              eligible: review.eligibleCount,
              skipped,
              already: review.skippedAlreadyTarget,
              assigned: review.skippedAssigned,
              unknown: review.skippedUnknownState,
            })}
          </div>
        ) : (
          <div className="mt-3 text-xs text-muted">{t('payments.incoming.bulk.empty_selection')}</div>
        )}
      </CardBody>

      <ConfirmDialog
        open={reviewOpen}
        title={t('payments.incoming.bulk.review.title')}
        description={t('payments.incoming.bulk.review.description', {
          count: review.eligibleCount,
          state: t(incomingPaymentStateLabelKey(review.targetState)),
        })}
        danger={review.requiresConfirmation}
        confirmLabel={t('payments.incoming.bulk.apply')}
        confirmLoading={props.applying}
        confirmDisabled={!review.canSubmit}
        onCancel={() => {
          if (props.applying) return;
          setReviewOpen(false);
        }}
        onConfirm={async () => {
          await props.onApply(review);
          setReviewOpen(false);
        }}
        testId="admin.payments.incoming.bulk.review"
      >
        <div className="space-y-3">
          {review.requiresConfirmation ? (
            <Alert variant="warn" title={t('payments.incoming.bulk.review.warning.title')} testId="admin.payments.incoming.bulk.review.warning">
              {review.targetState === 'ignored'
                ? t('payments.incoming.bulk.review.warning.ignored')
                : t('payments.incoming.bulk.review.warning.processed_without_user', { count: review.unassignedProcessedCount })}
            </Alert>
          ) : null}

          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="font-medium">{t('payments.incoming.bulk.review.counts')}</div>
            <div className="mt-1 text-xs text-muted">
              {t('payments.incoming.bulk.summary', {
                eligible: review.eligibleCount,
                skipped,
                already: review.skippedAlreadyTarget,
                assigned: review.skippedAssigned,
                unknown: review.skippedUnknownState,
              })}
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

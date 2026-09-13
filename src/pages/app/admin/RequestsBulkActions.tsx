import React, { useState } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import type { ResolveUserRequestAction } from '../../../lib/api/requests';
import { requestActionVariant } from './RequestReviewModel';

const ACTION_ORDER: ResolveUserRequestAction[] = ['approve', 'request_correction', 'deny', 'ignore'];

export function RequestsBulkActions(props: {
  rowsLength: number;
  selectedRowsLength: number;
  action: ResolveUserRequestAction;
  allowedActions: ResolveUserRequestAction[];
  containsRegistration: boolean;
  reason: string;
  needsReason: boolean;
  submitting: boolean;
  targets: Array<{ id: number; type: 'registration' | 'change' }>;
  onActionChange: (action: ResolveUserRequestAction) => void;
  onReasonChange: (reason: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClear: () => void;
  onApply: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [reviewOpen, setReviewOpen] = useState(false);
  const missingReason = props.needsReason && !props.reason.trim();
  const actionAllowed = props.allowedActions.includes(props.action);
  const availableActions = ACTION_ORDER.filter((action) => props.allowedActions.includes(action));

  return (
    <Card className="mb-4" testId="admin.requests.bulk">
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">{t('requests.bulk.title')}</div>
            <div className="mt-0.5 text-sm text-muted">
              {t('requests.bulk.selected', { count: String(props.selectedRowsLength) })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={props.onSelectAll} disabled={props.rowsLength === 0}>
              {t('requests.bulk.select_all')}
            </Button>
            <Button variant="secondary" size="sm" onClick={props.onDeselectAll}>
              {t('requests.bulk.deselect_all')}
            </Button>
            <Button variant="ghost" size="sm" onClick={props.onClear}>
              {t('requests.bulk.cancel_selection')}
            </Button>
          </div>
        </div>

        {props.containsRegistration ? (
          <Alert variant="info" testId="admin.requests.bulk.registration_approve_blocked">
            {t('requests.bulk.registration_approve_blocked')}
          </Alert>
        ) : null}

        {availableActions.length === 0 ? (
          <Alert variant="warn" testId="admin.requests.bulk.no_common_action">
            {t('requests.bulk.no_common_action')}
          </Alert>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[minmax(180px,240px)_1fr_auto]">
          <Select
            value={actionAllowed ? props.action : ''}
            onChange={(event) => props.onActionChange(event.target.value as ResolveUserRequestAction)}
            aria-label={t('requests.bulk.action')}
            disabled={availableActions.length === 0}
            testId="admin.requests.bulk.action"
          >
            {!actionAllowed ? <option value="">{t('requests.bulk.choose_action')}</option> : null}
            {availableActions.map((action) => (
              <option key={action} value={action}>{t(`requests.resolve.action.${action}`)}</option>
            ))}
          </Select>

          <Textarea
            value={props.reason}
            onChange={(event) => props.onReasonChange(event.target.value)}
            rows={1}
            maxLength={500}
            placeholder={t('requests.bulk.reason_placeholder')}
            ariaLabel={t('requests.resolve.reason')}
            ariaInvalid={missingReason}
            ariaDescribedBy={missingReason ? 'admin.requests.bulk.reason.error' : undefined}
            disabled={!props.needsReason}
            className="min-h-9"
            testId="admin.requests.bulk.reason"
          />

          <Button
            variant={actionAllowed ? requestActionVariant(props.action) : 'secondary'}
            onClick={() => setReviewOpen(true)}
            disabled={!actionAllowed || missingReason}
            testId="admin.requests.bulk.apply"
          >
            {t('requests.bulk.review')}
          </Button>
        </div>

        {missingReason ? (
          <div id="admin.requests.bulk.reason.error" className="text-xs text-danger">
            {t('requests.bulk.reason_required')}
          </div>
        ) : null}
      </CardBody>

      <ConfirmDialog
        open={reviewOpen}
        title={t('requests.bulk.confirm.title')}
        description={t('requests.bulk.confirm.description', {
          count: String(props.selectedRowsLength),
          action: t(`requests.resolve.action.${props.action}`),
        })}
        confirmLabel={t('requests.bulk.confirm.apply')}
        confirmVariant={requestActionVariant(props.action)}
        confirmLoading={props.submitting}
        confirmDisabled={!actionAllowed || missingReason}
        onCancel={() => {
          if (!props.submitting) setReviewOpen(false);
        }}
        onConfirm={async () => {
          await props.onApply();
          setReviewOpen(false);
        }}
        testId="admin.requests.bulk.confirm"
      >
        <Alert variant={props.action === 'deny' || props.action === 'ignore' ? 'warn' : 'info'}>
          {t(`requests.bulk.confirm.impact.${props.action}`)}
        </Alert>
        {props.needsReason ? (
          <div className="mt-3 rounded-md border border-border bg-surface-2 p-3" data-testid="admin.requests.bulk.confirm.reason">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('requests.bulk.confirm.reason')}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-sm">{props.reason.trim()}</div>
          </div>
        ) : null}
        <div className="mt-3" data-testid="admin.requests.bulk.confirm.targets">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('requests.bulk.confirm.targets')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {props.targets.slice(0, 8).map((target) => (
              <li key={`${target.type}-${target.id}`}>
                #{target.id} · {t(`requests.type.${target.type}`)}
              </li>
            ))}
          </ul>
          {props.targets.length > 8 ? (
            <div className="mt-1 text-xs text-muted">
              {t('requests.bulk.confirm.more', { count: String(props.targets.length - 8) })}
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </Card>
  );
}

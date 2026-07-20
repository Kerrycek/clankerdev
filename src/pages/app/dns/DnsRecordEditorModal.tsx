import React, { useMemo } from 'react';

import { useI18n } from '../../../app/i18n';

import { ActionButton, type DisabledReason } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

import { formatErrorMessage } from '../../../lib/errors';

import {
  DNS_RECORD_TYPES,
  type DnsRecordDraft,
  type DnsRecordFormField,
  type DnsRecordPreviewItem,
  type DnsRecordValidationIssue,
  type DnsRecordValidationResult,
} from './DnsRecordModel';
import type { DnsRecordApiFieldError } from './DnsRecordErrors';

type DnsRecordDraftPatch = Partial<DnsRecordDraft>;

function messagesByField(errors: readonly DnsRecordApiFieldError[]): Map<DnsRecordFormField, string[]> {
  const out = new Map<DnsRecordFormField, string[]>();
  for (const error of errors) {
    const existing = out.get(error.field) ?? [];
    existing.push(...error.messages);
    out.set(error.field, existing);
  }
  return out;
}

function FieldFeedback(props: {
  field: DnsRecordFormField;
  issues: readonly DnsRecordValidationIssue[];
  apiMessages: readonly string[];
  testId: string;
}) {
  const { t } = useI18n();
  const fieldIssues = props.issues.filter((issue) => issue.field === props.field);
  if (fieldIssues.length === 0 && props.apiMessages.length === 0) return null;

  return (
    <div className="mt-1 space-y-1 text-xs" data-testid={props.testId}>
      {fieldIssues.map((issue, index) => (
        <div key={`${issue.messageKey}.${index}`} className={issue.severity === 'error' ? 'text-danger' : 'text-warn'}>
          {t(issue.messageKey, issue.vars)}
        </div>
      ))}
      {props.apiMessages.map((message, index) => (
        <div key={`${message}.${index}`} className="text-danger">
          {message}
        </div>
      ))}
    </div>
  );
}

export function DnsRecordEditorModal(props: {
  mode: 'create' | 'edit';
  open: boolean;
  draft: DnsRecordDraft;
  validation: DnsRecordValidationResult;
  preview: readonly DnsRecordPreviewItem[];
  apiFieldErrors: readonly DnsRecordApiFieldError[];
  mutationError: unknown;
  mutationErrorTitleKey: string;
  pending: boolean;
  gateAllowed: boolean;
  gateReason?: DisabledReason;
  onDraftChange: (patch: DnsRecordDraftPatch) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const testPrefix = props.mode === 'create' ? 'dns.records.create' : 'dns.records.edit';
  const apiMessages = useMemo(() => messagesByField(props.apiFieldErrors), [props.apiFieldErrors]);
  const summaryIssues = props.validation.issues.filter((issue) => issue.field === 'conflict' || issue.field === 'record');
  const submitDisabled =
    props.validation.hasErrors ||
    !props.gateAllowed ||
    (props.mode === 'edit' && props.preview.length === 0) ||
    props.pending;

  const title = props.mode === 'create' ? t('dns.zone.records.modal.create.title') : t('dns.zone.records.modal.edit.title');

  return (
    <Modal open={props.open} onClose={props.onCancel} title={title} size="lg">
      <div className="space-y-4" data-testid={`${testPrefix}.modal`}>
        {props.mode === 'edit' ? (
          <div className="text-sm text-muted">
            {t('dns.zone.records.modal.edit.subtitle', { name: props.draft.name || t('common.na') })}
          </div>
        ) : null}

        {summaryIssues.length > 0 ? (
          <Alert
            title={props.validation.hasErrors ? t('dns.zone.records.validation.blocked_title') : t('dns.zone.records.validation.warning_title')}
            variant={props.validation.hasErrors ? 'danger' : 'warn'}
            testId={`${testPrefix}.validation.summary`}
          >
            <ul className="list-disc space-y-1 pl-4">
              {summaryIssues.map((issue, index) => (
                <li key={`${issue.messageKey}.${index}`}>{t(issue.messageKey, issue.vars)}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {props.mode === 'create' ? (
          <>
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.name.label')}</div>
              <Input
                value={props.draft.name}
                onChange={(e) => props.onDraftChange({ name: e.target.value })}
                placeholder="www"
                testId="dns.records.create.name"
              />
              <div className="mt-1 text-xs text-faint">{t('dns.zone.records.modal.create.name.help')}</div>
              <FieldFeedback
                field="name"
                issues={props.validation.issues}
                apiMessages={apiMessages.get('name') ?? []}
                testId="dns.records.create.name.validation"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.type.label')}</div>
              <Select value={props.draft.type} onChange={(e) => props.onDraftChange({ type: e.target.value })} testId="dns.records.create.type">
                {DNS_RECORD_TYPES.map((recordType) => (
                  <option key={recordType} value={recordType}>
                    {recordType}
                  </option>
                ))}
              </Select>
              <FieldFeedback
                field="type"
                issues={props.validation.issues}
                apiMessages={apiMessages.get('type') ?? []}
                testId="dns.records.create.type.validation"
              />
            </div>
          </>
        ) : null}

        <div>
          <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.content.label')}</div>
          <Input
            value={props.draft.content}
            onChange={(e) => props.onDraftChange({ content: e.target.value })}
            placeholder={props.draft.type === 'AAAA' ? '2001:db8::1' : props.draft.type === 'CNAME' ? 'target.example.com.' : '1.2.3.4'}
            testId={`${testPrefix}.content`}
          />
          <FieldFeedback
            field="content"
            issues={props.validation.issues}
            apiMessages={apiMessages.get('content') ?? []}
            testId={`${testPrefix}.content.validation`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.ttl.label')}</div>
            <Input
              value={props.draft.ttl}
              onChange={(e) => props.onDraftChange({ ttl: e.target.value })}
              placeholder={props.mode === 'create' ? t('common.default') : '3600'}
              inputMode="numeric"
              testId={`${testPrefix}.ttl`}
            />
            <FieldFeedback
              field="ttl"
              issues={props.validation.issues}
              apiMessages={apiMessages.get('ttl') ?? []}
              testId={`${testPrefix}.ttl.validation`}
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.priority.label')}</div>
            <Input
              value={props.draft.priority}
              onChange={(e) => props.onDraftChange({ priority: e.target.value })}
              placeholder="10"
              inputMode="numeric"
              testId={`${testPrefix}.priority`}
            />
            <FieldFeedback
              field="priority"
              issues={props.validation.issues}
              apiMessages={apiMessages.get('priority') ?? []}
              testId={`${testPrefix}.priority.validation`}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.comment.label')}</div>
          <Input
            value={props.draft.comment}
            onChange={(e) => props.onDraftChange({ comment: e.target.value })}
            placeholder={t('common.optional')}
            testId={`${testPrefix}.comment`}
          />
          <FieldFeedback
            field="comment"
            issues={props.validation.issues}
            apiMessages={apiMessages.get('comment') ?? []}
            testId={`${testPrefix}.comment.validation`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Checkbox
            checked={props.draft.enabled}
            onChange={(enabled) => props.onDraftChange({ enabled })}
            label={t('common.enabled')}
            disabled={props.pending}
            testId={`${testPrefix}.enabled`}
          />
          <Checkbox
            checked={props.draft.dynamicUpdateEnabled}
            onChange={(dynamicUpdateEnabled) => props.onDraftChange({ dynamicUpdateEnabled })}
            label={t('dns.zone.records.modal.create.dynamic.label')}
            disabled={props.pending}
            testId={`${testPrefix}.dynamic`}
          />
        </div>

        {props.mutationError ? (
          <Alert title={t(props.mutationErrorTitleKey)} variant="danger" testId={`${testPrefix}.error`}>
            {formatErrorMessage(props.mutationError)}
          </Alert>
        ) : null}

        {!props.gateAllowed && props.gateReason ? (
          <Alert title={t(props.gateReason.titleKey)} variant="warn" testId={`${testPrefix}.gate`}>
            {props.gateReason.descriptionKey ? t(props.gateReason.descriptionKey) : null}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onCancel} disabled={props.pending} testId={`${testPrefix}.cancel`}>
            {t('common.cancel')}
          </Button>
          <ActionButton
            onClick={props.onSubmit}
            loading={props.pending}
            disabled={submitDisabled}
            disabledReason={!props.gateAllowed ? props.gateReason : undefined}
            testId={`${testPrefix}.submit`}
          >
            {props.pending
              ? props.mode === 'create'
                ? t('common.creating')
                : t('common.saving')
              : props.mode === 'create'
                ? t('common.create')
                : t('common.save')}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}

import React from 'react';

import { useI18n } from '../../../app/i18n';

import type { DnsRecord } from '../../../lib/api/dns';
import type { GateDecision } from '../../../lib/gates/types';

import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../components/ui/tone';

import { recordDynamicEnabled, recordName, type DnsRecordValidationResult } from './DnsRecordModel';

function RecordValidationNotice(props: { validation?: DnsRecordValidationResult; rowError?: string; testId: string }) {
  const { t } = useI18n();
  const firstIssue = props.validation?.issues[0];

  if (!props.rowError && !firstIssue) return null;

  return (
    <div className="mt-2 space-y-2" data-testid={props.testId}>
      {props.rowError ? (
        <Alert title={t('dns.zone.records.row_error.title')} variant="danger">
          {props.rowError}
        </Alert>
      ) : null}
      {firstIssue ? (
        <div className="rounded-md border border-warn-border bg-warn-bg px-2 py-1 text-xs text-muted">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={props.validation?.hasErrors ? 'danger' : 'warn'}>{t('dns.zone.records.validation.needs_review')}</Badge>
            <span>{t(firstIssue.messageKey, firstIssue.vars)}</span>
          </div>
          {props.validation && props.validation.issues.length > 1 ? (
            <div className="text-faint">
              {t('dns.zone.records.validation.more_issues', { count: props.validation.issues.length - 1 })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EnabledBadge(props: { value: unknown }) {
  const { t } = useI18n();
  return props.value === true ? <Badge variant="ok">{t('common.enabled')}</Badge> : <Badge variant="warn">{t('common.disabled')}</Badge>;
}

function YesNoBadge(props: { value: unknown }) {
  const { t } = useI18n();
  return props.value === true ? <Badge variant="ok">{t('common.yes')}</Badge> : <Badge variant="neutral">{t('common.no')}</Badge>;
}

export function DnsRecordsList(props: {
  rows: readonly DnsRecord[];
  validationById: ReadonlyMap<number, DnsRecordValidationResult>;
  rowErrors: ReadonlyMap<number, string>;
  updateGate: GateDecision;
  deleteGate: GateDecision;
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  pageCursor: number | null;
  limit: number;
  allowedLimits: readonly number[];
  onPrev: () => void;
  onNext: (cursor: number | null) => void;
  onGoToPage: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onEdit: (record: DnsRecord) => void;
  onDelete: (record: DnsRecord) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="space-y-3 md:hidden">
        {props.rows.length === 0 ? (
          <Card>
            <div className="p-4 text-center text-sm text-muted">{t('dns.zone.records.empty')}</div>
          </Card>
        ) : (
          props.rows.map((record) => {
            const rowVariant = record.enabled ? 'ok' : 'warn';
            const validation = props.validationById.get(record.id);
            const rowError = props.rowErrors.get(record.id);
            return (
              <Card
                key={record.id}
                testId={`dns.record.card.${record.id}`}
                className={record.enabled ? undefined : toneSurfaceClass('warn')}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusDot variant={rowVariant} testId={`dns.record.card.${record.id}.dot`} />
                        <div className="truncate text-base font-semibold text-fg">{recordName(record)}</div>
                        <Badge variant="neutral">{String(record.type ?? t('common.na'))}</Badge>
                      </div>
                      {record.comment ? <div className="mt-1 text-sm text-muted">{String(record.comment)}</div> : null}
                      <div className="mt-1 text-xs text-faint">#{record.id}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <EnabledBadge value={record.enabled} />
                      <YesNoBadge value={recordDynamicEnabled(record)} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted">
                    <div>
                      <div className="text-faint">{t('dns.zone.records.table.content')}</div>
                      <div className="break-all font-medium text-fg">{String(record.content ?? '')}</div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <div>
                        <div className="text-faint">{t('dns.zone.records.table.ttl')}</div>
                        <div className="font-medium text-fg">{record.ttl != null ? String(record.ttl) : t('common.na')}</div>
                      </div>
                      <div>
                        <div className="text-faint">{t('dns.zone.records.table.priority')}</div>
                        <div className="font-medium text-fg">
                          {record.priority != null ? String(record.priority) : t('common.na')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {record.dynamic_update_url ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-faint">{t('dns.zone.records.field.ddns')}:</span>
                      <CopyButton
                        text={String(record.dynamic_update_url)}
                        label={t('common.copy_link')}
                        size="sm"
                        testId={`dns.record.card.${record.id}.ddns_copy`}
                      />
                    </div>
                  ) : null}

                  <RecordValidationNotice
                    validation={validation}
                    rowError={rowError}
                    testId={`dns.record.card.${record.id}.validation`}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onEdit(record)}
                      disabled={!props.updateGate.allowed}
                      disabledReason={!props.updateGate.allowed ? props.updateGate.reason : undefined}
                      testId={`dns.record.card.${record.id}.edit`}
                    >
                      {t('common.edit')}
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="danger"
                      onClick={() => props.onDelete(record)}
                      disabled={!props.deleteGate.allowed}
                      disabledReason={!props.deleteGate.allowed ? props.deleteGate.reason : undefined}
                      testId={`dns.record.card.${record.id}.delete`}
                    >
                      {t('common.delete')}
                    </ActionButton>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-list">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pl-4 pr-2"><span className="sr-only">{t('nav.status')}</span></th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.name')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.type')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.content')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.ttl')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.priority')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.enabled')}</th>
                <th className="py-2 pr-3">{t('dns.zone.records.table.dynamic')}</th>
                <th className="py-2 pr-4 text-right">{t('dns.zone.records.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-muted">
                    {t('dns.zone.records.empty')}
                  </td>
                </tr>
              ) : (
                props.rows.map((record) => {
                  const rowVariant = record.enabled ? 'ok' : 'warn';
                  const validation = props.validationById.get(record.id);
                  const rowError = props.rowErrors.get(record.id);
                  return (
                    <tr
                      key={record.id}
                      className="border-t border-border"
                      data-row-variant={record.enabled ? undefined : 'warn'}
                      data-testid={`dns.record.row.${record.id}`}
                    >
                      <td className="py-2 pl-4 pr-2">
                        <StatusDot variant={rowVariant} testId={`dns.record.row.${record.id}.dot`} />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-fg">{recordName(record)}</div>
                        {record.comment ? <div className="mt-1 text-xs text-muted">{String(record.comment)}</div> : null}
                        <div className="mt-1 text-xs text-faint">#{record.id}</div>
                        {record.dynamic_update_url ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-faint">{t('dns.zone.records.field.ddns')}:</span>
                            <CopyButton
                              text={String(record.dynamic_update_url)}
                              label={t('common.copy_link')}
                              size="sm"
                              testId={`dns.record.row.${record.id}.ddns_copy`}
                            />
                          </div>
                        ) : null}
                        <RecordValidationNotice
                          validation={validation}
                          rowError={rowError}
                          testId={`dns.record.row.${record.id}.validation`}
                        />
                      </td>
                      <td className="py-2 pr-3">{String(record.type ?? t('common.na'))}</td>
                      <td className="py-2 pr-3">
                        <div className="max-w-content-sm truncate">{String(record.content ?? '')}</div>
                      </td>
                      <td className="py-2 pr-3">{record.ttl != null ? String(record.ttl) : t('common.na')}</td>
                      <td className="py-2 pr-3">{record.priority != null ? String(record.priority) : t('common.na')}</td>
                      <td className="py-2 pr-3"><EnabledBadge value={record.enabled} /></td>
                      <td className="py-2 pr-3"><YesNoBadge value={recordDynamicEnabled(record)} /></td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton
                            size="sm"
                            variant="secondary"
                            onClick={() => props.onEdit(record)}
                            disabled={!props.updateGate.allowed}
                            disabledReason={!props.updateGate.allowed ? props.updateGate.reason : undefined}
                            testId={`dns.record.row.${record.id}.edit`}
                          >
                            {t('common.edit')}
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="danger"
                            onClick={() => props.onDelete(record)}
                            disabled={!props.deleteGate.allowed}
                            disabledReason={!props.deleteGate.allowed ? props.deleteGate.reason : undefined}
                            testId={`dns.record.row.${record.id}.delete`}
                          >
                            {t('common.delete')}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <KeysetPagination
          page={props.page}
          pageCount={props.pageCount}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={() => props.onNext(props.pageCursor)}
          onGoToPage={props.onGoToPage}
          limit={props.limit}
          allowedLimits={props.allowedLimits}
          onLimitChange={props.onLimitChange}
          testId="dns.records.pagination.desktop"
        />
      </Card>

      <div className="md:hidden">
        <Card>
          <KeysetPagination
            page={props.page}
            pageCount={props.pageCount}
            canPrev={props.canPrev}
            canNext={props.canNext}
            onPrev={props.onPrev}
            onNext={() => props.onNext(props.pageCursor)}
            onGoToPage={props.onGoToPage}
            limit={props.limit}
            allowedLimits={props.allowedLimits}
            onLimitChange={props.onLimitChange}
            testId="dns.records.pagination.mobile"
            className="border-t-0"
          />
        </Card>
      </div>
    </>
  );
}

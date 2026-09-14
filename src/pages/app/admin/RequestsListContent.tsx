import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../../../app/i18n';
import { formatDateTime } from '../../../lib/format';
import {
  fraudRiskBadge,
  requestRowVariant,
  requestStateBadgeVariant,
  requestStateLabelKey,
  requestTypeBadgeVariant,
  requestTypeLabelKey,
} from '../../../lib/requestsBadges';
import { dotVariantFromBadgeVariant } from '../../../lib/variantMap';

import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';

import {
  requestDateValue,
  requestId,
  requestKey,
  requestLabel,
  requestState,
  requestType,
  requestUserLabel,
  type UnifiedRequestRow,
} from './RequestsModel';
import { requestMissingRequiredUser } from './RequestReviewModel';

type RequestsPaginationProps = {
  page: number;
  stack: unknown[];
  canPrev: boolean;
  goPrev: () => void;
  goNext: (cursor: number | undefined) => void;
  goToPage: (page: number) => void;
  limit: number;
  allowedLimits: readonly number[];
  setLimit: (limit: number) => void;
};

function RequestPagination(props: {
  pagination: RequestsPaginationProps;
  canNext: boolean;
  pageCursor: number | undefined;
  testId: string;
}) {
  return (
    <KeysetPagination
      page={props.pagination.page}
      pageCount={props.pagination.stack.length}
      canPrev={props.pagination.canPrev}
      canNext={props.canNext}
      onPrev={props.pagination.goPrev}
      onNext={() => props.pagination.goNext(props.pageCursor)}
      onGoToPage={props.pagination.goToPage}
      limit={props.pagination.limit}
      allowedLimits={props.pagination.allowedLimits}
      onLimitChange={props.pagination.setLimit}
      testId={props.testId}
    />
  );
}

function detailHref(basePath: string, request: UnifiedRequestRow, returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `${basePath}/requests/${requestType(request)}/${requestId(request)}?${params.toString()}`;
}

function applicantLabel(request: UnifiedRequestRow): string {
  const linkedUser = requestUserLabel(request);
  if (linkedUser !== '—') return linkedUser;

  if (request._type === 'registration') {
    for (const value of [request.login, request.full_name, request.email]) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return '—';
}

function applicantContext(request: UnifiedRequestRow): string {
  if (request._type === 'registration' && typeof request.email === 'string' && request.email.trim()) {
    return request.email.trim();
  }
  if (request._type === 'change' && typeof request.change_reason === 'string' && request.change_reason.trim()) {
    return request.change_reason.trim();
  }
  return requestLabel(request);
}

export function RequestsListContent(props: {
  rows: UnifiedRequestRow[];
  isAdmin: boolean;
  basePath: string;
  returnTo: string;
  selectionMode: boolean;
  selectedKeys: ReadonlySet<string>;
  lockedRequestIds: ReadonlySet<number>;
  canNext: boolean;
  pageCursor: number | undefined;
  pagination: RequestsPaginationProps;
  onToggleSelected: (key: string, selected: boolean) => void;
  onToggleAllVisible: (selected: boolean) => void;
}) {
  const { t } = useI18n();
  const selectableRows = props.rows.filter((request) => !props.lockedRequestIds.has(requestId(request))
    && !requestMissingRequiredUser(requestType(request), request));
  const allVisibleSelected = selectableRows.length > 0
    && selectableRows.every((request) => props.selectedKeys.has(requestKey(request)));
  const selectedVisibleCount = selectableRows.filter((request) => props.selectedKeys.has(requestKey(request))).length;
  const partiallySelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  return (
    <>
      <div className="space-y-2 md:hidden">
        {props.rows.map((request) => {
          const id = requestId(request);
          const reqType = requestType(request);
          const state = requestState(request);
          const stateVar = requestStateBadgeVariant(state);
          const dotVar = dotVariantFromBadgeVariant(stateVar);
          const risk = request._type === 'registration' ? fraudRiskBadge(request) : null;
          const key = requestKey(request);
          const createdAt = requestDateValue(request, 'created_at');
          const locked = props.lockedRequestIds.has(id);
          const ownerMissing = requestMissingRequiredUser(reqType, request);
          const selectable = !locked && !ownerMissing;
          const card = (
            <Card
              className="p-4 transition-colors hover:border-accent/40"
              testId={`admin.requests.mobile.row.${reqType}.${id}`}
            >
              <div className="flex items-start gap-3">
                {props.selectionMode ? (
                  <input
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-border"
                    type="checkbox"
                    checked={props.selectedKeys.has(key)}
                    disabled={!selectable}
                    title={locked
                      ? t('requests.resolve.in_progress.title')
                      : ownerMissing ? t('requests.resolve.owner_missing.title') : undefined}
                    onChange={(event) => props.onToggleSelected(key, event.target.checked)}
                    aria-label={t('requests.bulk.select_one', { id: String(id) })}
                    data-testid={`admin.requests.bulk.select.mobile.${reqType}.${id}`}
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusDot variant={dotVar} testId={`admin.requests.row.${reqType}.${id}.dot`} />
                    <span className="text-sm font-semibold">#{id}</span>
                    <Badge variant={requestTypeBadgeVariant(reqType)}>{t(requestTypeLabelKey(reqType))}</Badge>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{applicantLabel(request)}</div>
                  {ownerMissing ? (
                    <div className="mt-0.5 text-xs font-medium text-warn" data-testid={`admin.requests.mobile.row.${reqType}.${id}.owner_missing`}>
                      {t('requests.resolve.owner_missing.label')}
                    </div>
                  ) : null}
                  <div className="mt-0.5 truncate text-xs text-muted">{applicantContext(request)}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={stateVar}>{t(requestStateLabelKey(state))}</Badge>
                    {props.isAdmin && risk ? (
                      <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                        {t(risk.labelKey)} {risk.score}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted">{createdAt ? formatDateTime(createdAt) : '—'}</span>
                  </div>
                </div>
              </div>
            </Card>
          );

          return props.selectionMode ? (
            <label key={key} className={!selectable ? 'block cursor-not-allowed' : 'block cursor-pointer'}>
              {card}
            </label>
          ) : (
            <Link
              key={key}
              className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              to={detailHref(props.basePath, request, props.returnTo)}
              aria-label={t('requests.list.open_detail', { id: String(id) })}
            >
              {card}
            </Link>
          );
        })}

        <Card>
          <RequestPagination
            pagination={props.pagination}
            canNext={props.canNext}
            pageCursor={props.pageCursor}
            testId="admin.requests.pagination.mobile"
          />
        </Card>
      </div>

      <TableCard
        className="hidden md:block"
        minWidth="md"
        tableTestId="admin.requests.table"
        footer={
          <RequestPagination
            pagination={props.pagination}
            canNext={props.canNext}
            pageCursor={props.pageCursor}
            testId="admin.requests.pagination.desktop"
          />
        }
      >
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            {props.selectionMode ? (
              <th className="w-10 px-3 py-2">
                <input
                  ref={selectAllRef}
                  className="h-5 w-5 rounded border-border"
                  type="checkbox"
                  checked={allVisibleSelected}
                  aria-checked={partiallySelected ? 'mixed' : allVisibleSelected}
                  disabled={selectableRows.length === 0}
                  onChange={(event) => props.onToggleAllVisible(event.target.checked)}
                  aria-label={t('requests.bulk.select_visible')}
                  data-testid="admin.requests.bulk.select_all"
                />
              </th>
            ) : null}
            <th className="px-3 py-2">{t('common.id')}</th>
            <th className="px-3 py-2">{t('requests.list.col.applicant')}</th>
            <th className="px-3 py-2">{t('common.type')}</th>
            <th className="px-3 py-2">{t('common.state')}</th>
            <th className="px-3 py-2">{t('requests.list.col.received')}</th>
            {props.isAdmin ? <th className="px-3 py-2">{t('requests.list.col.risk')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((request) => {
            const id = requestId(request);
            const reqType = requestType(request);
            const state = requestState(request);
            const rowVar = requestRowVariant(state);
            const stateVar = requestStateBadgeVariant(state);
            const dotVar = dotVariantFromBadgeVariant(stateVar);
            const risk = request._type === 'registration' ? fraudRiskBadge(request) : null;
            const key = requestKey(request);
            const createdAt = requestDateValue(request, 'created_at');
            const locked = props.lockedRequestIds.has(id);
            const ownerMissing = requestMissingRequiredUser(reqType, request);
            const selectable = !locked && !ownerMissing;

            return (
              <TableRowLink
                key={key}
                testId={`admin.requests.row.${reqType}.${id}`}
                to={props.selectionMode ? undefined : detailHref(props.basePath, request, props.returnTo)}
                keyboardNavigation={false}
                variant={rowVar}
                className="border-b border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent last:border-b-0"
              >
                {props.selectionMode ? (
                  <td className="px-3 py-3">
                    <input
                      className="h-4 w-4 rounded border-border"
                      type="checkbox"
                      checked={props.selectedKeys.has(key)}
                      disabled={!selectable}
                      title={locked
                        ? t('requests.resolve.in_progress.title')
                        : ownerMissing ? t('requests.resolve.owner_missing.title') : undefined}
                      onChange={(event) => props.onToggleSelected(key, event.target.checked)}
                      aria-label={t('requests.bulk.select_one', { id: String(id) })}
                      data-testid={`admin.requests.bulk.select.${reqType}.${id}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StatusDot variant={dotVar} testId={`admin.requests.row.${reqType}.${id}.dot`} />
                    {props.selectionMode ? (
                      <span className="font-medium text-accent">#{id}</span>
                    ) : (
                      <Link
                        className="rounded-sm font-medium text-accent focus:outline-none focus:ring-2 focus:ring-accent"
                        to={detailHref(props.basePath, request, props.returnTo)}
                      >
                        #{id}
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="max-w-xs truncate text-sm font-medium">{applicantLabel(request)}</div>
                  {ownerMissing ? (
                    <div className="mt-0.5 text-xs font-medium text-warn" data-testid={`admin.requests.row.${reqType}.${id}.owner_missing`}>
                      {t('requests.resolve.owner_missing.label')}
                    </div>
                  ) : null}
                  <div className="mt-0.5 max-w-xs truncate text-xs text-muted">{applicantContext(request)}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={requestTypeBadgeVariant(reqType)}>{t(requestTypeLabelKey(reqType))}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={stateVar}>{t(requestStateLabelKey(state))}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{createdAt ? formatDateTime(createdAt) : '—'}</td>
                {props.isAdmin ? (
                  <td className="px-3 py-3">
                    {risk ? (
                      <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                        {t(risk.labelKey)} {risk.score}
                      </Badge>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                ) : null}
              </TableRowLink>
            );
          })}
        </tbody>
      </TableCard>
    </>
  );
}

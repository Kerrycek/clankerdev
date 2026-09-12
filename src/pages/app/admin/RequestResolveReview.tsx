import React, { useMemo } from 'react';

import { useI18n } from '../../../app/i18n';
import type { RegistrationRequest, ResolveUserRequestAction } from '../../../lib/api/requests';
import {
  fraudRiskBadge,
  requestStateBadgeVariant,
  requestStateLabelKey,
  requestTypeBadgeVariant,
  requestTypeLabelKey,
} from '../../../lib/requestsBadges';

import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';

import type { RequestResolveOverrides, RequestReviewType, ReviewableRequest } from './RequestReviewTypes';
import type { TouchedRequestOverrides } from './RequestResolveMutation';
import { safePositiveInteger } from './RequestReviewModel';

const NUMERIC_OVERRIDE_KEYS = new Set<keyof RequestResolveOverrides>([
  'yearOfBirth',
  'osTemplate',
  'location',
  'language',
]);

function trimValue(value: string): string {
  return value.trim();
}

function overrideRows(
  reqType: RequestReviewType,
  action: ResolveUserRequestAction,
  overrides: RequestResolveOverrides,
  touched: TouchedRequestOverrides,
) {
  const rows =
    reqType === 'registration'
      ? [
          { key: 'login', labelKey: 'requests.override.login', value: overrides.login },
          { key: 'fullName', labelKey: 'requests.override.full_name', value: overrides.fullName },
          { key: 'orgName', labelKey: 'requests.override.org_name', value: overrides.orgName },
          { key: 'orgId', labelKey: 'requests.override.org_id', value: overrides.orgId },
          { key: 'email', labelKey: 'requests.override.email', value: overrides.email },
          { key: 'address', labelKey: 'requests.override.address', value: overrides.address },
          { key: 'yearOfBirth', labelKey: 'requests.override.year_of_birth', value: overrides.yearOfBirth },
          { key: 'how', labelKey: 'requests.override.how', value: overrides.how },
          { key: 'note', labelKey: 'requests.override.note', value: overrides.note },
          { key: 'osTemplate', labelKey: 'requests.override.os_template', value: overrides.osTemplate },
          { key: 'location', labelKey: 'requests.override.location', value: overrides.location },
          { key: 'currency', labelKey: 'requests.override.currency', value: overrides.currency },
          { key: 'language', labelKey: 'requests.override.language', value: overrides.language },
          { key: 'timeZone', labelKey: 'requests.override.time_zone', value: overrides.timeZone },
        ]
      : [
          { key: 'fullName', labelKey: 'requests.override.full_name', value: overrides.fullName },
          { key: 'email', labelKey: 'requests.override.email', value: overrides.email },
          { key: 'address', labelKey: 'requests.override.address', value: overrides.address },
          { key: 'changeReason', labelKey: 'requests.override.change_reason', value: overrides.changeReason },
        ];

  return rows
    .map((row) => ({ ...row, value: trimValue(row.value) }))
    .filter((row) => action === 'request_correction' || touched.has(row.key as keyof RequestResolveOverrides))
    .filter((row) => {
      const key = row.key as keyof RequestResolveOverrides;
      return !NUMERIC_OVERRIDE_KEYS.has(key) || safePositiveInteger(row.value) !== undefined;
    });
}

function impactKey(reqType: RequestReviewType, action: ResolveUserRequestAction): string {
  if (action === 'approve' && reqType === 'registration') return 'requests.resolve.review.impact.approve_registration';
  if (action === 'approve') return 'requests.resolve.review.impact.approve_change';
  if (action === 'request_correction') return 'requests.resolve.review.impact.request_correction';
  if (action === 'deny') return 'requests.resolve.review.impact.deny';
  return 'requests.resolve.review.impact.ignore';
}

function requestApplicantLabel(request: ReviewableRequest): string | null {
  for (const value of [request.login, request.full_name, request.email]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  if (request.user && typeof request.user === 'object') {
    for (const key of ['login', 'label']) {
      const value = (request.user as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

export function RequestResolveReview(props: {
  request: ReviewableRequest;
  reqType: RequestReviewType;
  reqId: number;
  action: ResolveUserRequestAction;
  reason: string;
  requiresReason: boolean;
  approveCreateVps: boolean;
  approveActivate: boolean;
  approveNode: string;
  overrides: RequestResolveOverrides;
  touchedOverrides: TouchedRequestOverrides;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const state = String(props.request.state ?? '').trim();
  const risk = props.reqType === 'registration' ? fraudRiskBadge(props.request as RegistrationRequest) : null;
  const rows = useMemo(
    () => overrideRows(props.reqType, props.action, props.overrides, props.touchedOverrides),
    [props.action, props.overrides, props.reqType, props.touchedOverrides],
  );
  const nodeLabel = props.approveCreateVps
    ? trimValue(props.approveNode) || t('common.auto')
    : t('requests.resolve.review.node_not_applicable');
  const applicant = requestApplicantLabel(props.request);
  const reason = props.reason.trim();

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-3" data-testid={`${props.testIdPrefix}.review`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{t('requests.resolve.review.title')}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={requestTypeBadgeVariant(props.reqType)}>{t(requestTypeLabelKey(props.reqType))}</Badge>
          <Badge variant={requestStateBadgeVariant(state)}>{t(requestStateLabelKey(state))}</Badge>
        </div>
      </div>

      {risk ? (
        <Alert variant={risk.variant === 'danger' ? 'danger' : 'warn'} title={t('requests.resolve.review.risk.title')} testId={`${props.testIdPrefix}.review.risk`}>
          {t('requests.resolve.review.risk.body', { score: risk.score })}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('requests.resolve.review.target')}</div>
          <div className="mt-1">#{props.reqId}{applicant ? ` · ${applicant}` : ''}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('requests.resolve.review.impact')}</div>
          <div className="mt-1">{t(impactKey(props.reqType, props.action))}</div>
        </div>
        {props.reqType === 'registration' && props.action === 'approve' ? (
          <div className="md:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('requests.resolve.approve.options')}</div>
            <div className="mt-1">
              {t('requests.resolve.review.registration_options', {
                createVps: props.approveCreateVps ? t('common.yes') : t('common.no'),
                activate: props.approveActivate ? t('common.yes') : t('common.no'),
                node: nodeLabel,
              })}
            </div>
          </div>
        ) : null}
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('requests.resolve.review.gates')}</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>{props.requiresReason ? t('requests.resolve.review.reason_required') : t('requests.resolve.review.reason_optional')}</li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('requests.resolve.review.overrides')}</div>
          {rows.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {rows.map((row) => (
                <li key={row.labelKey}>
                  {t(row.labelKey)}: {row.value || t('requests.resolve.review.empty_value')}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-muted">{t('requests.resolve.review.no_overrides')}</div>
          )}
        </div>
        {reason ? (
          <div className="md:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('requests.resolve.review.outbound_reason')}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words">{reason}</div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border pt-2 text-xs text-muted">{t('requests.resolve.review.queue')}</div>
    </div>
  );
}

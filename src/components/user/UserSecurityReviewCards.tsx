import React from 'react';

import { useI18n } from '../../app/i18n';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';

import type { PasswordChangeReview, SecuritySettingValue, SecuritySettingsChange, SecuritySettingsReview, UserSecurityVariant } from './UserSecurityModel';

function ReviewRow(props: { label: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={props.testId}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{props.label}</div>
      <div className="mt-1 text-sm text-fg">{props.children}</div>
    </div>
  );
}

function enabledLabel(t: (key: string, vars?: Record<string, unknown>) => string, enabled: boolean): string {
  return enabled ? t('common.enabled') : t('common.disabled');
}

function sessionMinutesLabel(t: (key: string, vars?: Record<string, unknown>) => string, minutes: number | null): string {
  if (minutes === null) return t('common.na');
  if (minutes === 0) return t('security.settings.session_length.preset.never');
  return t('security.settings.session_length.value.minutes', { m: minutes });
}

function settingValueLabel(t: (key: string, vars?: Record<string, unknown>) => string, value: SecuritySettingValue): string {
  if (value.kind === 'boolean') return enabledLabel(t, value.enabled);
  return sessionMinutesLabel(t, value.minutes);
}

function ChangeRow(props: { change: SecuritySettingsChange; testId: string }) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2" data-testid={props.testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-fg">{t(props.change.labelKey)}</div>
        <Badge variant={props.change.tone}>{t('security.settings.review.badge.pending_change')}</Badge>
      </div>
      <div className="mt-1 text-sm text-muted">
        <span className="tabular-nums">{settingValueLabel(t, props.change.current)}</span>
        <span className="mx-2 text-faint">→</span>
        <span className="tabular-nums text-fg">{settingValueLabel(t, props.change.next)}</span>
      </div>
      <div className="mt-1 text-xs text-muted">{t(props.change.impactKey)}</div>
    </div>
  );
}

export function UserPasswordReviewCard(props: {
  prefix: string;
  variant: UserSecurityVariant;
  review: PasswordChangeReview;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3" data-testid={`${props.prefix}.password.review`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('security.password.review.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('security.password.review.subtitle')}</div>
        </div>
        <Badge variant={props.review.canSubmit ? 'warn' : 'neutral'}>
          {props.review.canSubmit
            ? t('security.password.review.badge.ready')
            : t('security.password.review.badge.incomplete')}
        </Badge>
      </div>

      {props.review.validationKey ? (
        <Alert variant="warn" title={t('security.password.review.validation.title')} testId={`${props.prefix}.password.review.validation`}>
          {t(props.review.validationKey)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewRow label={t('security.password.review.field.password')} testId={`${props.prefix}.password.review.password`}>
          {props.review.hasNewPassword
            ? t('security.password.review.value.password_pending')
            : t('security.password.review.value.no_password')}
        </ReviewRow>

        {props.variant === 'profile' ? (
          <ReviewRow label={t('security.password.review.field.current_password')} testId={`${props.prefix}.password.review.current`}>
            {props.review.currentPasswordProvided
              ? t('security.password.review.value.current_provided')
              : t('security.password.review.value.current_missing')}
          </ReviewRow>
        ) : null}

        <ReviewRow label={t('security.password.review.field.sessions')} testId={`${props.prefix}.password.review.sessions`}>
          {props.review.logoutSessions
            ? t('security.password.review.value.sessions_logout')
            : t('security.password.review.value.sessions_keep')}
        </ReviewRow>

        <ReviewRow label={t('security.password.review.field.impact')} testId={`${props.prefix}.password.review.impact`}>
          {props.review.canSubmit
            ? t('security.password.review.impact.ready')
            : t('security.password.review.impact.incomplete')}
        </ReviewRow>
      </div>
    </div>
  );
}

export function UserSecuritySettingsReviewCard(props: { prefix: string; review: SecuritySettingsReview }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3" data-testid={`${props.prefix}.settings.review`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{t('security.settings.review.title')}</div>
          <div className="mt-1 text-xs text-muted">{t('security.settings.review.subtitle')}</div>
        </div>
        <Badge variant={props.review.canSubmit ? 'warn' : 'neutral'}>
          {props.review.hasChanges
            ? t('security.settings.review.badge.pending_change')
            : t('security.settings.review.badge.no_change')}
        </Badge>
      </div>

      {props.review.warningKeys.map((key) => (
        <Alert key={key} variant="warn" title={t('security.settings.review.warning.title')} testId={`${props.prefix}.settings.review.warning.${key}`}>
          {t(key)}
        </Alert>
      ))}

      {props.review.changes.length > 0 ? (
        <div className="space-y-2">
          {props.review.changes.map((change) => (
            <ChangeRow key={change.key} change={change} testId={`${props.prefix}.settings.review.change.${change.key}`} />
          ))}
        </div>
      ) : (
        <ReviewRow label={t('security.settings.review.field.changes')} testId={`${props.prefix}.settings.review.no_changes`}>
          {t('security.settings.review.no_changes')}
        </ReviewRow>
      )}

      <div className="border-t border-border pt-2 text-xs text-muted">{t('security.settings.review.queue_note')}</div>
    </div>
  );
}

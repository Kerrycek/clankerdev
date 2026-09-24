import React from 'react';
import { Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';

import { useI18n } from '../../../app/i18n';
import type { RegistrationRequest } from '../../../lib/api/requests';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { clsx } from '../../../components/ui/clsx';

import { fraudCheckStatus, type FraudCheckStatus } from './RequestDetailModel';

type Signal = {
  key: keyof RegistrationRequest;
  labelKey: string;
};

const ipSummarySignals: Signal[] = [
  { key: 'ip_proxy', labelKey: 'requests.detail.risk.ip_proxy' },
  { key: 'ip_vpn', labelKey: 'requests.detail.risk.ip_vpn' },
  { key: 'ip_tor', labelKey: 'requests.detail.risk.ip_tor' },
  { key: 'ip_recent_abuse', labelKey: 'requests.detail.risk.ip_recent_abuse' },
];

const ipDetailSignals: Signal[] = [
  { key: 'ip_request_id', labelKey: 'requests.detail.risk.request_id' },
  { key: 'ip_message', labelKey: 'requests.detail.risk.message' },
  { key: 'ip_errors', labelKey: 'requests.detail.risk.errors' },
  { key: 'ip_proxy', labelKey: 'requests.detail.risk.ip_proxy' },
  { key: 'ip_crawler', labelKey: 'requests.detail.risk.ip_crawler' },
  { key: 'ip_recent_abuse', labelKey: 'requests.detail.risk.ip_recent_abuse' },
  { key: 'ip_vpn', labelKey: 'requests.detail.risk.ip_vpn' },
  { key: 'ip_tor', labelKey: 'requests.detail.risk.ip_tor' },
  { key: 'ip_fraud_score', labelKey: 'requests.detail.risk.fraud_score' },
];

const mailSummarySignals: Signal[] = [
  { key: 'mail_valid', labelKey: 'requests.detail.risk.mail_valid' },
  { key: 'mail_disposable', labelKey: 'requests.detail.risk.mail_disposable' },
  { key: 'mail_deliverability', labelKey: 'requests.detail.risk.mail_deliverability' },
  { key: 'mail_recent_abuse', labelKey: 'requests.detail.risk.mail_recent_abuse' },
];

const mailDetailSignals: Signal[] = [
  { key: 'mail_request_id', labelKey: 'requests.detail.risk.request_id' },
  { key: 'mail_message', labelKey: 'requests.detail.risk.message' },
  { key: 'mail_errors', labelKey: 'requests.detail.risk.errors' },
  { key: 'mail_valid', labelKey: 'requests.detail.risk.mail_valid' },
  { key: 'mail_disposable', labelKey: 'requests.detail.risk.mail_disposable' },
  { key: 'mail_timed_out', labelKey: 'requests.detail.risk.mail_timed_out' },
  { key: 'mail_deliverability', labelKey: 'requests.detail.risk.mail_deliverability' },
  { key: 'mail_catch_all', labelKey: 'requests.detail.risk.mail_catch_all' },
  { key: 'mail_leaked', labelKey: 'requests.detail.risk.mail_leaked' },
  { key: 'mail_suspect', labelKey: 'requests.detail.risk.mail_suspect' },
  { key: 'mail_smtp_score', labelKey: 'requests.detail.risk.mail_smtp_score' },
  { key: 'mail_overall_score', labelKey: 'requests.detail.risk.mail_overall_score' },
  { key: 'mail_fraud_score', labelKey: 'requests.detail.risk.fraud_score' },
  { key: 'mail_dns_valid', labelKey: 'requests.detail.risk.mail_dns_valid' },
  { key: 'mail_honeypot', labelKey: 'requests.detail.risk.mail_honeypot' },
  { key: 'mail_spam_trap_score', labelKey: 'requests.detail.risk.mail_spam_trap_score' },
  { key: 'mail_recent_abuse', labelKey: 'requests.detail.risk.mail_recent_abuse' },
  { key: 'mail_frequent_complainer', labelKey: 'requests.detail.risk.mail_frequent_complainer' },
];

function statusVariant(status: FraudCheckStatus): 'warn' | 'danger' | 'ok' {
  if (status === 'success') return 'ok';
  if (status === 'failed') return 'danger';
  return 'warn';
}

type RiskEmphasis = 'clear' | 'elevated' | 'high' | 'pending' | 'failed';

export type RequestFraudRiskSummary = {
  state: RiskEmphasis;
  variant: 'ok' | 'warn' | 'danger';
  maxScore: number | null;
};

function numericScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function requestFraudRiskSummary(request: RegistrationRequest): RequestFraudRiskSummary {
  const ipStatus = fraudCheckStatus(request.ip_checked, request.ip_success);
  const mailStatus = fraudCheckStatus(request.mail_checked, request.mail_success);
  const scores = [numericScore(request.ip_fraud_score), numericScore(request.mail_fraud_score)]
    .filter((score): score is number => score !== null);
  const maxScore = scores.length > 0 ? Math.max(...scores) : null;

  if (maxScore !== null && maxScore >= 80) return { state: 'high', variant: 'danger', maxScore };
  if (ipStatus === 'failed' || mailStatus === 'failed') return { state: 'failed', variant: 'danger', maxScore };
  if (ipStatus === 'pending' || mailStatus === 'pending') return { state: 'pending', variant: 'warn', maxScore };
  if (maxScore !== null && maxScore >= 50) return { state: 'elevated', variant: 'warn', maxScore };
  return { state: 'clear', variant: 'ok', maxScore };
}

function checkVariant(status: FraudCheckStatus, score: unknown): 'ok' | 'warn' | 'danger' {
  const normalizedScore = numericScore(score);
  if (normalizedScore !== null && normalizedScore >= 80) return 'danger';
  if (status === 'failed') return 'danger';
  if (status === 'pending' || (normalizedScore !== null && normalizedScore >= 50)) return 'warn';
  return 'ok';
}

function emphasisClasses(variant: RequestFraudRiskSummary['variant']): string {
  if (variant === 'danger') return 'border-danger-border bg-danger-bg';
  if (variant === 'warn') return 'border-warn-border bg-warn-bg';
  return 'border-ok-border bg-ok-bg';
}

function signalValue(value: unknown, yes: string, no: string): string {
  if (value === true) return yes;
  if (value === false) return no;
  if (value == null || value === '') return '—';
  return String(value);
}

function CheckCard(props: {
  request: RegistrationRequest;
  kind: 'ip' | 'mail';
  title: string;
  score: unknown;
  status: FraudCheckStatus;
  summarySignals: Signal[];
  detailSignals: Signal[];
}) {
  const { t } = useI18n();
  const message = props.request[`${props.kind}_message` as keyof RegistrationRequest];
  const errors = props.request[`${props.kind}_errors` as keyof RegistrationRequest];
  const resultVariant = checkVariant(props.status, props.score);

  return (
    <Card
      testId={`admin.requests.detail.risk.${props.kind}`}
      className={clsx('border-2', resultVariant === 'danger'
        ? 'border-danger-border'
        : resultVariant === 'warn'
          ? 'border-warn-border'
          : 'border-ok-border')}
    >
      <CardHeader
        title={props.title}
        subtitle={(
          <span className="mt-2 flex flex-wrap gap-2">
            <Badge
              variant={resultVariant}
              className="text-sm font-semibold"
              testId={`admin.requests.detail.risk.${props.kind}.score`}
            >
              {t('requests.detail.risk.score', { score: props.score ?? '—' })}
            </Badge>
            <Badge
              variant={statusVariant(props.status)}
              testId={`admin.requests.detail.risk.${props.kind}.status`}
            >
              {t(`requests.detail.risk.status.${props.status}`)}
            </Badge>
          </span>
        )}
      />
      <CardBody className="space-y-3">
        {props.status === 'pending' ? (
          <div className="text-sm text-muted">{t('requests.detail.risk.pending_help')}</div>
        ) : null}
        {props.status === 'failed' ? (
          <div className="rounded-md border border-danger-border bg-danger-bg p-2 text-sm">
            {signalValue(errors || message, t('common.yes'), t('common.no'))}
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {props.summarySignals.map((signal) => (
            <div key={signal.key}>
              <dt className="text-xs text-muted">{t(signal.labelKey)}</dt>
              <dd>{signalValue(props.request[signal.key], t('common.yes'), t('common.no'))}</dd>
            </div>
          ))}
        </dl>

        <details data-testid={`admin.requests.detail.risk.${props.kind}.details`}>
          <summary className="cursor-pointer text-sm font-medium text-accent">
            {t('requests.detail.risk.all_signals')}
          </summary>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
            {props.detailSignals.map((signal) => (
              <div key={signal.key} className="min-w-0">
                <dt className="text-xs text-muted">{t(signal.labelKey)}</dt>
                <dd className="break-words">{signalValue(props.request[signal.key], t('common.yes'), t('common.no'))}</dd>
              </div>
            ))}
          </dl>
        </details>
      </CardBody>
    </Card>
  );
}
export function RequestFraudChecks(props: { request: RegistrationRequest }) {
  const { t } = useI18n();
  const ipStatus = fraudCheckStatus(props.request.ip_checked, props.request.ip_success);
  const mailStatus = fraudCheckStatus(props.request.mail_checked, props.request.mail_success);
  const summary = requestFraudRiskSummary(props.request);
  const SummaryIcon = summary.state === 'clear'
    ? ShieldCheck
    : summary.state === 'pending'
      ? Clock3
      : ShieldAlert;

  return (
    <section className="space-y-3" aria-label={t('requests.detail.risk.title')}>
      <div>
        <h2 className="font-semibold">{t('requests.detail.risk.title')}</h2>
        <p className="mt-0.5 text-sm text-muted">{t('requests.detail.risk.subtitle')}</p>
      </div>
      <div
        className={clsx(
          'flex flex-col gap-3 rounded-lg border-2 px-4 py-3 sm:flex-row sm:items-center',
          emphasisClasses(summary.variant),
        )}
        data-testid="admin.requests.detail.risk.summary"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface/70">
            <SummaryIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold" data-testid="admin.requests.detail.risk.summary.title">
              {t(`requests.detail.risk.summary.${summary.state}.title`)}
            </div>
            <div className="mt-0.5 text-sm text-muted">
              {t(`requests.detail.risk.summary.${summary.state}.body`)}
            </div>
          </div>
        </div>
        {summary.maxScore !== null ? (
          <Badge
            variant={summary.variant}
            className="shrink-0 px-3 py-1 text-sm font-semibold"
            testId="admin.requests.detail.risk.summary.score"
          >
            {t('requests.detail.risk.summary.max_score', { score: summary.maxScore })}
          </Badge>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CheckCard
          request={props.request}
          kind="ip"
          title={t('requests.detail.risk.ip_check')}
          score={props.request.ip_fraud_score}
          status={ipStatus}
          summarySignals={ipSummarySignals}
          detailSignals={ipDetailSignals}
        />
        <CheckCard
          request={props.request}
          kind="mail"
          title={t('requests.detail.risk.mail_check')}
          score={props.request.mail_fraud_score}
          status={mailStatus}
          summarySignals={mailSummarySignals}
          detailSignals={mailDetailSignals}
        />
      </div>
    </section>
  );
}

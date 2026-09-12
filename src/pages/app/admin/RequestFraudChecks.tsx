import React from 'react';

import { useI18n } from '../../../app/i18n';
import type { RegistrationRequest } from '../../../lib/api/requests';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';

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

  return (
    <Card testId={`admin.requests.detail.risk.${props.kind}`}>
      <CardHeader
        title={props.title}
        subtitle={t('requests.detail.risk.score', { score: props.score ?? '—' })}
        actions={(
          <Badge
            variant={statusVariant(props.status)}
            testId={`admin.requests.detail.risk.${props.kind}.status`}
          >
            {t(`requests.detail.risk.status.${props.status}`)}
          </Badge>
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

  return (
    <section className="space-y-3" aria-label={t('requests.detail.risk.title')}>
      <div>
        <h2 className="font-semibold">{t('requests.detail.risk.title')}</h2>
        <p className="mt-0.5 text-sm text-muted">{t('requests.detail.risk.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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

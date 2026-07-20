import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { clsx } from '../../../components/ui/clsx';

import type {
  VpsConfigReviewKey,
  VpsConfigRisk,
  VpsConfigSection,
} from './VpsConfigurationModel';
import type { VpsConfigFieldError } from './VpsConfigurationErrors';
import type { VpsConfigChangeSummary } from './VpsConfigurationReviewModel';

const SECTION_ORDER: readonly VpsConfigSection[] = ['identity', 'resources', 'network', 'namespace', 'boot', 'admin'];

function riskVariant(risk: VpsConfigRisk): React.ComponentProps<typeof Badge>['variant'] {
  switch (risk) {
    case 'safe':
      return 'ok';
    case 'requires_restart':
      return 'warn';
    case 'admin_only':
      return 'neutral';
    case 'boot':
      return 'info';
    case 'network':
      return 'warn';
  }
}

export function VpsConfigRiskBadges(props: { risks: readonly VpsConfigRisk[]; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={clsx('flex flex-wrap gap-1', props.className)}>
      {props.risks.map((risk) => (
        <Badge key={risk} variant={riskVariant(risk)}>
          {t(`vps.config.risk.${risk}`)}
        </Badge>
      ))}
    </div>
  );
}

export function Field(props: {
  label: React.ReactNode;
  help?: React.ReactNode;
  errors?: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-sm font-medium text-fg">{props.label}</div>
      {props.children}
      {props.help ? <div className="text-xs text-muted">{props.help}</div> : null}
      {props.errors && props.errors.length > 0 ? (
        <div className="space-y-1 text-xs text-danger" role="alert">
          {props.errors.map((error, index) => (
            <div key={`${error}-${index}`}>{error}</div>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function VpsConfigSectionCard(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  risks?: readonly VpsConfigRisk[];
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={props.className}>
      <CardHeader
        title={props.title}
        subtitle={props.subtitle}
        actions={props.risks && props.risks.length > 0 ? <VpsConfigRiskBadges risks={props.risks} /> : undefined}
      />
      <CardBody className={props.bodyClassName}>{props.children}</CardBody>
    </Card>
  );
}

function groupChanges(changes: readonly VpsConfigChangeSummary[]): Array<{ section: VpsConfigSection; changes: VpsConfigChangeSummary[] }> {
  return SECTION_ORDER.map((section) => ({
    section,
    changes: changes.filter((change) => change.section === section),
  })).filter((group) => group.changes.length > 0);
}

function ChangeRow(props: { change: VpsConfigChangeSummary; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      data-testid={`vps.config.diff.${props.change.key}`}
      className={clsx(
        'rounded-lg border border-border bg-bg/40 p-3',
        props.compact ? 'space-y-2' : 'grid gap-3 md:grid-cols-[minmax(9rem,12rem)_1fr]'
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium text-fg">{props.change.label}</div>
        <VpsConfigRiskBadges risks={props.change.risks} />
        {props.change.requestOption ? <Badge variant="neutral">{t('vps.config.review.request_option')}</Badge> : null}
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('vps.config.review.before')}</div>
          <div className="mt-1 break-words rounded-md border border-border bg-surface px-2 py-1 text-fg">{props.change.before}</div>
        </div>
        <div className="hidden px-1 pt-6 text-muted md:block" aria-hidden="true">
          {t('vps.config.review.arrow')}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{t('vps.config.review.after')}</div>
          <div className="mt-1 break-words rounded-md border border-info-border bg-info-bg px-2 py-1 text-fg">{props.change.after}</div>
        </div>
      </div>
    </div>
  );
}

export function VpsConfigChangesList(props: { changes: readonly VpsConfigChangeSummary[]; compact?: boolean }) {
  const { t } = useI18n();
  const groups = groupChanges(props.changes);

  if (props.changes.length === 0) {
    return <Alert variant="neutral">{t('vps.config.review.no_changes')}</Alert>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.section} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`vps.config.section_group.${group.section}`)}</div>
          <div className="space-y-2">
            {group.changes.map((change) => (
              <ChangeRow key={change.key} change={change} compact={props.compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function VpsConfigReviewPanel(props: {
  changes: readonly VpsConfigChangeSummary[];
  dirty: boolean;
  sensitive: boolean;
  validationFieldKey?: VpsConfigReviewKey;
}) {
  const { t } = useI18n();

  return (
    <Card testId="vps.config.review">
      <CardHeader
        title={t('vps.config.review.title')}
        subtitle={props.dirty ? t('vps.config.review.subtitle_dirty', { n: props.changes.length }) : t('vps.config.review.subtitle_clean')}
        actions={props.sensitive ? <Badge variant="warn">{t('vps.config.review.sensitive_badge')}</Badge> : undefined}
      />
      <CardBody className="space-y-3">
        {props.validationFieldKey ? (
          <Alert variant="warn" title={t('vps.config.review.validation_field_title')}>
            {t('vps.config.review.validation_field_body')}
          </Alert>
        ) : null}
        <VpsConfigChangesList changes={props.changes} />
      </CardBody>
    </Card>
  );
}

export function VpsConfigFieldErrorsAlert(props: {
  errors: readonly VpsConfigFieldError[];
  labelForKey: (key: VpsConfigReviewKey) => string;
}) {
  const { t } = useI18n();
  if (props.errors.length === 0) return null;

  return (
    <Alert variant="danger" title={t('vps.config.error.field_title')} testId="vps.config.field_errors">
      <ul className="list-disc space-y-1 pl-5">
        {props.errors.map((error) => (
          <li key={error.key}>
            <span className="font-medium text-fg">{props.labelForKey(error.key)}</span>
            <span>{t('vps.config.error.separator')}</span>
            <span>{error.messages.join(t('vps.config.error.message_joiner'))}</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

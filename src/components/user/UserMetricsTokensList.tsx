import React from 'react';

import { useI18n } from '../../app/i18n';
import type { MetricsAccessToken } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SecretField } from '../ui/SecretField';
import { Table } from '../ui/Table';

import {
  hasMetricsAccessTokenSecret,
  metricsAccessTokenStateDescriptor,
} from './UserMetricsTokensModel';

export function UserMetricsTokensList(props: {
  tokens: readonly MetricsAccessToken[];
  testIdPrefix: string;
  onRevoke: (token: MetricsAccessToken) => void;
}) {
  const prefix = props.testIdPrefix;

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid={`${prefix}.cards`}>
        {props.tokens.map((token) => (
          <MetricsTokenMobileCard
            key={token.id}
            token={token}
            testIdPrefix={prefix}
            onRevoke={props.onRevoke}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block" data-testid={`${prefix}.desktop`}>
        <MetricsTokensTable
          tokens={props.tokens}
          testIdPrefix={prefix}
          onRevoke={props.onRevoke}
        />
      </div>
    </>
  );
}

function MetricsTokenMobileCard(props: {
  token: MetricsAccessToken;
  testIdPrefix: string;
  onRevoke: (token: MetricsAccessToken) => void;
}) {
  const { t } = useI18n();
  const token = props.token;
  const testId = `${props.testIdPrefix}.card.${token.id}`;
  const headingId = `${testId}.heading`;
  const idLabelId = `${testId}.id-label`;
  const tokenPrefix = String(token.metric_prefix ?? '');
  const accessibleTokenName = tokenPrefix ? `${tokenPrefix} (#${token.id})` : `#${token.id}`;

  return (
    <article
      className="min-w-0 rounded-md border border-border bg-surface-2 p-3"
      data-testid={testId}
      aria-labelledby={`${headingId} ${idLabelId}`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div id={idLabelId} className="text-xs text-faint" data-testid={`${testId}.id`}>
            #{token.id}
          </div>
          <h3
            id={headingId}
            className="mt-0.5 break-all font-mono text-sm font-medium text-fg"
            data-testid={`${testId}.prefix`}
          >
            {String(token.metric_prefix ?? '') || '—'}
          </h3>
        </div>
        <MetricsTokenStateBadge token={token} testId={`${testId}.state`} />
      </div>

      <div className="mt-3 min-w-0">
        <div className="mb-1 text-xs font-semibold text-muted">
          {t('profile.metrics.table.token')}
        </div>
        <MetricsTokenSecret token={token} testId={`${testId}.token`} />
      </div>

      <dl className="mt-3 grid min-w-0 gap-2 text-xs sm:grid-cols-3">
        <MetricsTokenDetail
          label={t('profile.metrics.table.use_count')}
          value={String(token.use_count ?? 0)}
          testId={`${testId}.use_count`}
        />
        <MetricsTokenDetail
          label={t('profile.metrics.table.last_use')}
          value={token.last_use ? formatDateTime(token.last_use) : '—'}
          testId={`${testId}.last_use`}
        />
        <MetricsTokenDetail
          label={t('profile.metrics.table.created')}
          value={token.created_at ? formatDateTime(token.created_at) : '—'}
          testId={`${testId}.created`}
        />
      </dl>

      <Button
        variant="danger"
        size="lg"
        className="mt-3 w-full"
        onClick={() => props.onRevoke(token)}
        testId={`${testId}.delete`}
        ariaLabel={`${t('common.revoke')} ${accessibleTokenName}`}
      >
        {t('common.revoke')}
      </Button>
    </article>
  );
}

function MetricsTokenDetail(props: { label: string; value: string; testId: string }) {
  return (
    <div className="min-w-0" data-testid={props.testId}>
      <dt className="font-semibold text-muted">{props.label}</dt>
      <dd className="mt-0.5 break-words text-fg tabular-nums">{props.value}</dd>
    </div>
  );
}

function MetricsTokensTable(props: {
  tokens: readonly MetricsAccessToken[];
  testIdPrefix: string;
  onRevoke: (token: MetricsAccessToken) => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <Table minWidth="lg" testId={`${prefix}.table`}>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="px-4 py-2">{t('common.id')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.prefix')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.state')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.token')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.use_count')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.last_use')}</th>
          <th className="px-4 py-2">{t('profile.metrics.table.created')}</th>
          <th className="px-4 py-2 text-right">{t('common.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {props.tokens.map((token) => (
          <tr
            key={token.id}
            className="border-b border-border/60 last:border-b-0"
            data-testid={`${prefix}.row.${token.id}`}
          >
            <td className="px-4 py-2 text-xs text-muted tabular-nums">#{token.id}</td>
            <td className="px-4 py-2 text-sm text-fg">
              <span className="font-mono">{String(token.metric_prefix ?? '') || '—'}</span>
            </td>
            <td className="px-4 py-2">
              <MetricsTokenStateBadge token={token} testId={`${prefix}.row.${token.id}.state`} />
            </td>
            <td className="px-4 py-2">
              <div className="max-w-md">
                <MetricsTokenSecret token={token} testId={`${prefix}.row.${token.id}.token`} />
              </div>
            </td>
            <td className="px-4 py-2 text-xs text-muted tabular-nums">{token.use_count ?? 0}</td>
            <td className="px-4 py-2 text-xs text-muted tabular-nums">
              {token.last_use ? formatDateTime(token.last_use) : '—'}
            </td>
            <td className="px-4 py-2 text-xs text-muted tabular-nums">
              {token.created_at ? formatDateTime(token.created_at) : '—'}
            </td>
            <td className="px-4 py-2 text-right">
              <Button
                variant="danger"
                size="sm"
                onClick={() => props.onRevoke(token)}
                testId={`${prefix}.row.${token.id}.delete`}
              >
                {t('common.revoke')}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function MetricsTokenStateBadge(props: { token: MetricsAccessToken; testId?: string }) {
  const { t } = useI18n();
  const descriptor = metricsAccessTokenStateDescriptor(props.token);

  return (
    <Badge variant={descriptor.badgeTone} title={t(descriptor.descriptionKey)} testId={props.testId}>
      {t(descriptor.labelKey)}
    </Badge>
  );
}

function MetricsTokenSecret(props: { token: MetricsAccessToken; testId: string }) {
  const { t } = useI18n();
  const tokenValue = String(props.token.access_token ?? '');

  if (!hasMetricsAccessTokenSecret(props.token)) {
    return (
      <div
        className="break-words rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted"
        data-testid={`${props.testId}.unavailable`}
      >
        {t('profile.metrics.field.token_unavailable')}
      </div>
    );
  }

  return (
    <SecretField
      value={tokenValue}
      testId={props.testId}
      description={t('profile.metrics.field.token_hint')}
      showFragment
    />
  );
}

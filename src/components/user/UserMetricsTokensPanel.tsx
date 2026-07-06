import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { getRuntimeConfig } from '../../app/config';

import {
  createMetricsAccessToken,
  deleteMetricsAccessToken,
  fetchMetricsAccessTokens,
  type MetricsAccessToken,
} from '../../lib/api/userDossier';

import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SecretField } from '../ui/SecretField';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

import { UserSecurityMetricGrid } from './UserSecurityMetricGrid';
import {
  METRICS_TOKEN_REVOKE_CONFIRMATION,
  buildMetricPrefixReview,
  buildMetricsTokenSummary,
  hasMetricsAccessTokenSecret,
  metricsAccessTokenDisplayName,
  metricsAccessTokenStateDescriptor,
  metricsUrlForAccessToken,
  sortMetricsAccessTokens,
} from './UserMetricsTokensModel';

function MetricsTokenStateBadge(props: { token: MetricsAccessToken; testId?: string }) {
  const { t } = useI18n();
  const descriptor = metricsAccessTokenStateDescriptor(props.token);

  return (
    <Badge variant={descriptor.badgeTone} title={t(descriptor.descriptionKey)} testId={props.testId}>
      {t(descriptor.labelKey)}
    </Badge>
  );
}

function MetricsTokenSecretCell(props: { token: MetricsAccessToken; testIdPrefix: string }) {
  const { t } = useI18n();
  const tokenValue = String(props.token.access_token ?? '');
  const testId = `${props.testIdPrefix}.row.${props.token.id}.token`;

  if (!hasMetricsAccessTokenSecret(props.token)) {
    return (
      <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted" data-testid={`${testId}.unavailable`}>
        {t('profile.metrics.field.token_unavailable')}
      </div>
    );
  }

  return (
    <SecretField
      value={tokenValue}
      testId={testId}
      description={t('profile.metrics.field.token_hint')}
      showFragment
    />
  );
}

export function UserMetricsTokensPanel(props: {
  /** Admin-only: list tokens for specific user. */
  userId?: number;
  /** Test id prefix, e.g. "profile.metrics" or "admin.user.metrics" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [metricPrefix, setMetricPrefix] = useState('vpsadmin_');
  const [created, setCreated] = useState<MetricsAccessToken | null>(null);
  const [deleteToken, setDeleteToken] = useState<MetricsAccessToken | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const tokensQ = useQuery({
    queryKey: ['metrics_access_tokens', props.userId ?? null],
    queryFn: async () => (await fetchMetricsAccessTokens({ userId: props.userId, limit: 200 })).data,
    staleTime: 30_000,
  });

  const tokensSorted = useMemo(() => sortMetricsAccessTokens(tokensQ.data ?? []), [tokensQ.data]);
  const tokenSummary = useMemo(() => buildMetricsTokenSummary(tokensQ.data), [tokensQ.data]);
  const createReview = useMemo(() => buildMetricPrefixReview(metricPrefix), [metricPrefix]);

  const createM = useMutation({
    mutationFn: async () => {
      if (!createReview.canSubmit) {
        throw new Error(t(createReview.validationKey ?? 'profile.metrics.validation.prefix_required'));
      }

      return (await createMetricsAccessToken({ userId: props.userId, metric_prefix: createReview.normalized })).data;
    },
    onSuccess: async (tok) => {
      await qc.invalidateQueries({ queryKey: ['metrics_access_tokens'] });
      setCreateOpen(false);
      setCreated(tok);
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteMetricsAccessToken(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['metrics_access_tokens'] });
      setDeleteToken(null);
      setDeleteConfirmation('');
    },
  });

  const prefix = props.testIdPrefix;
  const deleteDescriptor = deleteToken ? metricsAccessTokenStateDescriptor(deleteToken) : null;

  return (
    <>
      <Card testId={`${prefix}.card`}>
        <CardHeader
          title={t('profile.metrics.title')}
          subtitle={t('profile.metrics.subtitle')}
          actions={
            <Button
              onClick={() => {
                createM.reset();
                setMetricPrefix('vpsadmin_');
                setCreateOpen(true);
              }}
              testId={`${prefix}.create`}
            >
              {t('profile.metrics.create')}
            </Button>
          }
        />

        <CardBody>
          <div className="space-y-4">
            <Alert variant="warn" title={t('profile.metrics.security.title')} testId={`${prefix}.security_notice`}>
              {t(props.userId ? 'profile.metrics.security.body_admin' : 'profile.metrics.security.body_profile')}
            </Alert>

            <UserSecurityMetricGrid
              testId={`${prefix}.summary`}
              items={[
                { key: 'total', label: t('profile.metrics.summary.total'), value: tokenSummary.total },
                { key: 'active', label: t('profile.metrics.summary.active'), value: tokenSummary.active },
                { key: 'stale', label: t('profile.metrics.summary.stale'), value: tokenSummary.stale },
                { key: 'unused', label: t('profile.metrics.summary.unused'), value: tokenSummary.unused },
              ]}
            />

            {tokensQ.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : tokensQ.isError ? (
              <Alert variant="danger" title={t('profile.metrics.load_failed')}>
                {formatErrorMessage(tokensQ.error)}
              </Alert>
            ) : tokensSorted.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-2 py-8 text-center" data-testid={`${prefix}.empty`}>
                <div className="text-sm font-medium text-fg">{t('profile.metrics.empty')}</div>
                <div className="mt-1 text-sm text-muted">{t('profile.metrics.empty_hint')}</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {tokensSorted.map((tok) => (
                      <tr
                        key={tok.id}
                        className="border-b border-border/60 last:border-b-0"
                        data-testid={`${prefix}.row.${tok.id}`}
                      >
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">#{tok.id}</td>
                        <td className="px-4 py-2 text-sm text-fg">
                          <span className="font-mono">{String(tok.metric_prefix ?? '') || '—'}</span>
                        </td>
                        <td className="px-4 py-2">
                          <MetricsTokenStateBadge token={tok} testId={`${prefix}.row.${tok.id}.state`} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="max-w-md">
                            <MetricsTokenSecretCell token={tok} testIdPrefix={prefix} />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">{tok.use_count ?? 0}</td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">
                          {tok.last_use ? formatDateTime(tok.last_use) : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">
                          {tok.created_at ? formatDateTime(tok.created_at) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setDeleteToken(tok);
                              setDeleteConfirmation('');
                            }}
                            testId={`${prefix}.row.${tok.id}.delete`}
                          >
                            {t('common.revoke')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => {
          if (createM.isPending) return;
          setCreateOpen(false);
        }}
        title={t('profile.metrics.create_title')}
        testId={`${prefix}.create_modal`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (createM.isPending) return;
                setCreateOpen(false);
              }}
              testId={`${prefix}.create_modal.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createM.mutate()}
              loading={createM.isPending}
              disabled={!createReview.canSubmit}
              testId={`${prefix}.create_modal.create`}
            >
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="warn" title={t('profile.metrics.create_security.title')}>
            {t('profile.metrics.create_security.body')}
          </Alert>

          {createM.isError ? (
            <Alert variant="danger" title={t('profile.metrics.create_failed')}>
              {formatErrorMessage(createM.error)}
            </Alert>
          ) : null}

          <div>
            <div className="text-sm font-medium">{t('profile.metrics.field.prefix')}</div>
            <div className="mt-1">
              <Input
                value={metricPrefix}
                onChange={(e) => setMetricPrefix(e.target.value)}
                placeholder={t('profile.metrics.field.prefix_placeholder')}
                testId={`${prefix}.create_modal.prefix`}
                className="font-mono"
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.metrics.field.prefix_hint')}</div>
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-3" data-testid={`${prefix}.create_modal.review`}>
            <div className="text-sm font-semibold text-fg">{t('profile.metrics.review.title')}</div>
            {createReview.validationKey ? (
              <Alert variant="danger" className="mt-3" title={t('common.validation_error')}>
                {t(createReview.validationKey)}
              </Alert>
            ) : (
              <div className="mt-2 text-sm text-muted">
                {t('profile.metrics.review.prefix', { prefix: createReview.normalized })}
              </div>
            )}

            {createReview.warningKeys.length > 0 ? (
              <div className="mt-3 space-y-2">
                {createReview.warningKeys.map((key) => (
                  <Alert key={key} variant="warn" testId={`${prefix}.create_modal.review.warning.${key}`}>
                    {t(key)}
                  </Alert>
                ))}
              </div>
            ) : null}

            <div className="mt-3 text-xs leading-5 text-muted">{t('profile.metrics.review.impact')}</div>
          </div>
        </div>
      </Modal>

      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title={t('profile.metrics.created_title')}
        testId={`${prefix}.created_modal`}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setCreated(null)} testId={`${prefix}.created_modal.done`}>
              {t('common.done')}
            </Button>
          </div>
        }
      >
        {created ? (
          <div className="space-y-4">
            <Alert variant="warn" title={t('profile.metrics.created_warning')}>
              {t('profile.metrics.created_warning_body')}
            </Alert>

            <SecretField
              label={t('profile.metrics.field.token')}
              value={String(created.access_token ?? '')}
              revealedByDefault={false}
              testId={`${prefix}.created_modal.token`}
              showFragment
            />

            {created.access_token ? (
              <SecretField
                label={t('profile.metrics.field.scrape_url')}
                value={metricsUrlForAccessToken(getRuntimeConfig().apiUrl, String(created.access_token))}
                revealedByDefault={false}
                testId={`${prefix}.created_modal.url`}
                multiline
                rows={2}
              />
            ) : null}

            <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted" data-testid={`${prefix}.created_modal.next_steps`}>
              {t('profile.metrics.created_next_steps')}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteToken !== null}
        onCancel={() => {
          if (delM.isPending) return;
          setDeleteToken(null);
          setDeleteConfirmation('');
        }}
        title={t('profile.metrics.delete.title')}
        description={t('profile.metrics.delete.description')}
        confirmLabel={t('common.revoke')}
        danger
        confirmLoading={delM.isPending}
        confirmationText={METRICS_TOKEN_REVOKE_CONFIRMATION}
        confirmationValue={deleteConfirmation}
        onConfirmationValueChange={setDeleteConfirmation}
        onConfirm={() => {
          if (!deleteToken) return;
          delM.mutate(deleteToken.id);
        }}
        testId={`${prefix}.delete_dialog`}
      >
        {deleteToken && deleteDescriptor ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted" data-testid={`${prefix}.delete_dialog.review`}>
              <div>
                {t('profile.metrics.delete.review_prefix', {
                  prefix: metricsAccessTokenDisplayName(deleteToken),
                })}
              </div>
              <div className="mt-1">
                {t('profile.metrics.delete.review_state', {
                  state: t(deleteDescriptor.labelKey),
                  count: deleteToken.use_count ?? 0,
                  last: deleteToken.last_use ? formatDateTime(deleteToken.last_use) : '—',
                })}
              </div>
            </div>
            <Alert variant="warn" title={t('profile.metrics.delete.confirmation_title')}>
              {t('profile.metrics.delete.confirmation_body')}
            </Alert>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

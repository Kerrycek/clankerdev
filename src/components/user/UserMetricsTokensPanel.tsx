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
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SecretField } from '../ui/SecretField';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

function sortTokens(tokens: MetricsAccessToken[]): MetricsAccessToken[] {
  return [...tokens].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

function metricsUrlForToken(token: string): string {
  const cfg = getRuntimeConfig();
  const base = String(cfg.apiUrl ?? '').replace(/\/$/, '');
  return `${base}/metrics?access_token=${encodeURIComponent(token)}`;
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
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const tokensQ = useQuery({
    queryKey: ['metrics_access_tokens', props.userId ?? null],
    queryFn: async () => (await fetchMetricsAccessTokens({ userId: props.userId, limit: 200 })).data,
    staleTime: 30_000,
  });

  const tokensSorted = useMemo(() => sortTokens(tokensQ.data ?? []), [tokensQ.data]);

  const createM = useMutation({
    mutationFn: async () => {
      const prefix = metricPrefix.trim();
      if (!prefix) throw new Error(t('profile.metrics.validation.prefix_required'));

      return (await createMetricsAccessToken({ userId: props.userId, metric_prefix: prefix })).data;
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
      setDeleteId(null);
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.card`}>
        <CardHeader
          title={t('profile.metrics.title')}
          subtitle={t('profile.metrics.subtitle')}
          actions={
            <Button onClick={() => setCreateOpen(true)} testId={`${prefix}.create`}>
              {t('profile.metrics.create')}
            </Button>
          }
        />

        <CardBody>
          <div className="mb-3 text-sm text-muted">{t('profile.metrics.warning')}</div>

          {tokensQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : tokensQ.isError ? (
            <Alert variant="danger" title={t('profile.metrics.load_failed')}>
              {formatErrorMessage(tokensQ.error)}
            </Alert>
          ) : tokensSorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.empty`}>
              {t('profile.metrics.empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table minWidth="lg" testId={`${prefix}.table`}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2">{t('common.id')}</th>
                    <th className="px-4 py-2">{t('profile.metrics.table.prefix')}</th>
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
                        <span className="font-mono">{String(tok.metric_prefix ?? '')}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="max-w-md">
                          <SecretField
                            value={String(tok.access_token ?? '')}
                            testId={`${prefix}.row.${tok.id}.token`}
                            description={t('profile.metrics.field.token_hint')}
                          />
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
                          onClick={() => setDeleteId(tok.id)}
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
        </CardBody>
      </Card>

      {/* Create */}
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
              testId={`${prefix}.create_modal.create`}
            >
              {t('common.create')}
            </Button>
          </div>
        }
      >
        {createM.isError ? (
          <Alert variant="danger" title={t('profile.metrics.create_failed')}>
            {formatErrorMessage(createM.error)}
          </Alert>
        ) : null}

        <div className={createM.isError ? 'mt-4 space-y-3' : 'space-y-3'}>
          <div className="text-sm text-muted">{t('profile.metrics.create_help')}</div>

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
        </div>
      </Modal>

      {/* Created token details */}
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
            />

            {created.access_token ? (
              <SecretField
                label={t('profile.metrics.field.scrape_url')}
                value={metricsUrlForToken(String(created.access_token))}
                revealedByDefault={false}
                testId={`${prefix}.created_modal.url`}
              />
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        onCancel={() => {
          if (delM.isPending) return;
          setDeleteId(null);
        }}
        title={t('profile.metrics.delete.title')}
        description={t('profile.metrics.delete.description')}
        confirmLabel={t('common.revoke')}
        danger
        confirmLoading={delM.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          delM.mutate(deleteId);
        }}
        testId={`${prefix}.delete_dialog`}
      />
    </>
  );
}

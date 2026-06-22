import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { TableCard } from '../../../components/ui/TableCard';
import { clsx } from '../../../components/ui/clsx';
import type { ExportHost } from '../../../lib/api/exports';
import { hostLabel, parsePositiveInt } from './ExportModel';

export function ExportHostsCard(props: {
  allVps: boolean;
  hosts: ExportHost[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onCreateHost: () => void;
  onEditHost: (host: ExportHost) => void;
  onDeleteHost: (host: ExportHost) => void;
}) {
  const { t } = useI18n();
  const hasHosts = props.hosts.length > 0;

  return (
    <>
      <Card testId="exports.detail.hosts">
        <CardHeader
          title={t('exports.detail.hosts.title')}
          subtitle={props.allVps ? t('exports.detail.hosts.all_vps_subtitle') : t('exports.detail.hosts.subtitle')}
          actions={
            <Button size="sm" variant="primary" onClick={props.onCreateHost} disabled={props.allVps} testId="exports.detail.hosts.add">
              {t('exports.host.add')}
            </Button>
          }
        />
        <CardBody>
          {props.allVps ? (
            <Alert title={t('exports.detail.hosts.all_vps_title')} variant="info">
              {t('exports.detail.hosts.all_vps_body')}
            </Alert>
          ) : null}

          {props.loading ? <LoadingState testId="exports.detail.hosts.loading" /> : null}
          {props.error ? <ErrorState testId="exports.detail.hosts.error" title={t('exports.host.load_error')} error={props.error} onRetry={props.onRetry} /> : null}
          {!props.loading && !props.error && !hasHosts ? (
            <div className="text-sm text-muted" data-testid="exports.detail.hosts.empty">{t('exports.detail.hosts.empty')}</div>
          ) : null}
          {!props.loading && !props.error && hasHosts ? (
            <TableCard testId="exports.detail.hosts.table" variant="plain" minWidth="full">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.detail.hosts.address')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.field.mode')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('common.state')}</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {props.hosts.map((host) => {
                  const hostId = parsePositiveInt(host.id) ?? 0;
                  return (
                    <tr key={hostId} data-testid={`exports.detail.hosts.row.${hostId}`} className={clsx('border-t border-border/80')}>
                      <td className="px-2 py-2 font-mono text-xs text-fg">{hostLabel(host)}</td>
                      <td className="px-2 py-2 text-sm text-fg">{host.rw ? t('exports.mode.rw') : t('exports.mode.ro')}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={Boolean(host.sync) ? 'ok' : 'warn'}>{t('exports.field.sync')}</Badge>
                          <Badge variant={Boolean(host.subtree_check) ? 'info' : 'neutral'}>{t('exports.field.subtree_check')}</Badge>
                          <Badge variant={Boolean(host.root_squash) ? 'info' : 'neutral'}>{t('exports.field.root_squash')}</Badge>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-2" data-row-no-nav>
                          <Button size="sm" variant="secondary" onClick={() => props.onEditHost(host)} testId={`exports.detail.hosts.row.${hostId}.edit`}>{t('common.edit')}</Button>
                          <Button size="sm" variant="danger" onClick={() => props.onDeleteHost(host)} testId={`exports.detail.hosts.row.${hostId}.delete`}>{t('common.delete')}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          ) : null}
        </CardBody>
      </Card>

      {!props.allVps && !hasHosts ? (
        <Alert title={t('exports.detail.hosts.warning_title')} variant="warn">
          {t('exports.detail.hosts.warning_body')}
        </Alert>
      ) : null}
    </>
  );
}

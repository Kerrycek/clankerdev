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

function NarrowCellLabel(props: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-faint @xl:hidden">{props.children}</span>;
}

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
        <CardBody className="@container">
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
            <TableCard
              testId="exports.detail.hosts.table"
              variant="plain"
              tableClassName="block @xl:table"
            >
              <thead className="hidden @xl:table-header-group">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.detail.hosts.address')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.field.mode')}</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('common.state')}</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="block @xl:table-row-group">
                {props.hosts.map((host) => {
                  const hostId = parsePositiveInt(host.id) ?? 0;
                  return (
                    <tr
                      key={hostId}
                      data-testid={`exports.detail.hosts.row.${hostId}`}
                      className={clsx('block border-t border-border/80 @xl:table-row')}
                    >
                      <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @xl:table-cell @xl:px-2">
                        <NarrowCellLabel>{t('exports.detail.hosts.address')}</NarrowCellLabel>
                        <span className="min-w-0 break-words font-mono text-xs text-fg">{hostLabel(host)}</span>
                      </td>
                      <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 text-sm text-fg @xl:table-cell @xl:px-2">
                        <NarrowCellLabel>{t('exports.field.mode')}</NarrowCellLabel>
                        <span className="min-w-0 break-words">{host.rw ? t('exports.mode.rw') : t('exports.mode.ro')}</span>
                      </td>
                      <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @xl:table-cell @xl:px-2">
                        <NarrowCellLabel>{t('common.state')}</NarrowCellLabel>
                        <div className="flex min-w-0 flex-wrap gap-1">
                          <Badge variant={Boolean(host.sync) ? 'ok' : 'warn'}>{t('exports.field.sync')}</Badge>
                          <Badge variant={Boolean(host.subtree_check) ? 'info' : 'neutral'}>{t('exports.field.subtree_check')}</Badge>
                          <Badge variant={Boolean(host.root_squash) ? 'info' : 'neutral'}>{t('exports.field.root_squash')}</Badge>
                        </div>
                      </td>
                      <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @xl:table-cell @xl:px-2">
                        <NarrowCellLabel>{t('common.actions')}</NarrowCellLabel>
                        <div className="flex min-w-0 flex-wrap justify-end gap-2 @xl:flex-nowrap" data-row-no-nav>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="min-h-11 w-full whitespace-nowrap @xl:min-h-8 @xl:w-auto"
                            onClick={() => props.onEditHost(host)}
                            testId={`exports.detail.hosts.row.${hostId}.edit`}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-11 w-full whitespace-nowrap @xl:min-h-8 @xl:w-auto"
                            onClick={() => props.onDeleteHost(host)}
                            testId={`exports.detail.hosts.row.${hostId}.delete`}
                          >
                            {t('common.delete')}
                          </Button>
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

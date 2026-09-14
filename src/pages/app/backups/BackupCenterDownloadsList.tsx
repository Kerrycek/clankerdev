import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { TableCard } from '../../../components/ui/TableCard';
import { type Dataset, type SnapshotDownload } from '../../../lib/api/datasets';
import { formatDateTime, formatMiB } from '../../../lib/format';
import {
  snapshotDownloadCanOpen,
  snapshotDownloadHref,
  snapshotDownloadStatus,
} from '../datasets/DatasetDownloadModel';
import {
  DatasetDownloadOpenButton,
  DatasetDownloadStateBadge,
} from '../datasets/DatasetDownloadStatusView';
import {
  resourceLabel,
  resolveSnapshotDownloadDataset,
  snapshotDownloadDatasetPath,
} from './BackupCenterModel';

export function BackupCenterDownloadsList(props: {
  downloads: SnapshotDownload[];
  datasets: Dataset[];
  compact?: boolean;
  hrefOptions: { webuiUrl?: string; origin?: string };
}) {
  const { t } = useI18n();
  const rows = props.compact ? props.downloads.slice(0, 5) : props.downloads;
  const items = rows.map((download) => {
    const href = snapshotDownloadHref(download, props.hrefOptions);
    const status = snapshotDownloadStatus(download, { href });
    const dataset = resolveSnapshotDownloadDataset(download, props.datasets);
    const datasetLabel = resourceLabel(dataset, t('backups.dataset.unknown'));
    const snapshotLabel = resourceLabel(download.snapshot, `#${download.snapshot?.id ?? '—'}`);

    return {
      download,
      href,
      status,
      dataset,
      datasetLabel,
      snapshotLabel,
      detailPath: snapshotDownloadDatasetPath(download, dataset),
      expiration: String(download.expiration_date ?? download.expires_at ?? ''),
    };
  });

  return (
    <>
      <div className="space-y-3 xl:hidden" data-testid="backups.downloads.cards">
        {items.map(({
          download,
          href,
          status,
          dataset,
          datasetLabel,
          snapshotLabel,
          detailPath,
          expiration,
        }) => (
          <article key={download.id} aria-labelledby={`backup-download-${download.id}-title`}>
            <Card testId={`backups.downloads.card.${download.id}`}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      id={`backup-download-${download.id}-title`}
                      className="break-words font-semibold text-fg"
                    >
                      {datasetLabel}
                    </div>
                    <div className="mt-0.5 text-xs text-faint">#{dataset?.id ?? '—'}</div>
                  </div>
                  <div
                    className="shrink-0"
                    data-testid={`backups.downloads.card.${download.id}.status`}
                  >
                    <DatasetDownloadStateBadge status={status} t={t} />
                  </div>
                </div>

                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-faint">{t('backups.snapshot')}</dt>
                    <dd className="min-w-0 break-words text-right text-fg">
                      {snapshotLabel}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-faint">{t('backups.downloads.format')}</dt>
                    <dd className="min-w-0 break-words text-right text-fg">
                      {download.format ? t(`dataset.download.format.${download.format}`) : '—'}
                      {download.size !== undefined ? (
                        <div className="text-xs text-faint">{formatMiB(download.size)}</div>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-faint">{t('backups.downloads.expires')}</dt>
                    <dd
                      className="min-w-0 break-words text-right text-muted"
                      data-testid={`backups.downloads.card.${download.id}.expiration`}
                    >
                      {expiration ? formatDateTime(expiration) : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {detailPath ? (
                    <Button
                      to={detailPath}
                      size="sm"
                      variant="ghost"
                      ariaLabel={t('backups.downloads.open_dataset', { dataset: datasetLabel })}
                      testId={`backups.downloads.card.${download.id}.detail`}
                    >
                      {t('backups.open')}
                    </Button>
                  ) : null}
                  <DatasetDownloadOpenButton
                    href={href}
                    canOpen={snapshotDownloadCanOpen(status, href)}
                    disabledTitle={t(`dataset.downloads.state_detail.${status}`)}
                    ariaLabel={t('backups.downloads.download_snapshot', { snapshot: snapshotLabel })}
                    testId={`backups.downloads.card.${download.id}.download`}
                  />
                </div>
              </CardBody>
            </Card>
          </article>
        ))}
      </div>

      <TableCard className="hidden xl:block" minWidth="lg" testId="backups.downloads.table">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left">{t('backups.dataset')}</th>
            <th className="px-3 py-2 text-left">{t('backups.snapshot')}</th>
            <th className="px-3 py-2 text-left">{t('backups.downloads.format')}</th>
            <th className="px-3 py-2 text-left">{t('backups.downloads.state')}</th>
            <th className="px-3 py-2 text-left">{t('backups.downloads.expires')}</th>
            <th className="px-3 py-2 text-right">{t('backups.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({
            download,
            href,
            status,
            dataset,
            datasetLabel,
            snapshotLabel,
            detailPath,
            expiration,
          }) => (
            <tr key={download.id} data-testid={`backups.downloads.row.${download.id}`}>
              <td className="px-3 py-2">
                <div className="font-medium">
                  {datasetLabel}
                </div>
                <div className="text-xs text-faint">#{dataset?.id ?? '—'}</div>
              </td>
              <td className="px-3 py-2 text-muted">
                {snapshotLabel}
              </td>
              <td className="px-3 py-2">
                {download.format ? t(`dataset.download.format.${download.format}`) : '—'}
                {download.size !== undefined ? (
                  <div className="text-xs text-faint">{formatMiB(download.size)}</div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <DatasetDownloadStateBadge status={status} t={t} />
              </td>
              <td className="px-3 py-2 text-muted">
                {expiration ? formatDateTime(expiration) : '—'}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  {detailPath ? (
                    <Button
                      to={detailPath}
                      size="sm"
                      variant="ghost"
                      ariaLabel={t('backups.downloads.open_dataset', { dataset: datasetLabel })}
                      testId={`backups.downloads.row.${download.id}.detail`}
                    >
                      {t('backups.open')}
                    </Button>
                  ) : null}
                  <DatasetDownloadOpenButton
                    href={href}
                    canOpen={snapshotDownloadCanOpen(status, href)}
                    disabledTitle={t(`dataset.downloads.state_detail.${status}`)}
                    ariaLabel={t('backups.downloads.download_snapshot', { snapshot: snapshotLabel })}
                    testId={`backups.downloads.row.${download.id}.download`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </>
  );
}

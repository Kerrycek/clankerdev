import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { fetchExport } from '../../../lib/api/exports';

import { useDatasetContext } from '../datasets/DatasetContext';
import { ExportCreateDialog } from './ExportCreateDialog';
import { parsePositiveInt } from './ExportModel';
import { ExportsListResults } from './ExportsListResults';

export function DatasetExportsPage() {
  const { dataset, refetch } = useDatasetContext();
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const exportId = parsePositiveInt(dataset.export?.id);

  const exportQ = useQuery({
    queryKey: ['exports', 'show', exportId, 'dataset'],
    enabled: exportId !== null,
    queryFn: async () => (
      await fetchExport(exportId as number, { includes: 'dataset,snapshot,host_ip_address' })
    ).data,
    staleTime: 10_000,
  });

  return (
    <div className="space-y-5" data-testid="dataset.exports.page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t('dataset.exports.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dataset.exports.subtitle')}</p>
        </div>
        {exportId === null ? (
          <Button variant="primary" onClick={() => setCreateOpen(true)} testId="dataset.exports.create.open">
            <Plus size={16} /> {t('exports.create.open')}
          </Button>
        ) : null}
      </div>

      {exportId === null ? (
        <EmptyState
          testId="dataset.exports.empty"
          title={t('dataset.exports.empty.title')}
          body={t('dataset.exports.empty.body')}
          action={{ label: t('exports.create.open'), onClick: () => setCreateOpen(true) }}
        />
      ) : exportQ.isLoading ? (
        <LoadingState testId="dataset.exports.loading" />
      ) : exportQ.isError ? (
        <ErrorState
          testId="dataset.exports.error"
          title={t('dataset.exports.load_error.title')}
          error={exportQ.error}
          onRetry={() => void exportQ.refetch()}
          showBack={false}
        />
      ) : exportQ.data ? (
        <ExportsListResults
          rows={[exportQ.data]}
          basePath={basePath}
          embedded
          showUser={false}
          canPaginate={false}
        />
      ) : null}

      <ExportCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fixedDatasetId={dataset.id}
        embedded
        onCreated={() => {
          void refetch();
        }}
      />
    </div>
  );
}

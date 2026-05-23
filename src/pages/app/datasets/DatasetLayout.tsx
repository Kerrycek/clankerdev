import React from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useObjectScope } from '../../../app/objectScope';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { DetailShell } from '../../../components/layout/DetailShell';

import { fetchTransactionChains } from '../../../lib/api/transactions';
import { fetchDataset } from '../../../lib/api/datasets';
import { objectRef } from '../../../lib/objectRef';
import { useTierAIntervalMs } from '../../../lib/refreshTiers';
import { deriveChainLockState } from '../../../lib/lockState';
import { useNetworkStatus } from '../../../lib/useNetworkStatus';

import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { LockBadge } from '../../../components/ui/LockBadge';
import { LockStateStaleAlert } from '../../../components/ui/LockStateStaleAlert';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';
import { TabsNav } from '../../../components/ui/TabsNav';

import { DatasetContextProvider } from './DatasetContext';
import { ScopeMismatchCard } from '../../../components/layout/ScopeMismatchCard';

function datasetTitle(ds: any, fallbackId: number): string {
  return String(ds?.full_name ?? ds?.name ?? `#${fallbackId}`);
}

export function DatasetLayout() {
  const { datasetId } = useParams();
  const id = Number(datasetId);
  const { basePath } = useAppMode();
  const scope = useObjectScope();
  const { t } = useI18n();
  const chrome = useChrome();
  const location = useLocation();
  const online = useNetworkStatus();

  const datasetRef = React.useMemo(() => {
    if (!Number.isFinite(id) || id <= 0) return null;
    return objectRef('Dataset', id);
  }, [id]);

  const busyLocalLock = datasetRef ? chrome.isLocallyLocked(datasetRef) : false;

  const tierARefetchMs = useTierAIntervalMs();

  const q = useQuery({
    queryKey: ['datasets', 'show', id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: async () => (await fetchDataset(id, { includes: 'vps,environment,dataset_expansion' })).data,
  });

  const chainsQ = useQuery({
    queryKey: ['transaction_chain', 'list', { className: 'Dataset', rowId: id, limit: 10 }],
    queryFn: async () => (await fetchTransactionChains({ className: 'Dataset', rowId: id, limit: 10 })).data,
    enabled: Number.isFinite(id) && id > 0 && q.isSuccess,
    refetchInterval: tierARefetchMs,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <ErrorState
        testId="dataset.detail.invalid_id"
        kindOverride="not_found"
        title={t('dataset.layout.invalid_id')}
        body={t('error.not_found.body')}
        backTo={`${basePath}/datasets`}
        showStatusLink={false}
        showDetails={false}
        detailsExtra={{ page: 'dataset.detail', datasetId }}
      />
    );
  }

  if (q.isLoading) return <LoadingState testId="dataset.detail.loading" />;

  if (q.isError) {
    return (
      <ErrorState
        testId="dataset.detail.error"
        title={t('dataset.layout.load_error.title')}
        error={q.error}
        onRetry={() => void q.refetch()}
        backTo={`${basePath}/datasets`}
        detailsExtra={{ page: 'dataset.detail', datasetId: id, scope: scope.scope }}
      />
    );
  }

  const ds = q.data!;
  const name = datasetTitle(ds, id);

  const chains = chainsQ.data ?? [];
  const chainLock = deriveChainLockState({
    chains,
    updatedAt: chainsQ.dataUpdatedAt,
    unreliable: !online || chainsQ.isError,
  });

  const busyTransaction = chainLock.busy;
  const activeChainIds = chainLock.activeChainIds;
  const chainsStale = chainLock.stale;

  const ownerId =
    typeof (ds as any).user === 'object' && (ds as any).user !== null && typeof (ds as any).user.id === 'number'
      ? Number((ds as any).user.id)
      : undefined;

  if (
    scope.mineUserId !== undefined &&
    ownerId !== undefined &&
    Number.isFinite(scope.mineUserId) &&
    ownerId !== scope.mineUserId
  ) {
    const adminHref = location.pathname.replace(/^\/app\b/, '/admin') + location.search + location.hash;
    return (
      <ScopeMismatchCard
        objectKind={t('object_kind.dataset')}
        objectLabel={name}
        ownerUserId={ownerId}
        adminHref={adminHref}
        backHref={`${basePath}/datasets`}
        testId="datasets.scope-mismatch"
      />
    );
  }

  const vpsId = ds.vps && typeof ds.vps === 'object' && 'id' in ds.vps ? Number((ds.vps as any).id) : undefined;
  const vpsHostname = ds.vps && typeof ds.vps === 'object' ? String((ds.vps as any).hostname ?? '') : '';

  const tabs = [
    { label: t('dataset.tabs.overview'), to: `${basePath}/datasets/${ds.id}`, end: true },
    { label: t('dataset.tabs.snapshots'), to: `${basePath}/datasets/${ds.id}/snapshots` },
    { label: t('dataset.tabs.downloads'), to: `${basePath}/datasets/${ds.id}/downloads` },
    { label: t('dataset.tabs.exports'), to: `${basePath}/datasets/${ds.id}/exports` },
    { label: t('dataset.tabs.plans'), to: `${basePath}/datasets/${ds.id}/plans` },
    { label: t('dataset.tabs.expansion'), to: `${basePath}/datasets/${ds.id}/expansion` },
  ];

  return (
    <DatasetContextProvider
      value={{
        dataset: ds,
        refetch: () => void q.refetch(),
        datasetRef: datasetRef!,
        busyLocalLock,
        chains,
        chainsLoading: chainsQ.isLoading,
        chainsError: chainsQ.isError ? chainsQ.error : null,
        busyTransaction,
        chainsStale,
        activeChainIds,
        refetchChains: () => void chainsQ.refetch(),
      }}
    >
      <DetailShell>
        <ObjectHeader
          testId="dataset.header"
          kicker={
            <>
              <Link className="text-accent hover:underline" to={`${basePath}/datasets`}>
                {t('nav.datasets')}
              </Link>
              <span className="text-faint"> · </span>
              <span>#{ds.id}</span>
            </>
          }
          title={name}
          badges={
            <>
              {busyTransaction ? (
                <LockBadge
                  kind="transaction"
                  t={t}
                  chainIds={activeChainIds}
                  showDetails
                />
              ) : busyLocalLock ? (
                <LockBadge kind="local" t={t} />
              ) : null}

              {vpsId ? (
                <Link className="text-accent hover:underline" to={`${basePath}/vps/${vpsId}`}>
                  {t('common.vps')}: {vpsHostname ? vpsHostname : `#${vpsId}`}
                </Link>
              ) : null}
            </>
          }
          tabs={<TabsNav items={tabs} />}
        />

        {chainsStale ? (
          <LockStateStaleAlert chainIds={activeChainIds} error={chainsQ.error} onRetry={() => void chainsQ.refetch()} />
        ) : null}

        <Outlet />
      </DetailShell>
    </DatasetContextProvider>
  );
}

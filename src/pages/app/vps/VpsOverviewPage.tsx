import React from 'react';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { LifecyclePanel } from '../../../components/lifetimes/LifecyclePanel';
import { useVps } from './VpsContext';
import { VpsOverviewMetricsCard } from './VpsOverviewMetricsCard';
import {
  VpsAccessCard,
  VpsActivityCard,
  VpsHealthBanner,
  VpsNetworkCard,
  VpsResourcesCard,
  VpsStorageBackupsCard,
} from './VpsControlCenterCards';
import {
  OverviewDiagnosticsCard,
} from './VpsOverviewPrimitives';

export function VpsOverviewPage() {
  const {
    vps,
    refetch,
    busyTransaction,
    busyLocalLock,
    chainsStale,
    ipAddresses,
    ipAddressesLoading,
    ipAddressesError,
    sshCommand,
    transactionChains,
    transactionChainsLoading,
    transactionChainsError,
  } = useVps();
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const isAdminView = mode === 'admin';
  const showLifecycleSummary = !isAdminView || auth.role !== 'admin';

  return (
    <div className="grid gap-4 lg:grid-cols-12" data-testid="vps.overview.control_center">
      <VpsHealthBanner
        className="lg:col-span-12"
        hideNonActionable={isAdminView}
        vps={vps}
        busy={busyTransaction || busyLocalLock}
        stale={chainsStale}
        sshCommand={sshCommand}
        ipAddressesLoading={ipAddressesLoading}
        ipAddressesError={ipAddressesError}
      />

      <VpsResourcesCard
        vps={vps}
        basePath={basePath}
        className={isAdminView ? 'lg:col-span-6' : undefined}
        showRuntimeSummary={isAdminView}
      />

      {!isAdminView ? (
        <VpsAccessCard
          vps={vps}
          basePath={basePath}
          sshCommand={sshCommand}
        />
      ) : null}

      <VpsNetworkCard
        vps={vps}
        basePath={basePath}
        ipAddresses={ipAddresses}
        loading={ipAddressesLoading}
        error={ipAddressesError}
      />

      <VpsStorageBackupsCard
        vps={vps}
        basePath={basePath}
        showUsage={!isAdminView}
        showPool={isAdminView}
      />

      {!isAdminView ? <VpsOverviewMetricsCard vps={vps} /> : null}

      <VpsActivityCard
        vps={vps}
        basePath={basePath}
        chains={transactionChains}
        loading={transactionChainsLoading}
        error={transactionChainsError}
        className={isAdminView ? 'lg:col-span-6' : undefined}
      />

      {isAdminView ? <VpsOverviewMetricsCard vps={vps} collapsedByDefault /> : null}

      {!isAdminView ? <OverviewDiagnosticsCard vps={vps} basePath={basePath} /> : null}

      {showLifecycleSummary ? (
        <div className="lg:col-span-12">
          <LifecyclePanel
            kind="vps"
            id={vps.id}
            objectLabel={vps.hostname}
            objectState={vps.object_state}
            expirationDate={vps.expiration_date}
            remindAfterDate={vps.remind_after_date}
            onUpdated={refetch}
            testId="vps.overview.lifecycle"
          />
        </div>
      ) : null}
    </div>
  );
}

import React from 'react';

import { useAppMode } from '../../../app/appMode';
import { LifecyclePanel } from '../../../components/lifetimes/LifecyclePanel';
import { useVps } from './VpsContext';
import { VpsOverviewMetricsCard } from './VpsOverviewMetricsCard';
import {
  OverviewAdminContextCard,
  OverviewDiagnosticsCard,
  OverviewResourceUsageCard,
  OverviewStatusAccessCard,
} from './VpsOverviewPrimitives';

export function VpsOverviewPage() {
  const { vps, refetch, busyTransaction, chainsStale, activeChainIds, sshCommand } = useVps();
  const { basePath, mode } = useAppMode();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OverviewStatusAccessCard
        vps={vps}
        basePath={basePath}
        busyTransaction={busyTransaction}
        chainsStale={chainsStale}
        activeChainIds={activeChainIds}
        sshCommand={sshCommand}
      />

      <OverviewResourceUsageCard vps={vps} basePath={basePath} mode={mode} />

      <div className="lg:col-span-2">
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

      <VpsOverviewMetricsCard vps={vps} />

      <OverviewDiagnosticsCard vps={vps} basePath={basePath} />

      {mode === 'admin' ? <OverviewAdminContextCard vps={vps} basePath={basePath} /> : null}
    </div>
  );
}

import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Card, CardBody } from '../../../components/ui/Card';
import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { HostIpAddress } from '../../../lib/api/networking';
import type { NetworkInterface } from '../../../lib/api/networkInterfaces';
import type { GateDecision } from '../../../lib/gates/types';
import { VpsNetworkHostAddressesCard } from './VpsNetworkHostAddressesCard';
import { VpsNetworkIpRoutesCard } from './VpsNetworkIpRoutesCard';
import { VpsNetworkAdminActionsCard } from './VpsNetworkOverviewCard';

export function VpsNetworkAdvancedSection(props: {
  canAdmin: boolean;
  adminBasePath: string;
  netEnabled: boolean;
  gate: GateDecision;
  netToggleError: string | null;
  routeCount: number;
  detachedCount: number;
  hostCount: number;
  routesLoading: boolean;
  routesErrorMessage: string | null;
  hostsLoading: boolean;
  hostsErrorMessage: string | null;
  networkActionErrorMessage: string | null;
  netifs: NetworkInterface[];
  ipByNetif: Map<number, IpAddress[]>;
  unassignedIps: IpAddress[];
  hostRows: HostIpAddress[];
  freeRoutePending: boolean;
  updatePtrPending: boolean;
  assignHostPending: boolean;
  freeHostPending: boolean;
  deleteHostPending: boolean;
  onDisableNetwork: () => void;
  onEnableNetwork: () => void;
  onRefreshRoutes: () => void;
  onRefreshHosts: () => void;
  onCreateHostAddress: (ip: IpAddress) => void;
  onEditOwner: (ip: IpAddress) => void;
  onFreeRoute: (ip: IpAddress) => void;
  onAssignRoute: (ip: IpAddress) => void;
  onEditPtr: (row: HostIpAddress) => void;
  onAssignHost: (row: HostIpAddress) => void;
  onFreeHost: (row: HostIpAddress) => void;
  onDeleteHost: (row: HostIpAddress) => void;
}) {
  const { t } = useI18n();

  return (
    <Card testId="vps.network.advanced">
      <details>
        <summary
          className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 focus:outline-none focus:ring-2 focus:ring-focus/35"
          data-testid="vps.network.advanced.toggle"
        >
          <div className="min-w-0">
            <div className="font-semibold">{t('vps.network.advanced.title')}</div>
            <div className="mt-0.5 text-sm text-muted">{t('vps.network.advanced.subtitle')}</div>
            <div className="mt-1 text-xs text-faint">
              {t('vps.network.advanced.summary', {
                routes: props.routeCount,
                detached: props.detachedCount,
                hosts: props.hostCount,
              })}
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            {t('vps.network.advanced.show')}
          </span>
        </summary>

        <CardBody className="space-y-4 border-t border-border">
          <VpsNetworkAdminActionsCard
            canAdmin={props.canAdmin}
            netEnabled={props.netEnabled}
            gate={props.gate}
            netToggleError={props.netToggleError}
            onDisable={props.onDisableNetwork}
            onEnable={props.onEnableNetwork}
          />

          <VpsNetworkIpRoutesCard
            canAdmin={props.canAdmin}
            adminBasePath={props.adminBasePath}
            gate={props.gate}
            isLoading={props.routesLoading}
            errorMessage={props.routesErrorMessage}
            netifs={props.netifs}
            ipByNetif={props.ipByNetif}
            unassignedIps={props.unassignedIps}
            freeRoutePending={props.freeRoutePending}
            onRefresh={props.onRefreshRoutes}
            onCreateHostAddress={props.onCreateHostAddress}
            onEditOwner={props.onEditOwner}
            onFreeRoute={props.onFreeRoute}
            onAssignRoute={props.onAssignRoute}
          />

          <VpsNetworkHostAddressesCard
            gate={props.gate}
            isLoading={props.hostsLoading}
            errorMessage={props.hostsErrorMessage}
            actionErrorMessage={props.networkActionErrorMessage}
            rows={props.hostRows}
            updatePtrPending={props.updatePtrPending}
            assignHostPending={props.assignHostPending}
            freeHostPending={props.freeHostPending}
            deleteHostPending={props.deleteHostPending}
            onRefresh={props.onRefreshHosts}
            onEditPtr={props.onEditPtr}
            onAssign={props.onAssignHost}
            onFree={props.onFreeHost}
            onDelete={props.onDeleteHost}
          />
        </CardBody>
      </details>
    </Card>
  );
}

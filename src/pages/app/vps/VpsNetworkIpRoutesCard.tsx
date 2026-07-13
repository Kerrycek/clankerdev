import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { NetworkInterface } from '../../../lib/api/networkInterfaces';
import type { GateDecision } from '../../../lib/gates/types';
import {
  ipAddressLabel,
  ipFamilyLabel,
  ipLocationLabel,
  ipNetworkLabel,
  ipPurposeLabel,
  labelFromResourceRef,
  routeStateForIp,
  type NetworkRouteState,
} from './VpsNetworkModel';

function routeStateBadgeVariant(state: NetworkRouteState): 'neutral' | 'ok' | 'warn' | 'info' {
  if (state === 'routed') return 'ok';
  if (state === 'active') return 'info';
  if (state === 'busy') return 'warn';
  return 'warn';
}

function routeStateLabelKey(state: NetworkRouteState): string {
  if (state === 'routed') return 'vps.network.state.routed';
  if (state === 'active') return 'vps.network.state.active';
  if (state === 'busy') return 'vps.network.state.busy';
  return 'vps.network.state.detached';
}

export function VpsNetworkIpRoutesCard(props: {
  canAdmin: boolean;
  adminBasePath: string;
  gate: GateDecision;
  isLoading: boolean;
  errorMessage: string | null;
  netifs: NetworkInterface[];
  ipByNetif: Map<number, IpAddress[]>;
  unassignedIps: IpAddress[];
  freeRoutePending: boolean;
  onRefresh: () => void;
  onCreateHostAddress: (ip: IpAddress) => void;
  onEditOwner: (ip: IpAddress) => void;
  onFreeRoute: (ip: IpAddress) => void;
  onAssignRoute: (ip: IpAddress) => void;
}) {
  const { t } = useI18n();
  const gate = props.gate;
  const hasAssignedIps = props.netifs.some((ni) => (props.ipByNetif.get(ni.id) ?? []).length > 0);

  return (
    <Card testId="vps.network.ip_addresses">
      <CardHeader
        title={t('vps.network.routing.title')}
        subtitle={t('vps.network.routing.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={props.onRefresh}>
            {t('common.refresh')}
          </Button>
        }
      />
      <CardBody>
        {props.isLoading ? (
          <div className="py-2">
            <Spinner label={t('common.loading')} />
          </div>
        ) : props.errorMessage ? (
          <Alert title={t('vps.network.ip_addresses.load_error')} variant="danger">
            {props.errorMessage}
          </Alert>
        ) : !hasAssignedIps && props.unassignedIps.length === 0 ? (
          <div className="py-2 text-sm text-muted">{t('vps.network.ip_addresses.empty')}</div>
        ) : (
          <div className="space-y-3">
            {props.netifs.map((ni) => {
              const ips = props.ipByNetif.get(ni.id) ?? [];
              if (ips.length === 0) return null;

              return (
                <Card key={ni.id} testId={`vps.network.ip_addresses.card.${ni.id}`}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {ni.name ?? t('vps.network.interfaces.unnamed')}
                          <span className="text-faint"> · </span>
                          <span className="text-sm text-muted">{String(ni.type ?? '—')}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">{t('vps.network.ip_addresses.count', { n: ips.length })}</div>
                      </div>
                      <Badge variant="neutral">{t('vps.network.ip_addresses.assigned')}</Badge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {ips.map((ip) => {
                        const state = routeStateForIp(ip, !gate.allowed);
                        const owner = labelFromResourceRef(ip.user);

                        return (
                          <div key={ip.id} data-testid={`vps.network.ip_addresses.item.${ip.id}`} className="rounded-md border border-border bg-surface-2 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm">{ipAddressLabel(ip)}</span>
                                <Badge variant={routeStateBadgeVariant(state)}>{t(routeStateLabelKey(state))}</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                <ActionButton
                                  variant="primary"
                                  size="sm"
                                  testId={`vps.network.ip_addresses.item.${ip.id}.host_create`}
                                  disabled={!gate.allowed}
                                  disabledReason={!gate.allowed ? gate.reason : undefined}
                                  onClick={() => props.onCreateHostAddress(ip)}
                                >
                                  {t('vps.network.ip_addresses.action.host_create')}
                                </ActionButton>
                                {props.canAdmin ? (
                                  <>
                                    <Button to={`${props.adminBasePath}/networking/ip-addresses/${ip.id}`} variant="secondary" size="sm" testId={`vps.network.ip_addresses.item.${ip.id}.detail`}>
                                      {t('vps.network.ip_addresses.action.detail')}
                                    </Button>
                                    <ActionButton
                                      variant="secondary"
                                      size="sm"
                                      testId={`vps.network.ip_addresses.item.${ip.id}.owner`}
                                      disabled={!gate.allowed}
                                      disabledReason={!gate.allowed ? gate.reason : undefined}
                                      onClick={() => props.onEditOwner(ip)}
                                    >
                                      {t('vps.network.ip_addresses.action.owner')}
                                    </ActionButton>
                                  </>
                                ) : null}
                                <ActionButton
                                  variant="danger"
                                  size="sm"
                                  testId={`vps.network.ip_addresses.item.${ip.id}.free_route`}
                                  disabled={!gate.allowed}
                                  disabledReason={!gate.allowed ? gate.reason : undefined}
                                  loading={props.freeRoutePending}
                                  onClick={() => props.onFreeRoute(ip)}
                                >
                                  {t('vps.network.ip_addresses.action.free_route')}
                                </ActionButton>
                              </div>
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                              <span>{t('vps.network.ip_addresses.field.network', { network: ipNetworkLabel(ip) })}</span>
                              <span>{t('vps.network.ip_addresses.field.purpose', { purpose: ipPurposeLabel(ip) })}</span>
                              <span>{t('vps.network.ip_addresses.field.owner', { owner })}</span>
                              <span>{t('vps.network.ip_addresses.field.family', { family: ipFamilyLabel(ip) })}</span>
                              <span>{t('vps.network.ip_addresses.field.location', { location: ipLocationLabel(ip) })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              );
            })}

            {props.unassignedIps.length > 0 ? (
              <Alert title={t('vps.network.ip_addresses.unassigned.title')} variant="warn">
                <div className="space-y-2">
                  <div>{t('vps.network.ip_addresses.unassigned.body')}</div>
                  <div className="space-y-1">
                    {props.unassignedIps.map((ip) => (
                      <div key={ip.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-mono">{ipAddressLabel(ip)}</span>
                        <Badge variant={routeStateBadgeVariant(routeStateForIp(ip, !gate.allowed))}>{t(routeStateLabelKey(routeStateForIp(ip, !gate.allowed)))}</Badge>
                        <ActionButton
                          variant="primary"
                          size="sm"
                          testId={`vps.network.ip_addresses.unassigned.${ip.id}.assign`}
                          disabled={!gate.allowed}
                          disabledReason={!gate.allowed ? gate.reason : undefined}
                          onClick={() => props.onAssignRoute(ip)}
                        >
                          {t('vps.network.ip_addresses.action.assign_route')}
                        </ActionButton>
                      </div>
                    ))}
                  </div>
                </div>
              </Alert>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

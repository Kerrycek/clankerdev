import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import {
  assignIpAddressRoute,
  assignIpAddressRouteWithHostAddress,
  fetchIpAddresses,
  type IpAddress,
} from '../../../lib/api/ipAddresses';
import { fetchNetworkInterfaces } from '../../../lib/api/networkInterfaces';
import { fetchVpsList, type Vps } from '../../../lib/api/vps';
import { formatErrorMessage } from '../../../lib/errors';
import type { GateDecision } from '../../../lib/gates/types';
import { objectRef } from '../../../lib/objectRef';
import {
  assignableIpKind,
  assignableIpKindQuery,
  ipAddressLabel,
  isAssignedIp,
  isOwnedByUser,
  matchesAssignableIpKind,
  type AssignableIpKind,
  uniqueIpAddresses,
  vpsLabel,
  vpsLocationId,
} from './IpAddressAssignmentModel';

export function AssignIpAddressModal(props: {
  open: boolean;
  onClose: () => void;
  onAssigned?: (ip: IpAddress) => void;
  fixedVps?: Vps;
  availableVpses?: Vps[];
  initialIp?: IpAddress | null;
  gate?: GateDecision;
  testId?: string;
}) {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();

  const [vpsId, setVpsId] = useState('');
  const [interfaceId, setInterfaceId] = useState('');
  const [kind, setKind] = useState<AssignableIpKind>('ipv4_public');
  const [ipId, setIpId] = useState('');
  const [withHostAddress, setWithHostAddress] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setVpsId(props.fixedVps ? String(props.fixedVps.id) : '');
    setInterfaceId('');
    setKind(props.initialIp ? assignableIpKind(props.initialIp) : 'ipv4_public');
    setIpId(props.initialIp ? String(props.initialIp.id) : '');
    setWithHostAddress(false);
  }, [props.fixedVps?.id, props.initialIp?.id, props.open]);

  const vpsesQ = useQuery({
    queryKey: ['vps', 'list', 'ip-assignment', { limit: 250 }],
    queryFn: async () => (
      await fetchVpsList({ limit: 250, includes: 'node__location__environment,user' })
    ).data,
    enabled: props.open && !props.fixedVps && !props.availableVpses,
    staleTime: 30_000,
  });

  const vpsOptions = props.availableVpses ?? vpsesQ.data ?? [];
  const selectedVps = useMemo(
    () => props.fixedVps ?? vpsOptions.find((vps) => String(vps.id) === vpsId),
    [props.fixedVps, vpsId, vpsOptions]
  );
  const locationId = vpsLocationId(selectedVps);

  const interfacesQ = useQuery({
    queryKey: ['network_interface', 'list', 'ip-assignment', { vpsId: selectedVps?.id ?? null }],
    queryFn: async () => (await fetchNetworkInterfaces(selectedVps!.id, { limit: 100 })).data,
    enabled: props.open && !!selectedVps,
    staleTime: 10_000,
  });

  const kindQuery = assignableIpKindQuery(kind);
  const availableQ = useQuery({
    queryKey: [
      'ip_address',
      'available-for-assignment',
      { locationId, kind, version: kindQuery.version, role: kindQuery.role ?? null },
    ],
    queryFn: async () => (
      await fetchIpAddresses({
        limit: 50,
        location: locationId!,
        version: kindQuery.version,
        role: kindQuery.role,
        purpose: 'vps',
        assignedToInterface: false,
        order: 'interface',
        includes: 'network__primary_location__environment,network_interface,user,vps',
      })
    ).data,
    enabled: props.open && !!selectedVps && !!locationId,
    staleTime: 5_000,
  });

  const availableIps = useMemo(() => {
    const rows = props.initialIp
      ? uniqueIpAddresses([props.initialIp, ...(availableQ.data ?? [])])
      : (availableQ.data ?? []);
    return rows.filter((ip) => !isAssignedIp(ip) && matchesAssignableIpKind(ip, kind));
  }, [availableQ.data, kind, props.initialIp]);

  useEffect(() => {
    if (!props.open || ipId || availableIps.length === 0) return;
    setIpId(String(availableIps[0]?.id ?? ''));
  }, [availableIps, ipId, props.open]);

  useEffect(() => {
    if (!props.open || interfaceId || !interfacesQ.data?.length) return;
    setInterfaceId(String(interfacesQ.data[0]?.id ?? ''));
  }, [interfaceId, interfacesQ.data, props.open]);

  const assignM = useMutation({
    mutationFn: async (payload: { ip: IpAddress; vps: Vps; networkInterface: number; withHostAddress: boolean }) => {
      if (payload.withHostAddress) {
        return assignIpAddressRouteWithHostAddress(payload.ip.id, {
          network_interface: payload.networkInterface,
        });
      }
      return assignIpAddressRoute(payload.ip.id, { network_interface: payload.networkInterface });
    },
    onMutate: (payload) => {
      chrome.acquireLocalLock(objectRef('Vps', payload.vps.id));
    },
    onSuccess: async (response, payload) => {
      const actionStateId = getMetaActionStateId(response.meta);
      if (actionStateId !== undefined) {
        chrome.trackActionState(actionStateId, {
          actionLabelKey: 'action.vps.network.route_assign.label',
          objectLabel: payload.vps.hostname || `#${payload.vps.id}`,
          object: objectRef('Vps', payload.vps.id),
        });
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ip_address'] }),
        qc.invalidateQueries({ queryKey: ['ip_addresses'] }),
        qc.invalidateQueries({ queryKey: ['network_interface'] }),
      ]);

      pushToast({
        variant: 'ok',
        title: t('network.user.assign.toast.assigned'),
        body: t('network.user.assign.toast.assigned_body', {
          address: ipAddressLabel(payload.ip),
          vps: payload.vps.hostname || `#${payload.vps.id}`,
        }),
      });
      props.onAssigned?.(response.data);
      props.onClose();
    },
    onError: (error: any) => {
      if (error?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: (_data, _error, payload) => {
      if (payload) chrome.releaseLocalLock(objectRef('Vps', payload.vps.id));
    },
  });

  const selectedIp = availableIps.find((ip) => String(ip.id) === ipId);
  const selectedInterface = (interfacesQ.data ?? []).find((item) => String(item.id) === interfaceId);
  const gateAllowed = props.gate?.allowed ?? true;
  const gateReason = props.gate && !props.gate.allowed ? props.gate.reason : undefined;
  const canSubmit = !!selectedVps && !!selectedIp && !!selectedInterface && !!locationId && gateAllowed;
  const error = vpsesQ.error ?? interfacesQ.error ?? availableQ.error ?? assignM.error;

  const close = () => {
    if (assignM.isPending) return;
    props.onClose();
  };

  const submit = () => {
    if (!canSubmit || !selectedVps || !selectedIp || !selectedInterface) return;
    assignM.mutate({
      ip: selectedIp,
      vps: selectedVps,
      networkInterface: selectedInterface.id,
      withHostAddress,
    });
  };

  return (
    <Modal
      open={props.open}
      onClose={close}
      title={t('network.user.assign.title')}
      testId={props.testId ?? 'network.user.assign'}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            testId="network.user.assign.cancel"
            onClick={close}
            disabled={assignM.isPending}
          >
            {t('common.cancel')}
          </Button>
          <ActionButton
            variant="primary"
            testId="network.user.assign.submit"
            loading={assignM.isPending}
            disabled={!canSubmit}
            disabledReason={gateReason}
            onClick={submit}
          >
            {t('network.user.assign.submit')}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('network.user.assign.help')}</p>

        {error ? (
          <Alert title={t('network.user.assign.error')} variant="danger">
            {formatErrorMessage(error)}
          </Alert>
        ) : null}

        {!props.fixedVps ? (
          <Select
            label={t('network.user.assign.vps')}
            testId="network.user.assign.vps"
            value={vpsId}
            onChange={(event) => {
              setVpsId(event.target.value);
              setInterfaceId('');
              setIpId('');
            }}
            disabled={vpsesQ.isLoading || assignM.isPending}
            options={[
              { value: '', label: t('network.user.assign.vps.placeholder') },
              ...vpsOptions.map((vps) => ({ value: String(vps.id), label: vpsLabel(vps) })),
            ]}
          />
        ) : (
          <div className="rounded-md border border-border bg-surface-2 p-3 text-sm">
            <div className="text-xs text-muted">{t('network.user.assign.vps')}</div>
            <div className="mt-1 font-medium">{vpsLabel(props.fixedVps)}</div>
          </div>
        )}

        <Select
          label={t('network.user.assign.interface')}
          testId="network.user.assign.interface"
          value={interfaceId}
          onChange={(event) => setInterfaceId(event.target.value)}
          disabled={!selectedVps || interfacesQ.isLoading || assignM.isPending}
          options={[
            { value: '', label: interfacesQ.isLoading ? t('common.loading') : t('network.user.assign.interface.placeholder') },
            ...(interfacesQ.data ?? []).map((item) => ({
              value: String(item.id),
              label: `${item.name || `#${item.id}`} (#${item.id})`,
            })),
          ]}
        />

        <Select
          label={t('network.user.assign.kind')}
          testId="network.user.assign.kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as AssignableIpKind);
            setIpId('');
          }}
          disabled={!selectedVps || assignM.isPending}
          options={[
            { value: 'ipv4_public', label: t('network.user.kind.ipv4_public') },
            { value: 'ipv4_private', label: t('network.user.kind.ipv4_private') },
            { value: 'ipv6', label: t('network.user.kind.ipv6') },
          ]}
        />

        {!selectedVps ? null : !locationId ? (
          <Alert title={t('network.user.assign.location_missing')} variant="warn">
            {t('network.user.assign.location_missing_body')}
          </Alert>
        ) : availableQ.isLoading ? (
          <div className="py-2"><Spinner label={t('common.loading')} /></div>
        ) : (
          <Select
            label={t('network.user.assign.address')}
            testId="network.user.assign.address"
            value={ipId}
            onChange={(event) => setIpId(event.target.value)}
            disabled={assignM.isPending || availableIps.length === 0}
            options={[
              {
                value: '',
                label: availableIps.length > 0
                  ? t('network.user.assign.address.placeholder')
                  : t('network.user.assign.address.none'),
              },
              ...availableIps.map((ip) => ({
                value: String(ip.id),
                label: `${ipAddressLabel(ip)}${isOwnedByUser(ip, resourceIdFromVps(selectedVps)) ? ` · ${t('network.user.assign.address.owned')}` : ''}`,
              })),
            ]}
          />
        )}

        <label className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
          <input
            type="checkbox"
            data-testid="network.user.assign.with_host"
            checked={withHostAddress}
            onChange={(event) => setWithHostAddress(event.target.checked)}
            disabled={assignM.isPending}
            className="mt-0.5 h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35"
          />
          <span>
            <span className="font-medium">{t('network.user.assign.with_host')}</span>
            <span className="mt-0.5 block text-xs text-muted">{t('network.user.assign.with_host_help')}</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

function resourceIdFromVps(vps: Vps | null | undefined): number | null {
  const user = vps?.user;
  if (!user) return null;
  const id = Number(user.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

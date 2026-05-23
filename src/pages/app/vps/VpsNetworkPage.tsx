import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { SummaryGrid } from '../../../components/layout/SummaryGrid';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { StatusDot } from '../../../components/ui/StatusDot';
import { StatCard } from '../../../components/ui/StatCard';
import { Table } from '../../../components/ui/Table';
import { toneSurfaceClass } from '../../../components/ui/tone';
import { fetchIpAddressesForVps, type IpAddress } from '../../../lib/api/ipAddresses';
import { fetchNetworkInterfaceAccountingForVps, fetchNetworkInterfaces, updateNetworkInterface, type NetworkInterface, type NetworkInterfaceAccounting } from '../../../lib/api/networkInterfaces';
import { updateVps } from '../../../lib/api/vps';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return '—';
  const b = Math.max(0, bytes);
  if (b < 1024) return `${b} B`;
  const kib = b / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(1)} MiB`;
  const gib = mib / 1024;
  if (gib < 1024) return `${gib.toFixed(2)} GiB`;
  const tib = gib / 1024;
  return `${tib.toFixed(2)} TiB`;
}

function formatMbpsFromBytesPerSec(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  // Legacy webui treats max_tx/max_rx as bytes/s and displays MiB/s labelled as Mbps.
  // Keep the same arithmetic to avoid surprises.
  return `${Math.round(value / 1024 / 1024)} Mbps`;
}

function groupIpByInterface(ips: IpAddress[]): Map<number, IpAddress[]> {
  const m = new Map<number, IpAddress[]>();

  for (const ip of ips) {
    const ni = ip.network_interface as any;
    const id = typeof ni?.id === 'number' ? ni.id : -1;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(ip);
  }

  return m;
}

function monthKey(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function sumAccountingRows(rows: NetworkInterfaceAccounting[]): { bytesIn: number; bytesOut: number } {
  let bytesIn = 0;
  let bytesOut = 0;

  for (const r of rows) {
    if (typeof r.bytes_in === 'number') bytesIn += r.bytes_in;
    if (typeof r.bytes_out === 'number') bytesOut += r.bytes_out;
  }

  return { bytesIn, bytesOut };
}

function canonicalBool(v: unknown, fallback: boolean): boolean {
  return v === true ? true : v === false ? false : fallback;
}

export function VpsNetworkPage() {
  const auth = useAuth();
  const chrome = useChrome();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();

  const vpsId = vps.id;
  const canAdmin = auth.role === 'admin';

  const netEnabled = canonicalBool((vps as any).enable_network, true);
  const objectLabel = String((vps as any).hostname ?? '') || `#${vpsId}`;

  const netifsQ = useQuery({
    queryKey: ['network_interface', 'list', { vpsId, limit: 100 }],
    queryFn: async () => (await fetchNetworkInterfaces(vpsId, { limit: 100 })).data,
    refetchOnWindowFocus: false,
  });

  const ipsQ = useQuery({
    queryKey: ['ip_address', 'list', { vpsId, limit: 250 }],
    queryFn: async () => (await fetchIpAddressesForVps(vpsId, { limit: 250 })).data,
    refetchOnWindowFocus: false,
  });

  const acctMonth = useMemo(() => monthKey(new Date()), []);

  const acctQ = useQuery({
    queryKey: ['network_interface', 'accounting', { vpsId, year: acctMonth.year, month: acctMonth.month }],
    queryFn: async () => (await fetchNetworkInterfaceAccountingForVps(vpsId, acctMonth.year, acctMonth.month)).data,
    refetchOnWindowFocus: false,
  });

  const acctTotals = useMemo(() => sumAccountingRows(acctQ.data ?? []), [acctQ.data]);

  const ipByNetif = useMemo(() => groupIpByInterface(ipsQ.data ?? []), [ipsQ.data]);

  const [editNetif, setEditNetif] = useState<NetworkInterface | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnable, setEditEnable] = useState(true);
  const [editMaxTx, setEditMaxTx] = useState('');
  const [editMaxRx, setEditMaxRx] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (ni: NetworkInterface) => {
    setEditNetif(ni);
    setEditError(null);
    setEditName(ni.name ?? '');
    setEditEnable(ni.enable !== false);
    setEditMaxTx(typeof ni.max_tx === 'number' ? String(Math.round(ni.max_tx / 1024 / 1024)) : '');
    setEditMaxRx(typeof ni.max_rx === 'number' ? String(Math.round(ni.max_rx / 1024 / 1024)) : '');
  };

  const updateNetifM = useMutation({
    mutationFn: async (payload: { id: number; params: Record<string, unknown> }) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return updateNetworkInterface(payload.id, payload.params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['network_interface', 'list', { vpsId, limit: 100 }] });
      qc.invalidateQueries({ queryKey: ['ip_address', 'list', { vpsId, limit: 250 }] });

      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.network.interface_update.label',
          objectLabel,
          object: vpsRef,
        });
      }

      refetchChains();
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });

  const parseLimit = (raw: string, which: 'tx' | 'rx'): number | null => {
    const v = raw.trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      setEditError(which === 'tx' ? t('vps.network.edit.validation.max_tx') : t('vps.network.edit.validation.max_rx'));
      return null;
    }
    return Math.round(n * 1024 * 1024);
  };

  const editDirty = useMemo(() => {
    if (!editNetif) return false;
    const nameDirty = (editName ?? '').trim() !== String(editNetif.name ?? '');

    if (!canAdmin) return nameDirty;

    const enableDirty = canonicalBool(editEnable, true) !== canonicalBool(editNetif.enable, true);

    const txDirty = (() => {
      const raw = editMaxTx.trim();
      const curr = typeof editNetif.max_tx === 'number' ? String(Math.round(editNetif.max_tx / 1024 / 1024)) : '';
      return raw !== curr;
    })();

    const rxDirty = (() => {
      const raw = editMaxRx.trim();
      const curr = typeof editNetif.max_rx === 'number' ? String(Math.round(editNetif.max_rx / 1024 / 1024)) : '';
      return raw !== curr;
    })();

    return nameDirty || enableDirty || txDirty || rxDirty;
  }, [canAdmin, editEnable, editMaxRx, editMaxTx, editName, editNetif]);

  const saveNetif = async () => {
    if (!editNetif) return;

    const params: Record<string, unknown> = {
      name: editName.trim(),
    };

    if (canAdmin) {
      params['enable'] = editEnable;

      const tx = parseLimit(editMaxTx, 'tx');
      if (editMaxTx.trim() && tx === null) return;
      if (tx !== null) params['max_tx'] = tx;

      const rx = parseLimit(editMaxRx, 'rx');
      if (editMaxRx.trim() && rx === null) return;
      if (rx !== null) params['max_rx'] = rx;
    }

    setEditError(null);

    try {
      await updateNetifM.mutateAsync({ id: editNetif.id, params });
      setEditNetif(null);
    } catch (e: any) {
      setEditError(String(e?.message ?? e));
    }
  };

  // VPS-level enable_network toggle (admin only)
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [confirmEnableOpen, setConfirmEnableOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [netToggleError, setNetToggleError] = useState<string | null>(null);

  const toggleNetM = useMutation({
    mutationFn: async (payload: { enable: boolean; reason?: string }) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });

      const params: Record<string, unknown> = { enable_network: payload.enable };
      if (!payload.enable && String(payload.reason ?? '').trim()) {
        params['change_reason'] = String(payload.reason ?? '').trim();
      }

      return updateVps(vpsId, params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r, vars) => {
      setNetToggleError(null);
      refetch();
      qc.invalidateQueries({ queryKey: ['network_interface', 'list', { vpsId, limit: 100 }] });
      qc.invalidateQueries({ queryKey: ['ip_address', 'list', { vpsId, limit: 250 }] });

      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: vars.enable ? 'action.vps.network.enable.label' : 'action.vps.network.disable.label',
          objectLabel,
          object: vpsRef,
        });
      }

      refetchChains();
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
      setNetToggleError(String(e?.message ?? e));
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });

  const busyLocal = busyLocalLock || updateNetifM.isPending || toggleNetM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });

  const netifs = netifsQ.data ?? [];

  const unassignedIps = ipByNetif.get(-1) ?? [];

  const showGateAlert = !gate.allowed;

  return (
    <div data-testid="vps.network.page" className="space-y-4">
      <Card testId="vps.network.summary">
        <CardHeader
          title={t('vps.network.title')}
          subtitle={t('vps.network.subtitle')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                testId="vps.network.accounting.refresh"
                onClick={() => {
                  void acctQ.refetch();
                  void netifsQ.refetch();
                  void ipsQ.refetch();
                }}
              >
                {t('common.refresh')}
              </Button>
              <Badge variant={netEnabled ? 'ok' : 'warn'}>
                {netEnabled ? t('vps.network.status.enabled') : t('vps.network.status.disabled')}
              </Badge>

              {canAdmin ? (
                netEnabled ? (
                  <ActionButton
                    testId="vps.network.disable"
                    variant="danger"
                    size="sm"
                    disabled={!gate.allowed}
                    disabledReason={!gate.allowed ? gate.reason : undefined}
                    onClick={() => {
                      setNetToggleError(null);
                      setConfirmDisableOpen(true);
                    }}
                  >
                    {t('vps.network.disable_button')}
                  </ActionButton>
                ) : (
                  <ActionButton
                    testId="vps.network.enable"
                    variant="primary"
                    size="sm"
                    disabled={!gate.allowed}
                    disabledReason={!gate.allowed ? gate.reason : undefined}
                    onClick={() => {
                      setNetToggleError(null);
                      setConfirmEnableOpen(true);
                    }}
                  >
                    {t('vps.network.enable_button')}
                  </ActionButton>
                )
              ) : null}
            </div>
          }
        />

        <CardBody>
          {showGateAlert ? (
            <Alert title={t(gate.reason.titleKey)} variant="warn">
              <div className="space-y-2">
                {gate.reason.descriptionKey ? <div>{t(gate.reason.descriptionKey)}</div> : null}
                <div>
                  <Button variant="secondary" size="sm" onClick={chrome.openTasks}>
                    {t('common.open_tasks')}
                  </Button>
                </div>
              </div>
            </Alert>
          ) : null}

          {netToggleError ? (
            <Alert title={t('vps.network.toggle_error.title')} variant="danger" className={showGateAlert ? 'mt-3' : ''}>
              {netToggleError}
            </Alert>
          ) : null}

          <div className="mt-4">
            <SummaryGrid testId="vps.network.accounting.grid">
              <StatCard
                testId="vps.network.accounting.in"
                className="md:col-span-4"
                variant="compact"
                title={t('vps.network.accounting.ingress')}
                value={acctQ.isLoading ? t('common.loading') : formatBytes(acctTotals.bytesIn)}
                subtitle={t('vps.network.accounting.period', {
                  year: acctMonth.year,
                  month: String(acctMonth.month).padStart(2, '0'),
                })}
              />
              <StatCard
                testId="vps.network.accounting.out"
                className="md:col-span-4"
                variant="compact"
                title={t('vps.network.accounting.egress')}
                value={acctQ.isLoading ? t('common.loading') : formatBytes(acctTotals.bytesOut)}
                subtitle={t('vps.network.accounting.period', {
                  year: acctMonth.year,
                  month: String(acctMonth.month).padStart(2, '0'),
                })}
              />
              <StatCard
                testId="vps.network.accounting.status"
                className="md:col-span-4"
                variant="compact"
                title={t('vps.network.accounting.status')}
                value={acctQ.isError ? t('vps.network.accounting.error') : t('vps.network.accounting.ok')}
                subtitle={t('vps.network.accounting.note')}
              />
            </SummaryGrid>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.network.interfaces">
        <CardHeader
          title={t('vps.network.interfaces.title')}
          subtitle={canAdmin ? t('vps.network.interfaces.subtitle_admin') : t('vps.network.interfaces.subtitle_user')}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void netifsQ.refetch()}>
              {t('common.refresh')}
            </Button>
          }
        />

        <CardBody>
          {netifsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t('common.loading')} />
            </div>
          ) : netifsQ.isError ? (
            <Alert title={t('vps.network.interfaces.load_error')} variant="danger">
              {String((netifsQ.error as any)?.message ?? netifsQ.error)}
            </Alert>
          ) : netifs.length === 0 ? (
            <div className="py-2 text-sm text-muted">{t('vps.network.interfaces.empty')}</div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {netifs.map((ni) => {
                  const ips = ipByNetif.get(ni.id) ?? [];
                  const rowVariant = ni.enable === false ? 'warn' : 'ok';
                  return (
                    <Card key={ni.id} testId={`vps.network.interfaces.card.${ni.id}`} className={ni.enable === false ? toneSurfaceClass('warn') : undefined}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusDot variant={rowVariant} testId={`vps.network.interfaces.card.${ni.id}.dot`} />
                              <div className="truncate text-base font-semibold">{ni.name ?? t('vps.network.interfaces.unnamed')}</div>
                              <Badge variant="neutral">{String(ni.type ?? '—')}</Badge>
                              {canAdmin ? (
                                <Badge variant={ni.enable !== false ? 'ok' : 'warn'}>
                                  {ni.enable !== false ? t('vps.network.interfaces.enabled') : t('vps.network.interfaces.disabled')}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {t('vps.network.interfaces.ip_count', { n: ips.length })}
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            testId={`vps.network.interfaces.card.${ni.id}.edit`}
                            onClick={() => openEdit(ni)}
                          >
                            {t('common.edit')}
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <div>
                            <div className="text-xs text-muted">{t('vps.network.interfaces.max_tx')}</div>
                            <div className="font-mono">{formatMbpsFromBytesPerSec(ni.max_tx as any)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">{t('vps.network.interfaces.max_rx')}</div>
                            <div className="font-mono">{formatMbpsFromBytesPerSec(ni.max_rx as any)}</div>
                          </div>
                        </div>

                        {ips.length > 0 ? (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted">{t('vps.network.ip_addresses.title')}</div>
                            <div className="mt-1 space-y-1">
                              {ips.map((ip) => (
                                <div key={ip.id} className="text-sm">
                                  <span className="font-mono">{String((ip as any).address ?? (ip as any).addr ?? '—')}</span>
                                  {(ip as any).purpose || (ip as any).routed ? (
                                    <span className="ml-2 text-xs text-muted">
                                      {(ip as any).purpose ? String((ip as any).purpose) : ''}
                                      {(ip as any).routed ? ` · ${t('vps.network.ip_addresses.routed')}` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table testId="vps.network.interfaces.table" minWidth="md">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-3"></th>
                      <th className="px-4 py-3">{t('vps.network.interfaces.field.name')}</th>
                      <th className="px-4 py-3">{t('vps.network.interfaces.field.type')}</th>
                      <th className="px-4 py-3">{t('vps.network.interfaces.field.ip_count')}</th>
                      {canAdmin ? <th className="px-4 py-3">{t('vps.network.interfaces.field.enabled')}</th> : null}
                      <th className="px-4 py-3">{t('vps.network.interfaces.field.max_tx')}</th>
                      <th className="px-4 py-3">{t('vps.network.interfaces.field.max_rx')}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {netifs.map((ni) => {
                      const ips = ipByNetif.get(ni.id) ?? [];
                      return (
                        <tr
                          key={ni.id}
                          data-testid={`vps.network.interfaces.row.${ni.id}`}
                          data-row-variant={ni.enable === false ? 'warn' : undefined}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="px-4 py-3">
                            <StatusDot variant={ni.enable === false ? 'warn' : 'ok'} testId={`vps.network.interfaces.row.${ni.id}.dot`} />
                          </td>
                          <td className="px-4 py-3 font-medium">{ni.name ?? '—'}</td>
                          <td className="px-4 py-3">{String(ni.type ?? '—')}</td>
                          <td className="px-4 py-3">{ips.length}</td>
                          {canAdmin ? (
                            <td className="px-4 py-3">
                              <Badge variant={ni.enable !== false ? 'ok' : 'warn'}>
                                {ni.enable !== false ? t('vps.network.interfaces.enabled') : t('vps.network.interfaces.disabled')}
                              </Badge>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-mono text-xs">{formatMbpsFromBytesPerSec(ni.max_tx as any)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{formatMbpsFromBytesPerSec(ni.max_rx as any)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              testId={`vps.network.interfaces.row.${ni.id}.edit`}
                              onClick={() => openEdit(ni)}
                            >
                              {t('common.edit')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card testId="vps.network.ip_addresses">
        <CardHeader
          title={t('vps.network.ip_addresses.title')}
          subtitle={t('vps.network.ip_addresses.subtitle')}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void ipsQ.refetch()}>
              {t('common.refresh')}
            </Button>
          }
        />
        <CardBody>
          {ipsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t('common.loading')} />
            </div>
          ) : ipsQ.isError ? (
            <Alert title={t('vps.network.ip_addresses.load_error')} variant="danger">
              {String((ipsQ.error as any)?.message ?? ipsQ.error)}
            </Alert>
          ) : (ipsQ.data ?? []).length === 0 ? (
            <div className="py-2 text-sm text-muted">{t('vps.network.ip_addresses.empty')}</div>
          ) : (
            <div className="space-y-3">
              {netifs.map((ni) => {
                const ips = ipByNetif.get(ni.id) ?? [];
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
                          const addr = String((ip as any).address ?? (ip as any).addr ?? '—');
                          const net = String((ip.network as any)?.address ?? (ip.network as any)?.label ?? '');
                          const purpose = (ip as any).purpose ? String((ip as any).purpose) : '';
                          const routed = Boolean((ip as any).routed);

                          return (
                            <div key={ip.id} data-testid={`vps.network.ip_addresses.item.${ip.id}`} className="rounded-md border border-border bg-surface-2 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-mono text-sm">{addr}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                  {routed ? <Badge variant="neutral">{t('vps.network.ip_addresses.routed')}</Badge> : null}
                                </div>
                              </div>

                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                                <span>{t('vps.network.ip_addresses.field.network', { network: net || '—' })}</span>
                                <span>{t('vps.network.ip_addresses.field.purpose', { purpose: purpose || '—' })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}

              {unassignedIps.length > 0 ? (
                <Alert title={t('vps.network.ip_addresses.unassigned.title')} variant="warn">
                  <div className="space-y-2">
                    <div>{t('vps.network.ip_addresses.unassigned.body')}</div>
                    <div className="space-y-1">
                      {unassignedIps.map((ip) => (
                        <div key={ip.id} className="font-mono text-sm">
                          {String((ip as any).address ?? (ip as any).addr ?? '—')}
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

      <Modal
        open={!!editNetif}
        testId="vps.network.edit"
        title={
          editNetif
            ? t('vps.network.edit.title', { name: String(editNetif.name ?? editNetif.type ?? editNetif.id) })
            : t('vps.network.edit.title_fallback')
        }
        onClose={() => setEditNetif(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.edit.cancel"
              onClick={() => setEditNetif(null)}
              disabled={updateNetifM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <ActionButton
              testId="vps.network.edit.save"
              disabled={!editDirty || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={updateNetifM.isPending}
              onClick={() => void saveNetif()}
            >
              {t('common.save')}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          {editError ? <Alert title={t('vps.network.edit.error.title')} variant="danger">{editError}</Alert> : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.network.interfaces.field.name')}</div>
            <div className="mt-1">
              <Input
                testId="vps.network.edit.name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('vps.network.interfaces.name_placeholder')}
                autoComplete="off"
              />
            </div>
          </div>

          {canAdmin ? (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    data-testid="vps.network.edit.enabled"
                    type="checkbox"
                    checked={editEnable}
                    onChange={(e) => setEditEnable(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
                  />
                  <span>{t('vps.network.interfaces.field.enabled')}</span>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted">{t('vps.network.interfaces.field.max_tx')}</div>
                  <div className="mt-1">
                    <Input
                      testId="vps.network.edit.max_tx"
                      value={editMaxTx}
                      onChange={(e) => setEditMaxTx(e.target.value)}
                      placeholder="1000"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted">{t('vps.network.interfaces.field.max_rx')}</div>
                  <div className="mt-1">
                    <Input
                      testId="vps.network.edit.max_rx"
                      value={editMaxRx}
                      onChange={(e) => setEditMaxRx(e.target.value)}
                      placeholder="1000"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted">
                <div>{t('vps.network.edit.basic_limits_note')}</div>
                <div>{t('vps.network.edit.advanced_limits_note')}</div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">{t('vps.network.edit.user_mode_hint')}</div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        testId="vps.network.disable_confirm"
        open={confirmDisableOpen}
        title={t('vps.network.disable_dialog.title')}
        description={t('vps.network.disable_dialog.description')}
        danger
        confirmLabel={t('vps.network.disable_button')}
        confirmLoading={toggleNetM.isPending}
        confirmDisabled={!gate.allowed}
        onCancel={() => setConfirmDisableOpen(false)}
        onConfirm={async () => {
          try {
            await toggleNetM.mutateAsync({ enable: false, reason: changeReason });
            setConfirmDisableOpen(false);
            setChangeReason('');
          } catch {
            // errors are shown via netToggleError
          }
        }}
      >
        <div>
          <div className="text-xs font-medium text-muted">{t('vps.network.change_reason.label')}</div>
          <div className="mt-1">
            <Input
              testId="vps.network.disable.reason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder={t('vps.network.change_reason.placeholder')}
              autoComplete="off"
            />
          </div>
          <div className="mt-1 text-xs text-muted">{t('vps.network.change_reason.help')}</div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        testId="vps.network.enable_confirm"
        open={confirmEnableOpen}
        title={t('vps.network.enable_dialog.title')}
        description={t('vps.network.enable_dialog.description')}
        confirmLabel={t('vps.network.enable_button')}
        confirmLoading={toggleNetM.isPending}
        confirmDisabled={!gate.allowed}
        onCancel={() => setConfirmEnableOpen(false)}
        onConfirm={async () => {
          try {
            await toggleNetM.mutateAsync({ enable: true });
            setConfirmEnableOpen(false);
          } catch {
            // errors are shown via netToggleError
          }
        }}
      />
    </div>
  );
}

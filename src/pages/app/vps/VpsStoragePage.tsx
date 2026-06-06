import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ChipLink } from '../../../components/ui/ChipLink';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Table } from '../../../components/ui/Table';
import { fetchDataset, type Dataset as StorageDataset } from '../../../lib/api/datasets';
import { createVpsMount, deleteVpsMount, fetchVpsMounts, findDatasetByName, updateVpsMount, type Dataset, type VpsMount } from '../../../lib/api/vpsMounts';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { formatDateTime, formatMiB } from '../../../lib/format';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function datasetLabel(d: any): string {
  return d?.name ?? d?.label ?? (d?.id ? `#${d.id}` : '—');
}

function datasetId(d: any): number | null {
  const id = Number(d?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function canonicalBool(v: unknown, fallback: boolean): boolean {
  return v === true ? true : v === false ? false : fallback;
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function positiveNumber(v: unknown): number | null {
  const n = finiteNumber(v);
  return n !== null && n > 0 ? n : null;
}

function rootDatasetField(ds: StorageDataset | null | undefined, fallback: any, key: string): unknown {
  if (ds && (ds as any)[key] !== undefined) return (ds as any)[key];
  return fallback?.[key];
}

export function VpsStoragePage() {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const chrome = useChrome();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { vps, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();

  const canAdmin = auth.role === 'admin';
  const vpsId = vps.id;
  const objectLabel = String((vps as any).hostname ?? '') || `#${vpsId}`;

  const mountsQ = useQuery({
    queryKey: ['vps', vpsId, 'mounts'],
    queryFn: async () => (await fetchVpsMounts(vpsId)).data,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vps', vpsId, 'mounts'] });

  const preflight = async () => {
    await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
  };

  const createMountM = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      await preflight();
      return createVpsMount(vpsId, params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r) => {
      invalidate();
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.mount.create.label',
          objectLabel,
          object: vpsRef,
          progressTitleKey: 'modal.vps.mount.create.title',
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

  const updateMountM = useMutation({
    mutationFn: async (payload: { mountId: number; params: Record<string, unknown> }) => {
      await preflight();
      return updateVpsMount(vpsId, payload.mountId, payload.params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r) => {
      invalidate();
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.mount.update.label',
          objectLabel,
          object: vpsRef,
          progressTitleKey: 'modal.vps.mount.update.title',
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

  const deleteMountM = useMutation({
    mutationFn: async (mountId: number) => {
      await preflight();
      return deleteVpsMount(vpsId, mountId);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r) => {
      invalidate();
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.mount.delete.label',
          objectLabel,
          object: vpsRef,
          progressTitleKey: 'modal.vps.mount.delete.title',
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

  const busyLocal = busyLocalLock || createMountM.isPending || updateMountM.isPending || deleteMountM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });

  // ---------------------------
  // Create & edit modals state
  // ---------------------------

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [datasetName, setDatasetName] = useState('');
  const [foundDataset, setFoundDataset] = useState<Dataset | null>(null);
  const [findError, setFindError] = useState<string | null>(null);

  const [mountpoint, setMountpoint] = useState('');
  const [type, setType] = useState<'nfs' | 'bind'>('nfs');
  const [mode, setMode] = useState<'ro' | 'rw'>('rw');
  const [onStartFail, setOnStartFail] = useState<'ignore' | 'umount' | 'fail'>('ignore');
  const [enabled, setEnabled] = useState(true);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [useDefaultMap, setUseDefaultMap] = useState(true);

  const onStartFailOptions = useMemo(
    () => [
      {
        value: 'ignore',
        label: t('vps.storage.on_start_fail.ignore.label'),
        desc: t('vps.storage.on_start_fail.ignore.desc'),
      },
      {
        value: 'umount',
        label: t('vps.storage.on_start_fail.umount.label'),
        desc: t('vps.storage.on_start_fail.umount.desc'),
      },
      {
        value: 'fail',
        label: t('vps.storage.on_start_fail.fail.label'),
        desc: t('vps.storage.on_start_fail.fail.desc'),
      },
    ],
    [t]
  );

  const resetCreate = () => {
    setDatasetName('');
    setFoundDataset(null);
    setFindError(null);
    setMountpoint('');
    setType('nfs');
    setMode('rw');
    setOnStartFail('ignore');
    setEnabled(true);
    setMasterEnabled(true);
    setUseDefaultMap(true);
    setCreateError(null);
  };

  const findDatasetM = useMutation({
    mutationFn: async (name: string) => {
      const q = name.trim();
      if (!q) throw new Error(t('vps.storage.dataset_find.validation.empty'));
      return findDatasetByName(q);
    },
    onSuccess: (r) => {
      setFindError(null);
      setFoundDataset(r.data as any);
    },
    onError: (e: any) => {
      setFoundDataset(null);
      setFindError(String(e?.message ?? e));
    },
  });

  const canCreate = !!foundDataset && mountpoint.trim().length > 0;

  const submitCreate = async () => {
    setCreateError(null);

    if (!foundDataset) {
      setCreateError(t('vps.storage.create.validation.dataset_required'));
      return;
    }

    if (!mountpoint.trim()) {
      setCreateError(t('vps.storage.create.validation.mountpoint_required'));
      return;
    }

    const params = compact({
      dataset: foundDataset.id,
      mountpoint: mountpoint.trim(),
      type,
      mode,
      on_start_fail: onStartFail,
      enabled,
      master_enabled: canAdmin ? masterEnabled : undefined,
      use_default_map: useDefaultMap,
    });

    try {
      await createMountM.mutateAsync(params);
      setCreateOpen(false);
      resetCreate();
    } catch (e: any) {
      setCreateError(String(e?.message ?? e));
    }
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editMount, setEditMount] = useState<VpsMount | null>(null);

  const openEdit = (m: VpsMount) => {
    setEditError(null);
    setEditMount(m);
    setEditOpen(true);

    setMountpoint(String((m as any).mountpoint ?? ''));
    setType(((m as any).type ?? 'nfs') as any);
    setMode(((m as any).mode ?? 'rw') as any);
    setOnStartFail(((m as any).on_start_fail ?? 'ignore') as any);
    setEnabled(canonicalBool((m as any).enabled, true));
    setMasterEnabled(canonicalBool((m as any).master_enabled, true));
    setUseDefaultMap(canonicalBool((m as any).use_default_map, true));
  };

  const editDirty = useMemo(() => {
    if (!editMount) return false;

    const mp = mountpoint.trim() !== String((editMount as any).mountpoint ?? '');
    const ty = type !== String((editMount as any).type ?? 'nfs');
    const mo = mode !== String((editMount as any).mode ?? 'rw');
    const osf = onStartFail !== String((editMount as any).on_start_fail ?? 'ignore');
    const en = enabled !== canonicalBool((editMount as any).enabled, true);
    const me = masterEnabled !== canonicalBool((editMount as any).master_enabled, true);
    const dm = useDefaultMap !== canonicalBool((editMount as any).use_default_map, true);

    return mp || ty || mo || osf || en || (canAdmin && me) || dm;
  }, [canAdmin, editMount, enabled, masterEnabled, mode, mountpoint, onStartFail, type, useDefaultMap]);

  const submitEdit = async () => {
    setEditError(null);
    if (!editMount) return;

    if (!mountpoint.trim()) {
      setEditError(t('vps.storage.edit.validation.mountpoint_required'));
      return;
    }

    const params = compact({
      mountpoint: mountpoint.trim(),
      type,
      mode,
      on_start_fail: onStartFail,
      enabled,
      master_enabled: canAdmin ? masterEnabled : undefined,
      use_default_map: useDefaultMap,
    });

    try {
      await updateMountM.mutateAsync({ mountId: editMount.id, params });
      setEditOpen(false);
      setEditMount(null);
    } catch (e: any) {
      setEditError(String(e?.message ?? e));
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VpsMount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const openDelete = (m: VpsMount) => {
    setDeleteError(null);
    setDeleteConfirmation('');
    setDeleteTarget(m);
    setDeleteOpen(true);
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    const expected = String((deleteTarget as any).mountpoint ?? deleteTarget.id);
    if (deleteConfirmation !== expected) return;
    setDeleteError(null);
    try {
      await deleteMountM.mutateAsync(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmation('');
    } catch (e: any) {
      setDeleteError(String(e?.message ?? e));
    }
  };

  const mounts = mountsQ.data ?? [];
  const rootDatasetId = datasetId((vps as any).dataset);
  const rootDatasetLabel = datasetLabel((vps as any).dataset);

  const rootDatasetQ = useQuery({
    queryKey: ['datasets', 'show', rootDatasetId, 'vps-storage-root'],
    enabled: rootDatasetId !== null,
    queryFn: async () => (await fetchDataset(rootDatasetId as number, { includes: 'vps,environment' })).data,
    refetchOnWindowFocus: false,
  });

  const rootDataset = rootDatasetQ.data ?? null;
  const rootDatasetFallback = (vps as any).dataset;
  const rootUsed = finiteNumber(rootDatasetField(rootDataset, rootDatasetFallback, 'used'));
  const rootAvail = finiteNumber(rootDatasetField(rootDataset, rootDatasetFallback, 'avail'));
  const rootRefquota = positiveNumber(rootDatasetField(rootDataset, rootDatasetFallback, 'refquota'));
  const rootQuota = positiveNumber(rootDatasetField(rootDataset, rootDatasetFallback, 'quota'));
  const rootReferenced = finiteNumber(rootDatasetField(rootDataset, rootDatasetFallback, 'referenced'));
  const rootMountCount = rootDatasetField(rootDataset, rootDatasetFallback, 'mount_count');
  const rootSnapshotCount = rootDatasetField(rootDataset, rootDatasetFallback, 'snapshots_count');
  const rootExportCount = rootDatasetField(rootDataset, rootDatasetFallback, 'export_count');
  const rootState = rootDatasetField(rootDataset, rootDatasetFallback, 'object_state');

  return (
    <div data-testid="vps.storage.page" className="space-y-4">
      <Card testId="vps.storage.summary">
        <CardHeader
          title={t('vps.storage.title')}
          subtitle={t('vps.storage.subtitle')}
          actions={
            <ActionButton
              testId="vps.storage.mounts.add"
              variant="primary"
              size="sm"
              disabled={!gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              onClick={() => {
                resetCreate();
                setCreateOpen(true);
              }}
            >
              {t('vps.storage.add_mount')}
            </ActionButton>
          }
        />
        <CardBody>
          {!gate.allowed ? (
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

          <div className={!gate.allowed ? 'mt-4' : ''}>
            <div className="text-sm text-muted">{t('vps.storage.mount_count', { n: mounts.length })}</div>
          </div>
        </CardBody>
      </Card>

      {rootDatasetId ? (
        <Card testId="vps.storage.root_dataset">
          <CardHeader
            title={t('vps.storage.root_dataset.title')}
            subtitle={t('vps.storage.root_dataset.subtitle', { dataset: rootDatasetLabel })}
          />
          <CardBody>
            {rootDatasetQ.isLoading ? (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted" data-testid="vps.storage.root_dataset.loading">
                <Spinner /> {t('common.loading')}
              </div>
            ) : rootDatasetQ.isError ? (
              <div className="mb-3">
                <Alert title={t('vps.storage.root_dataset.load_error')} variant="danger">
                  {String((rootDatasetQ.error as any)?.message ?? rootDatasetQ.error)}
                </Alert>
              </div>
            ) : null}

            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="vps.storage.root_dataset.metadata">
              <div>
                <div className="text-xs text-faint">{t('dataset.field.used')}</div>
                <div className="font-medium text-fg">{rootUsed !== null ? formatMiB(rootUsed) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.available')}</div>
                <div className="font-medium text-fg">{rootAvail !== null ? formatMiB(rootAvail) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.reference_quota')}</div>
                <div className="font-medium text-fg">{rootRefquota !== null ? formatMiB(rootRefquota) : '∞'}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.quota')}</div>
                <div className="font-medium text-fg">{rootQuota !== null ? formatMiB(rootQuota) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.referenced')}</div>
                <div className="font-medium text-fg">{rootReferenced !== null ? formatMiB(rootReferenced) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('common.state')}</div>
                <div className="font-medium text-fg">{rootState ? String(rootState) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('vps.storage.root_dataset.related')}</div>
                <div className="font-medium text-fg">
                  {t('vps.storage.root_dataset.related_counts', {
                    snapshots: rootSnapshotCount ?? t('common.na'),
                    mounts: rootMountCount ?? t('common.na'),
                    exports: rootExportCount ?? t('common.na'),
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}`} data-testid="vps.storage.root_dataset.open">
                {t('vps.storage.root_dataset.open')}
              </ChipLink>
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}/snapshots`} data-testid="vps.storage.root_dataset.snapshots">
                {t('vps.storage.root_dataset.snapshots')}
              </ChipLink>
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}/snapshots?action=create`} data-testid="vps.storage.root_dataset.create_snapshot">
                {t('vps.storage.root_dataset.create_snapshot')}
              </ChipLink>
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}/snapshots`} data-testid="vps.storage.root_dataset.restore">
                {t('vps.storage.root_dataset.restore')}
              </ChipLink>
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}/downloads?action=create`} data-testid="vps.storage.root_dataset.backup">
                {t('vps.storage.root_dataset.backup')}
              </ChipLink>
              <ChipLink to={`${basePath}/datasets/${rootDatasetId}/downloads`} data-testid="vps.storage.root_dataset.downloads">
                {t('vps.storage.root_dataset.downloads')}
              </ChipLink>
            </div>
            <div className="mt-3 text-xs text-muted">{t('vps.storage.root_dataset.data_loss_note')}</div>
          </CardBody>
        </Card>
      ) : null}

      <Card testId="vps.storage.mounts">
        <CardHeader
          title={t('vps.storage.mounts.title')}
          subtitle={t('vps.storage.mounts.subtitle')}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void mountsQ.refetch()}>
              {t('common.refresh')}
            </Button>
          }
        />

        <CardBody>
          {mountsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t('common.loading')} />
            </div>
          ) : mountsQ.isError ? (
            <Alert title={t('vps.storage.mounts.load_error')} variant="danger">
              {String((mountsQ.error as any)?.message ?? mountsQ.error)}
            </Alert>
          ) : mounts.length === 0 ? (
            <div className="py-2 text-sm text-muted">{t('vps.storage.mounts.empty')}</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {mounts.map((m) => {
                  const ds = datasetLabel((m as any).dataset);
                  const dsId = datasetId((m as any).dataset);
                  return (
                    <Card key={m.id} testId={`vps.storage.mounts.card.${m.id}`}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold">{String((m as any).mountpoint ?? '—')}</div>
                            <div className="mt-1 text-xs text-muted">
                              {dsId ? (
                                <ChipLink to={`${basePath}/datasets/${dsId}`} data-testid={`vps.storage.mounts.card.${m.id}.dataset`}>
                                  {ds}
                                </ChipLink>
                              ) : (
                                t('vps.storage.mounts.dataset', { dataset: ds })
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant={canonicalBool((m as any).enabled, true) ? 'ok' : 'warn'}>
                              {canonicalBool((m as any).enabled, true) ? t('common.enabled') : t('common.disabled')}
                            </Badge>
                            {canAdmin ? (
                              <Badge variant={canonicalBool((m as any).master_enabled, true) ? 'neutral' : 'warn'}>
                                {t('vps.storage.mounts.master_short')}:{' '}
                                {canonicalBool((m as any).master_enabled, true) ? t('common.yes') : t('common.no')}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          <span>{t('vps.storage.mounts.field.mode', { mode: String((m as any).mode ?? '—') })}</span>
                          <span>{t('vps.storage.mounts.field.type', { type: String((m as any).type ?? '—') })}</span>
                          <span>
                            {t('vps.storage.mounts.field.on_start_fail', { value: String((m as any).on_start_fail ?? '—') })}
                          </span>
                          <span>
                            {t('vps.storage.mounts.field.default_map', {
                              value: canonicalBool((m as any).use_default_map, true) ? t('common.yes') : t('common.no'),
                            })}
                          </span>
                          <span>
                            {t('vps.storage.mounts.field.current_state', {
                              value: String((m as any).current_state ?? t('common.na')),
                            })}
                          </span>
                          {(m as any).expiration_date ? (
                            <span>
                              {t('vps.storage.mounts.field.expiration', {
                                value: formatDateTime((m as any).expiration_date),
                              })}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            testId={`vps.storage.mounts.card.${m.id}.edit`}
                            onClick={() => openEdit(m)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            testId={`vps.storage.mounts.card.${m.id}.delete`}
                            onClick={() => openDelete(m)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table testId="vps.storage.mounts.table" minWidth="lg">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.mountpoint')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.dataset')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.mode_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.type_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.enabled_short')}</th>
                      {canAdmin ? <th className="px-4 py-3">{t('vps.storage.mounts.field.master_short')}</th> : null}
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.on_start_fail_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.default_map_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.current_state_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.expiration_short')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.created')}</th>
                      <th className="px-4 py-3">{t('vps.storage.mounts.field.updated')}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mounts.map((m) => {
                      const ds = datasetLabel((m as any).dataset);
                      const dsId = datasetId((m as any).dataset);
                      const enabledLabel = canonicalBool((m as any).enabled, true) ? t('common.yes') : t('common.no');
                      const masterLabel = canonicalBool((m as any).master_enabled, true) ? t('common.yes') : t('common.no');
                      return (
                        <tr
                          key={m.id}
                          data-testid={`vps.storage.mounts.row.${m.id}`}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <td className="px-4 py-3 font-medium">{String((m as any).mountpoint ?? '—')}</td>
                          <td className="px-4 py-3">
                            {dsId ? (
                              <ChipLink to={`${basePath}/datasets/${dsId}`} data-testid={`vps.storage.mounts.row.${m.id}.dataset`}>
                                {ds}
                              </ChipLink>
                            ) : (
                              ds
                            )}
                          </td>
                          <td className="px-4 py-3">{String((m as any).mode ?? '—')}</td>
                          <td className="px-4 py-3">{String((m as any).type ?? '—')}</td>
                          <td className="px-4 py-3">
                            <Badge variant={canonicalBool((m as any).enabled, true) ? 'ok' : 'warn'}>{enabledLabel}</Badge>
                          </td>
                          {canAdmin ? (
                            <td className="px-4 py-3">
                              <Badge variant={canonicalBool((m as any).master_enabled, true) ? 'neutral' : 'warn'}>
                                {masterLabel}
                              </Badge>
                            </td>
                          ) : null}
                          <td className="px-4 py-3">{String((m as any).on_start_fail ?? '—')}</td>
                          <td className="px-4 py-3">{canonicalBool((m as any).use_default_map, true) ? t('common.yes') : t('common.no')}</td>
                          <td className="px-4 py-3">{String((m as any).current_state ?? '—')}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDateTime((m as any).expiration_date)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDateTime((m as any).created_at)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDateTime((m as any).updated_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                testId={`vps.storage.mounts.row.${m.id}.edit`}
                                onClick={() => openEdit(m)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                testId={`vps.storage.mounts.row.${m.id}.delete`}
                                onClick={() => openDelete(m)}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
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

      <Modal
        open={createOpen}
        testId="vps.storage.mounts.create"
        title={t('vps.storage.create.title')}
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.storage.mounts.create.cancel"
              onClick={() => setCreateOpen(false)}
              disabled={createMountM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <ActionButton
              testId="vps.storage.mounts.create.submit"
              disabled={!canCreate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={createMountM.isPending}
              onClick={() => void submitCreate()}
            >
              {t('common.create')}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          {createError ? (
            <Alert title={t('vps.storage.create.error.title')} variant="danger">
              {createError}
            </Alert>
          ) : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.storage.dataset_find.label')}</div>
            <div className="mt-1 flex items-center gap-2">
              <Input
                testId="vps.storage.mounts.create.dataset"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder={t('vps.storage.dataset_find.placeholder')}
                autoComplete="off"
              />
              <Button
                variant="secondary"
                size="sm"
                testId="vps.storage.mounts.create.find_dataset"
                onClick={() => void findDatasetM.mutate(datasetName)}
                loading={findDatasetM.isPending}
              >
                {t('common.find')}
              </Button>
            </div>
            {findError ? <div className="mt-1 text-xs text-danger">{findError}</div> : null}
            {foundDataset ? (
              <div className="mt-2 rounded-md border border-border bg-surface-2 p-2 text-sm">
                <div className="font-medium">{datasetLabel(foundDataset)}</div>
                <div className="mt-0.5 text-xs text-muted">#{(foundDataset as any).id}</div>
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.storage.create.field.mountpoint')}</div>
            <div className="mt-1">
              <Input
                testId="vps.storage.mounts.create.mountpoint"
                value={mountpoint}
                onChange={(e) => setMountpoint(e.target.value)}
                placeholder="/mnt/data"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-muted">{t('vps.storage.create.field.type')}</div>
              <div className="mt-1">
                <Select
                  testId="vps.storage.mounts.create.type"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  options={[
                    { value: 'nfs', label: t('vps.storage.type.nfs') },
                    { value: 'bind', label: t('vps.storage.type.bind') },
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">{t('vps.storage.create.field.mode')}</div>
              <div className="mt-1">
                <Select
                  testId="vps.storage.mounts.create.mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  options={[
                    { value: 'rw', label: t('vps.storage.mode.rw') },
                    { value: 'ro', label: t('vps.storage.mode.ro') },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.storage.create.field.on_start_fail')}</div>
            <div className="mt-1">
              <Select
                testId="vps.storage.mounts.create.on_start_fail"
                value={onStartFail}
                onChange={(e) => setOnStartFail(e.target.value as any)}
                options={onStartFailOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
            <div className="mt-1 text-xs text-muted">{onStartFailOptions.find((o) => o.value === onStartFail)?.desc}</div>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="vps.storage.mounts.create.enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
              />
              <span>{t('vps.storage.create.field.enabled')}</span>
            </label>

            {canAdmin ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  data-testid="vps.storage.mounts.create.master_enabled"
                  type="checkbox"
                  checked={masterEnabled}
                  onChange={(e) => setMasterEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
                />
                <span>{t('vps.storage.create.field.master_enabled')}</span>
              </label>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="vps.storage.mounts.create.use_default_map"
                type="checkbox"
                checked={useDefaultMap}
                onChange={(e) => setUseDefaultMap(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
              />
              <span>{t('vps.storage.create.field.use_default_map')}</span>
            </label>
          </div>

          <div className="text-xs text-muted">{t('vps.storage.create.basic_hint')}</div>
          <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
            {foundDataset
              ? t('vps.storage.create.scope', { dataset: datasetLabel(foundDataset), vps: objectLabel })
              : t('vps.storage.create.scope_pending', { vps: objectLabel })}
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        testId="vps.storage.mounts.edit"
        title={t('vps.storage.edit.title')}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.storage.mounts.edit.cancel"
              onClick={() => setEditOpen(false)}
              disabled={updateMountM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <ActionButton
              testId="vps.storage.mounts.edit.submit"
              disabled={!editDirty || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={updateMountM.isPending}
              onClick={() => void submitEdit()}
            >
              {t('common.save')}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          {editError ? (
            <Alert title={t('vps.storage.edit.error.title')} variant="danger">
              {editError}
            </Alert>
          ) : null}

          {editMount ? (
            <div className="rounded-md border border-border bg-surface-2 p-2 text-sm">
              <div className="font-medium">{datasetLabel((editMount as any).dataset)}</div>
              <div className="mt-0.5 text-xs text-muted">{t('vps.storage.edit.dataset_locked')}</div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.storage.edit.field.mountpoint')}</div>
            <div className="mt-1">
              <Input
                testId="vps.storage.mounts.edit.mountpoint"
                value={mountpoint}
                onChange={(e) => setMountpoint(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-muted">{t('vps.storage.edit.field.type')}</div>
              <div className="mt-1">
                <Select
                  testId="vps.storage.mounts.edit.type"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  options={[
                    { value: 'nfs', label: t('vps.storage.type.nfs') },
                    { value: 'bind', label: t('vps.storage.type.bind') },
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">{t('vps.storage.edit.field.mode')}</div>
              <div className="mt-1">
                <Select
                  testId="vps.storage.mounts.edit.mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  options={[
                    { value: 'rw', label: t('vps.storage.mode.rw') },
                    { value: 'ro', label: t('vps.storage.mode.ro') },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('vps.storage.edit.field.on_start_fail')}</div>
            <div className="mt-1">
              <Select
                testId="vps.storage.mounts.edit.on_start_fail"
                value={onStartFail}
                onChange={(e) => setOnStartFail(e.target.value as any)}
                options={onStartFailOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
            <div className="mt-1 text-xs text-muted">{onStartFailOptions.find((o) => o.value === onStartFail)?.desc}</div>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="vps.storage.mounts.edit.enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
              />
              <span>{t('vps.storage.edit.field.enabled')}</span>
            </label>

            {canAdmin ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  data-testid="vps.storage.mounts.edit.master_enabled"
                  type="checkbox"
                  checked={masterEnabled}
                  onChange={(e) => setMasterEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
                />
                <span>{t('vps.storage.edit.field.master_enabled')}</span>
              </label>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                data-testid="vps.storage.mounts.edit.use_default_map"
                type="checkbox"
                checked={useDefaultMap}
                onChange={(e) => setUseDefaultMap(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
              />
              <span>{t('vps.storage.edit.field.use_default_map')}</span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        testId="vps.storage.mounts.delete_confirm"
        open={deleteOpen}
        title={t('vps.storage.delete.title')}
        description={t('vps.storage.delete.description')}
        danger
        confirmLabel={t('common.delete')}
        confirmLoading={deleteMountM.isPending}
        confirmDisabled={!gate.allowed}
        confirmationText={deleteTarget ? String((deleteTarget as any).mountpoint ?? deleteTarget.id) : undefined}
        confirmationValue={deleteConfirmation}
        onConfirmationValueChange={setDeleteConfirmation}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteConfirmation('');
        }}
        onConfirm={() => void submitDelete()}
      >
        {deleteError ? (
          <Alert title={t('vps.storage.delete.error.title')} variant="danger">
            {deleteError}
          </Alert>
        ) : deleteTarget ? (
          <div className="text-sm">
            <div className="font-medium">{String((deleteTarget as any).mountpoint ?? '—')}</div>
            <div className="mt-0.5 text-xs text-muted">{datasetLabel((deleteTarget as any).dataset)}</div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { IpAddressLookupInput } from '../../../components/ui/IpAddressLookupInput';
import { LoadingState } from '../../../components/ui/LoadingState';
import { TableCard } from '../../../components/ui/TableCard';
import { clsx } from '../../../components/ui/clsx';
import { formatDateTime } from '../../../lib/format';
import {
  createExportHost,
  deleteExport,
  deleteExportHost,
  fetchExport,
  fetchExportHosts,
  updateExport,
  updateExportHost,
  type ExportHost,
  type ExportItem,
} from '../../../lib/api/exports';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { objectRef } from '../../../lib/objectRef';

function parsePositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function exportAddress(ex: ExportItem | null | undefined): string {
  const host: any = ex?.host_ip_address;
  return String(host?.addr ?? (host?.id ? `#${host.id}` : '—'));
}

function sourceLabel(ex: ExportItem | null | undefined): string {
  const ds: any = ex?.dataset;
  const dataset = String(ds?.full_name ?? ds?.name ?? (ds?.id ? `#${ds.id}` : '#?'));
  const snap: any = ex?.snapshot;
  if (snap?.id) return `${dataset} · ${String(snap.label ?? snap.name ?? `#${snap.id}`)}`;
  return dataset;
}

function sourceShortName(ex: ExportItem | null | undefined): string {
  const snap: any = ex?.snapshot;
  if (snap?.id) return String(snap.label ?? snap.name ?? `snapshot-${snap.id}`);
  const ds: any = ex?.dataset;
  return String(ds?.name ?? ds?.full_name ?? ds?.label ?? (ds?.id ? `dataset-${ds.id}` : 'export'));
}

function hostLabel(host: ExportHost): string {
  const ip: any = host.ip_address;
  return String(ip?.addr ?? (ip?.id ? `#${ip.id}` : '#?'));
}

function sanitizeMountName(input: string, fallbackId: number): string {
  const base = String(input || '').trim().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return cleaned || `export-${fallbackId}`;
}

function snippetMountCommand(address: string, path: string, mountPoint: string) {
  return `sudo mkdir -p ${mountPoint}\nsudo mount -t nfs ${address}:${path} ${mountPoint}`;
}

function snippetFstab(address: string, path: string, mountPoint: string, rw: boolean) {
  const mode = rw ? 'rw' : 'ro';
  return `${address}:${path} ${mountPoint} nfs ${mode},defaults 0 0`;
}

function snippetSystemd(address: string, path: string, mountPoint: string, rw: boolean) {
  const escaped = mountPoint.replace(/^\//, '').replace(/\//g, '-');
  const opts = rw ? 'rw,defaults' : 'ro,defaults';
  return `[Unit]\nDescription=Mount ${address}:${path}\nAfter=network-online.target\nWants=network-online.target\n\n[Mount]\nWhat=${address}:${path}\nWhere=${mountPoint}\nType=nfs\nOptions=${opts}\n\n[Install]\nWantedBy=multi-user.target\n# file: /etc/systemd/system/${escaped}.mount`;
}

function snippetNix(address: string, path: string, mountPoint: string, rw: boolean) {
  const opts = rw ? '[ "rw" "defaults" ]' : '[ "ro" "defaults" ]';
  return `fileSystems."${mountPoint}" = {\n  device = "${address}:${path}";\n  fsType = "nfs";\n  options = ${opts};\n};`;
}

function boolBadgeLabel(value: boolean, t: (k: string, vars?: Record<string, string>) => string) {
  return value ? t('common.enabled') : t('common.disabled');
}

export function ExportDetailPage() {
  const { exportId } = useParams();
  const id = useMemo(() => parsePositiveInt(exportId), [exportId]);
  const { basePath, mode } = useAppMode();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const exportQ = useQuery({
    queryKey: ['exports', 'show', id],
    enabled: id !== null,
    queryFn: async () => (await fetchExport(id as number, { includes: 'dataset,snapshot,host_ip_address,user' })).data,
    staleTime: 10_000,
  });

  const hostsQ = useQuery({
    queryKey: ['exports', 'hosts', id],
    enabled: id !== null,
    queryFn: async () => (await fetchExportHosts(id as number, { limit: 200, includes: 'ip_address' })).data,
    staleTime: 10_000,
  });

  const ex = exportQ.data ?? null;
  const hosts = hostsQ.data ?? [];
  const datasetId = parsePositiveInt((ex as LegacyAny)?.dataset?.id);
  const userId = parsePositiveInt((ex as LegacyAny)?.user?.id);
  const datasetRef = datasetId ? objectRef('Dataset', datasetId) : null;
  const snapshotId = parsePositiveInt((ex as LegacyAny)?.snapshot?.id);
  const address = exportAddress(ex);
  const path = String((ex as LegacyAny)?.path ?? '');
  const mountPoint = useMemo(() => `/mnt/${sanitizeMountName(sourceShortName(ex), id ?? 0)}`, [ex, id]);
  const sourceIsSnapshot = snapshotId !== null;
  const allVps = Boolean((ex as LegacyAny)?.all_vps);
  const rw = Boolean((ex as LegacyAny)?.rw);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hostEditorOpen, setHostEditorOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<ExportHost | null>(null);

  const [editForm, setEditForm] = useState({
    all_vps: true,
    rw: true,
    sync: true,
    subtree_check: false,
    root_squash: false,
    threads: '8',
    enabled: true,
  });

  useEffect(() => {
    if (!ex) return;
    setEditForm({
      all_vps: Boolean((ex as LegacyAny).all_vps),
      rw: Boolean((ex as LegacyAny).rw),
      sync: Boolean((ex as LegacyAny).sync),
      subtree_check: Boolean((ex as LegacyAny).subtree_check),
      root_squash: Boolean((ex as LegacyAny).root_squash),
      threads: String((ex as LegacyAny).threads ?? 8),
      enabled: Boolean((ex as LegacyAny).enabled ?? true),
    });
  }, [ex]);

  const [hostForm, setHostForm] = useState({
    ip_address: null as number | null,
    rw: true,
    sync: true,
    subtree_check: false,
    root_squash: false,
  });

  const openCreateHost = () => {
    setEditingHost(null);
    setHostForm({
      ip_address: null,
      rw: rw,
      sync: Boolean((ex as LegacyAny)?.sync),
      subtree_check: Boolean((ex as LegacyAny)?.subtree_check),
      root_squash: Boolean((ex as LegacyAny)?.root_squash),
    });
    setHostEditorOpen(true);
  };

  const openEditHost = (host: ExportHost) => {
    setEditingHost(host);
    setHostForm({
      ip_address: parsePositiveInt((host as LegacyAny)?.ip_address?.id),
      rw: Boolean((host as LegacyAny)?.rw),
      sync: Boolean((host as LegacyAny)?.sync),
      subtree_check: Boolean((host as LegacyAny)?.subtree_check),
      root_squash: Boolean((host as LegacyAny)?.root_squash),
    });
    setHostEditorOpen(true);
  };

  async function invalidateAll() {
    await qc.invalidateQueries({ queryKey: ['exports'] });
    if (datasetId) await qc.invalidateQueries({ queryKey: ['datasets'] });
  }

  function onMutateLock() {
    if (datasetRef) chrome.acquireLocalLock(datasetRef);
  }

  function onSettledLock() {
    if (datasetRef) chrome.releaseLocalLock(datasetRef);
  }

  function trackFromMeta(meta: any, actionLabel: string) {
    const actionStateId = getMetaActionStateId(meta);
    if (actionStateId && datasetRef) {
      chrome.trackActionState(actionStateId, {
        actionLabel,
        object: datasetRef,
        objectLabel: sourceLabel(ex),
      });
    }
  }

  const updateExportM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid export id');
      const threadsN = parsePositiveInt(editForm.threads);
      return await updateExport(id, {
        all_vps: editForm.all_vps,
        rw: editForm.rw,
        sync: editForm.sync,
        subtree_check: editForm.subtree_check,
        root_squash: editForm.root_squash,
        threads: mode === 'admin' ? threadsN ?? undefined : undefined,
        enabled: editForm.enabled,
      });
    },
    onMutate: onMutateLock,
    onSuccess: async (res) => {
      trackFromMeta((res as LegacyAny).meta, t('exports.action.update'));
      await invalidateAll();
      setEditOpen(false);
      pushToast({ variant: 'ok', title: t('exports.update.success') });
    },
    onError: (err: any) => {
      pushToast({ variant: 'danger', title: t('exports.update.error'), body: String(err?.message ?? err ?? '') });
    },
    onSettled: onSettledLock,
  });

  const deleteExportM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid export id');
      return await deleteExport(id);
    },
    onMutate: onMutateLock,
    onSuccess: async (res) => {
      trackFromMeta((res as LegacyAny).meta, t('exports.action.delete'));
      await invalidateAll();
      pushToast({ variant: 'ok', title: t('exports.delete.success') });
      navigate(`${basePath}/exports`);
    },
    onError: (err: any) => {
      pushToast({ variant: 'danger', title: t('exports.delete.error'), body: String(err?.message ?? err ?? '') });
    },
    onSettled: onSettledLock,
  });

  const saveHostM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid export id');
      if (editingHost) {
        const hostId = parsePositiveInt((editingHost as LegacyAny)?.id);
        if (!hostId) throw new Error('invalid host id');
        return await updateExportHost(id, hostId, {
          rw: hostForm.rw,
          sync: hostForm.sync,
          subtree_check: hostForm.subtree_check,
          root_squash: hostForm.root_squash,
        });
      }
      if (!hostForm.ip_address) throw new Error('ip missing');
      return await createExportHost(id, {
        ip_address: hostForm.ip_address,
        rw: hostForm.rw,
        sync: hostForm.sync,
        subtree_check: hostForm.subtree_check,
        root_squash: hostForm.root_squash,
      });
    },
    onMutate: onMutateLock,
    onSuccess: async (res) => {
      trackFromMeta((res as LegacyAny).meta, editingHost ? t('exports.host.update.success') : t('exports.host.create.success'));
      await invalidateAll();
      setHostEditorOpen(false);
      setEditingHost(null);
      pushToast({ variant: 'ok', title: editingHost ? t('exports.host.update.success') : t('exports.host.create.success') });
    },
    onError: (err: any) => {
      pushToast({ variant: 'danger', title: editingHost ? t('exports.host.update.error') : t('exports.host.create.error'), body: String(err?.message ?? err ?? '') });
    },
    onSettled: onSettledLock,
  });

  const [deleteHost, setDeleteHost] = useState<ExportHost | null>(null);
  const deleteHostM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid export id');
      const hostId = parsePositiveInt((deleteHost as LegacyAny)?.id);
      if (!hostId) throw new Error('invalid host id');
      return await deleteExportHost(id, hostId);
    },
    onMutate: onMutateLock,
    onSuccess: async (res) => {
      trackFromMeta((res as LegacyAny).meta, t('exports.host.delete.success'));
      await invalidateAll();
      setDeleteHost(null);
      pushToast({ variant: 'ok', title: t('exports.host.delete.success') });
    },
    onError: (err: any) => {
      pushToast({ variant: 'danger', title: t('exports.host.delete.error'), body: String(err?.message ?? err ?? '') });
    },
    onSettled: onSettledLock,
  });

  if (id === null) {
    return (
      <DetailShell testId="exports.detail.invalid">
        <ErrorState
          testId="exports.detail.invalid_state"
          title={t('exports.detail.invalid.title')}
          body={t('exports.detail.invalid.body')}
          onRetry={() => navigate(`${basePath}/exports`)}
          detailsExtra={{ page: 'exports.detail', exportId }}
        />
      </DetailShell>
    );
  }

  if (exportQ.isLoading) return <LoadingState testId="exports.detail.loading" />;
  if (exportQ.isError || !ex) {
    return (
      <DetailShell testId="exports.detail.error">
        <ErrorState
          testId="exports.detail.error_state"
          title={t('exports.detail.load_error')}
          error={exportQ.error ?? new Error('not found')}
          onRetry={() => void exportQ.refetch()}
          detailsExtra={{ page: 'exports.detail', exportId: id }}
        />
      </DetailShell>
    );
  }

  const badgeVariant = ex.enabled === false ? 'warn' as const : 'ok' as const;
  const mountCommand = snippetMountCommand(address, path, mountPoint);
  const fstabLine = snippetFstab(address, path, mountPoint, rw);
  const systemdUnit = snippetSystemd(address, path, mountPoint, rw);
  const nixSnippet = snippetNix(address, path, mountPoint, rw);
  const hasHosts = hosts.length > 0;

  return (
    <DetailShell
      testId="exports.detail.page"
      header={
        <PageHeader
          testId="exports.detail.header"
          title={t('exports.detail.title', { id: String(id) })}
          description={sourceLabel(ex)}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariant} testId="exports.detail.badge.enabled">{boolBadgeLabel(Boolean(ex.enabled), t as LegacyAny)}</Badge>
              <Badge variant={sourceIsSnapshot ? 'info' : 'neutral'}>{sourceIsSnapshot ? t('common.snapshot') : t('common.dataset')}</Badge>
              <span>#{id}</span>
            </span>
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditOpen(true)} testId="exports.detail.edit.open">{t('common.edit')}</Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)} testId="exports.detail.delete.open">{t('common.delete')}</Button>
            </>
          }
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card testId="exports.detail.summary">
            <CardHeader title={t('exports.detail.summary.title')} subtitle={t('exports.detail.summary.subtitle')} />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-muted">{t('exports.field.source')}</div>
                  <div className="mt-1 text-sm text-fg">{sourceLabel(ex)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t('exports.field.address')}</div>
                  <div className="mt-1 font-mono text-xs text-fg">{address}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t('exports.field.path')}</div>
                  <div className="mt-1 font-mono text-xs text-fg">{path || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t('common.user')}</div>
                  <div className="mt-1 text-sm text-fg">
                    {mode === 'admin' && userId ? <Link className="text-accent hover:underline" to={`${basePath}/users/${userId}`}>#{userId}</Link> : userId ? `#${userId}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t('exports.field.mode')}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={rw ? 'ok' : 'neutral'}>{rw ? t('exports.mode.rw') : t('exports.mode.ro')}</Badge>
                    <Badge variant={Boolean((ex as LegacyAny).sync) ? 'ok' : 'warn'}>{t('exports.field.sync')}</Badge>
                    <Badge variant={Boolean((ex as LegacyAny).subtree_check) ? 'info' : 'neutral'}>{t('exports.field.subtree_check')}</Badge>
                    <Badge variant={Boolean((ex as LegacyAny).root_squash) ? 'info' : 'neutral'}>{t('exports.field.root_squash')}</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t('exports.field.scope')}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant={allVps ? 'info' : 'neutral'}>{allVps ? t('exports.field.all_vps') : t('exports.field.selected_hosts')}</Badge>
                    {mode === 'admin' ? <Badge variant="neutral">{t('exports.field.threads_label', { count: String((ex as LegacyAny).threads ?? 0) })}</Badge> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-faint">
                <span>{t('common.updated')}: {ex.updated_at ? formatDateTime(ex.updated_at) : '—'}</span>
                <span>{t('common.created')}: {ex.created_at ? formatDateTime(ex.created_at) : '—'}</span>
                {datasetId ? <Link className="text-accent hover:underline" to={`${basePath}/datasets/${datasetId}`}>{t('exports.detail.open_dataset')}</Link> : null}
              </div>
            </CardBody>
          </Card>

          <Card testId="exports.detail.instructions">
            <CardHeader
              title={t('exports.detail.instructions.title')}
              subtitle={sourceIsSnapshot ? t('exports.detail.instructions.snapshot_subtitle') : t('exports.detail.instructions.dataset_subtitle')}
              actions={<CopyButton text={mountCommand} label={t('exports.instructions.copy_command')} testId="exports.detail.instructions.command.copy" />}
            />
            <CardBody className="space-y-4">
              {sourceIsSnapshot ? (
                <Alert title={t('exports.detail.instructions.temporary.title')} variant="info">
                  {t('exports.detail.instructions.temporary.body')}
                </Alert>
              ) : null}

              <div>
                <div className="mb-2 text-xs font-semibold text-muted">{t('exports.instructions.command')}</div>
                <pre data-testid="exports.detail.instructions.command" className="overflow-x-auto rounded-md border border-border bg-code p-3 text-xs text-fg">{mountCommand}</pre>
              </div>

              {!sourceIsSnapshot ? (
                <div className="grid gap-4 xl:grid-cols-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                      <span>{t('exports.instructions.fstab')}</span>
                      <CopyButton text={fstabLine} label={t('common.copy')} testId="exports.detail.instructions.fstab.copy" />
                    </div>
                    <pre className="overflow-x-auto rounded-md border border-border bg-code p-3 text-xs text-fg">{fstabLine}</pre>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                      <span>{t('exports.instructions.systemd')}</span>
                      <CopyButton text={systemdUnit} label={t('common.copy')} testId="exports.detail.instructions.systemd.copy" />
                    </div>
                    <pre className="max-h-scroll-lg overflow-auto rounded-md border border-border bg-code p-3 text-xs text-fg">{systemdUnit}</pre>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
                      <span>{t('exports.instructions.nixos')}</span>
                      <CopyButton text={nixSnippet} label={t('common.copy')} testId="exports.detail.instructions.nixos.copy" />
                    </div>
                    <pre className="max-h-scroll-lg overflow-auto rounded-md border border-border bg-code p-3 text-xs text-fg">{nixSnippet}</pre>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card testId="exports.detail.hosts">
            <CardHeader
              title={t('exports.detail.hosts.title')}
              subtitle={allVps ? t('exports.detail.hosts.all_vps_subtitle') : t('exports.detail.hosts.subtitle')}
              actions={
                <Button size="sm" variant="primary" onClick={openCreateHost} disabled={allVps} testId="exports.detail.hosts.add">
                  {t('exports.host.add')}
                </Button>
              }
            />
            <CardBody>
              {allVps ? (
                <Alert title={t('exports.detail.hosts.all_vps_title')} variant="info">
                  {t('exports.detail.hosts.all_vps_body')}
                </Alert>
              ) : null}

              {hostsQ.isLoading ? <LoadingState testId="exports.detail.hosts.loading" /> : null}
              {hostsQ.isError ? <ErrorState testId="exports.detail.hosts.error" title={t('exports.host.load_error')} error={hostsQ.error} onRetry={() => void hostsQ.refetch()} /> : null}
              {!hostsQ.isLoading && !hostsQ.isError && !hasHosts ? (
                <div className="text-sm text-muted" data-testid="exports.detail.hosts.empty">{t('exports.detail.hosts.empty')}</div>
              ) : null}
              {!hostsQ.isLoading && !hostsQ.isError && hasHosts ? (
                <TableCard testId="exports.detail.hosts.table" variant="plain" minWidth="full">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.detail.hosts.address')}</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('exports.field.mode')}</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('common.state')}</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hosts.map((host) => {
                      const hostId = parsePositiveInt((host as LegacyAny).id) ?? 0;
                      return (
                        <tr key={hostId} data-testid={`exports.detail.hosts.row.${hostId}`} className={clsx('border-t border-border/80')}>
                          <td className="px-2 py-2 font-mono text-xs text-fg">{hostLabel(host)}</td>
                          <td className="px-2 py-2 text-sm text-fg">{Boolean((host as LegacyAny).rw) ? t('exports.mode.rw') : t('exports.mode.ro')}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={Boolean((host as LegacyAny).sync) ? 'ok' : 'warn'}>{t('exports.field.sync')}</Badge>
                              <Badge variant={Boolean((host as LegacyAny).subtree_check) ? 'info' : 'neutral'}>{t('exports.field.subtree_check')}</Badge>
                              <Badge variant={Boolean((host as LegacyAny).root_squash) ? 'info' : 'neutral'}>{t('exports.field.root_squash')}</Badge>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex justify-end gap-2" data-row-no-nav>
                              <Button size="sm" variant="secondary" onClick={() => openEditHost(host)} testId={`exports.detail.hosts.row.${hostId}.edit`}>{t('common.edit')}</Button>
                              <Button size="sm" variant="danger" onClick={() => setDeleteHost(host)} testId={`exports.detail.hosts.row.${hostId}.delete`}>{t('common.delete')}</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableCard>
              ) : null}
            </CardBody>
          </Card>

          {!allVps && !hasHosts ? (
            <Alert title={t('exports.detail.hosts.warning_title')} variant="warn">
              {t('exports.detail.hosts.warning_body')}
            </Alert>
          ) : null}
        </div>
      </div>

      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title={t('exports.update.title')} width="lg" testId="exports.detail.edit.drawer">
        <div className="space-y-4">
          <Checkbox checked={editForm.enabled} onChange={(checked) => setEditForm((prev) => ({ ...prev, enabled: checked }))} testId="exports.edit.enabled">{t('common.enabled')}</Checkbox>
          <Checkbox checked={editForm.all_vps} onChange={(checked) => setEditForm((prev) => ({ ...prev, all_vps: checked }))} testId="exports.edit.all_vps">{t('exports.field.all_vps')}</Checkbox>
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox checked={editForm.rw} onChange={(checked) => setEditForm((prev) => ({ ...prev, rw: checked }))} testId="exports.edit.rw">{t('exports.field.rw')}</Checkbox>
            <Checkbox checked={editForm.sync} onChange={(checked) => setEditForm((prev) => ({ ...prev, sync: checked }))} testId="exports.edit.sync">{t('exports.field.sync')}</Checkbox>
            <Checkbox checked={editForm.subtree_check} onChange={(checked) => setEditForm((prev) => ({ ...prev, subtree_check: checked }))} testId="exports.edit.subtree_check">{t('exports.field.subtree_check')}</Checkbox>
            <Checkbox checked={editForm.root_squash} onChange={(checked) => setEditForm((prev) => ({ ...prev, root_squash: checked }))} testId="exports.edit.root_squash">{t('exports.field.root_squash')}</Checkbox>
          </div>
          {mode === 'admin' ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.threads')}</div>
              <Input value={editForm.threads} onChange={(e) => setEditForm((prev) => ({ ...prev, threads: e.target.value }))} testId="exports.edit.threads" ariaLabel={t('exports.field.threads')} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={updateExportM.isPending} onClick={() => void updateExportM.mutateAsync()} testId="exports.edit.submit">{t('common.save')}</Button>
          </div>
        </div>
      </Drawer>

      <Drawer open={hostEditorOpen} onClose={() => { setHostEditorOpen(false); setEditingHost(null); }} title={editingHost ? t('exports.host.edit_title') : t('exports.host.add_title')} width="lg" testId="exports.detail.host.editor">
        <div className="space-y-4">
          {!editingHost ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('exports.detail.hosts.address')}</div>
              <IpAddressLookupInput value={hostForm.ip_address} onChange={(v) => setHostForm((prev) => ({ ...prev, ip_address: v }))} userId={userId ?? undefined} placeholder={t('exports.host.address.placeholder')} ariaLabel={t('exports.detail.hosts.address')} testId="exports.host.ip_address" disabled={allVps} />
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold text-muted">{t('exports.detail.hosts.address')}</div>
              <div className="mt-1 font-mono text-xs text-fg">{hostLabel(editingHost)}</div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox checked={hostForm.rw} onChange={(checked) => setHostForm((prev) => ({ ...prev, rw: checked }))} testId="exports.host.rw">{t('exports.field.rw')}</Checkbox>
            <Checkbox checked={hostForm.sync} onChange={(checked) => setHostForm((prev) => ({ ...prev, sync: checked }))} testId="exports.host.sync">{t('exports.field.sync')}</Checkbox>
            <Checkbox checked={hostForm.subtree_check} onChange={(checked) => setHostForm((prev) => ({ ...prev, subtree_check: checked }))} testId="exports.host.subtree_check">{t('exports.field.subtree_check')}</Checkbox>
            <Checkbox checked={hostForm.root_squash} onChange={(checked) => setHostForm((prev) => ({ ...prev, root_squash: checked }))} testId="exports.host.root_squash">{t('exports.field.root_squash')}</Checkbox>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setHostEditorOpen(false); setEditingHost(null); }}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={saveHostM.isPending} onClick={() => void saveHostM.mutateAsync()} disabled={!editingHost && !hostForm.ip_address} testId="exports.host.submit">{editingHost ? t('common.save') : t('exports.host.add')}</Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void deleteExportM.mutateAsync()}
        danger
        title={t('exports.delete.title')}
        description={t('exports.delete.body', { source: sourceLabel(ex) })}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteExportM.isPending}
        testId="exports.detail.delete.dialog"
      />

      <ConfirmDialog
        open={deleteHost !== null}
        onCancel={() => setDeleteHost(null)}
        onConfirm={() => void deleteHostM.mutateAsync()}
        danger
        title={t('exports.host.delete.title')}
        description={t('exports.host.delete.body', { host: deleteHost ? hostLabel(deleteHost) : '—' })}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteHostM.isPending}
        testId="exports.detail.host.delete.dialog"
      />
    </DetailShell>
  );
}

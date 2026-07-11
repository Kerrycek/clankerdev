import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { formatDateTime } from '../../../../lib/time';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { ObjectHeader } from '../../../../components/ui/ObjectHeader';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { StatCard } from '../../../../components/ui/StatCard';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { TableCard } from '../../../../components/ui/TableCard';
import { Textarea } from '../../../../components/ui/Textarea';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';

import { getMetaTotalCount } from '../../../../lib/api/haveapi';
import { fetchClusterResources, type ClusterResource } from '../../../../lib/api/clusterResources';
import { fetchEnvironments, type Environment } from '../../../../lib/api/infra';
import { parsePositiveInt } from '../../../../lib/parse';
import {
  createClusterResourcePackageItem,
  createUserClusterResourcePackage,
  deleteClusterResourcePackage,
  deleteClusterResourcePackageItem,
  deleteUserClusterResourcePackage,
  fetchClusterResourcePackage,
  fetchClusterResourcePackageItems,
  fetchUserClusterResourcePackages,
  updateClusterResourcePackage,
  updateClusterResourcePackageItem,
  updateUserClusterResourcePackage,
  type ClusterResourcePackage,
  type ClusterResourcePackageItem,
  type UserClusterResourcePackage,
} from '../../../../lib/api/clusterResourcePackages';

function envLabel(env: Environment | null | undefined): string {
  const e: any = env ?? {};
  const label = typeof e.label === 'string' ? e.label.trim() : '';
  return label || (typeof e.id === 'number' ? `#${e.id}` : '—');
}

function userLabel(u: any): string {
  if (!u) return '—';
  const login = typeof u.login === 'string' ? u.login.trim() : '';
  if (login) return login;
  return typeof u.id === 'number' ? `#${u.id}` : '—';
}

function crLabel(cr: ClusterResource | null | undefined): string {
  const x: any = cr ?? {};
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  const name = typeof x.name === 'string' ? x.name.trim() : '';
  if (label && name) return `${label} (${name})`;
  return label || name || (typeof x.id === 'number' ? `#${x.id}` : '—');
}

type ItemEditorState =
  | null
  | {
      mode: 'create' | 'edit';
      item?: ClusterResourcePackageItem;
    };

type AssignmentEditorState =
  | null
  | {
      mode: 'create' | 'edit';
      record?: UserClusterResourcePackage;
    };

export function ResourcePackageDetailPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const id = useMemo(() => parsePositiveInt(params['packageId']), [params]);

  const pkgQ = useQuery({
    queryKey: ['cluster_resource_package', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id');
      return (await fetchClusterResourcePackage(id)).data;
    },
    enabled: Boolean(id),
    staleTime: 5_000,
  });

  const itemsQ = useQuery({
    queryKey: ['cluster_resource_package_items', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id');
      return (await fetchClusterResourcePackageItems(id, { limit: 500 })).data;
    },
    enabled: Boolean(id),
    staleTime: 5_000,
  });

  const envQ = useQuery({
    queryKey: ['environments', { limit: 500 }],
    queryFn: async () => (await fetchEnvironments({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const crQ = useQuery({
    queryKey: ['cluster_resources', { limit: 500 }],
    queryFn: async () => (await fetchClusterResources({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const assignmentsPagination = useKeysetPagination({
    id: 'admin.cluster.resource_packages.assignments',
    filterKey: String(id ?? '0'),
    searchParams,
    setSearchParams,
    paramPrefix: 'a_',
    allowedLimits: [25, 50, 100, 200],
    defaultLimit: 50,
  });

  const assignmentsQ = useQuery({
    queryKey: [
      'user_cluster_resource_packages',
      { pkgId: id, limit: assignmentsPagination.limit, fromId: assignmentsPagination.fromId },
    ],
    queryFn: async () => {
      if (!id) throw new Error('Missing id');
      return await fetchUserClusterResourcePackages({
        clusterResourcePackageId: id,
        limit: assignmentsPagination.limit,
        fromId: assignmentsPagination.fromId ?? undefined,
      });
    },
    enabled: Boolean(id),
    staleTime: 5_000,
  });

  const pkg = pkgQ.data as ClusterResourcePackage | undefined;
  const items = itemsQ.data ?? [];
  const envs = envQ.data ?? [];
  const clusterResources = crQ.data ?? [];

  const assignmentsRes = assignmentsQ.data;
  const assignments = assignmentsRes?.data ?? [];
  const assignmentTotal = getMetaTotalCount(assignmentsRes?.meta);

  const lastAssignment = assignments[assignments.length - 1];
  const assignmentCursor = lastAssignment ? lastAssignment.id : null;
  const assignmentHasMore = assignments.length === assignmentsPagination.limit && typeof assignmentCursor === 'number';
  const assignmentCanNext = assignmentsPagination.hasForward || assignmentHasMore;

  const label = typeof pkg?.label === 'string' && pkg.label.trim() ? pkg.label.trim() : id ? `#${id}` : '—';
  const personal = Boolean((pkg as any)?.is_personal) || Boolean((pkg as any)?.user);

  const env = (pkg as any)?.environment as Environment | null | undefined;
  const user = (pkg as any)?.user as any;

  const badge = personal
    ? { variant: 'warn' as const, label: t('admin.cluster.resource_packages.scope.personal') }
    : { variant: 'neutral' as const, label: t('admin.cluster.resource_packages.scope.global') };

  const envOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: t('common.select') }, ...envs.map((e) => ({ value: String(e.id), label: envLabel(e) }))],
    [envs, t]
  );

  const crOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: t('common.select') }, ...clusterResources.map((cr) => ({ value: String(cr.id), label: crLabel(cr) }))],
    [clusterResources, t]
  );

  // -----------------
  // Package label edit
  // -----------------
  const [pkgEditorOpen, setPkgEditorOpen] = useState(false);
  const [pkgLabel, setPkgLabel] = useState('');

  const openPkgEditor = () => {
    setPkgLabel(typeof pkg?.label === 'string' ? pkg.label : '');
    setPkgEditorOpen(true);
  };

  const updatePkgM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      return await updateClusterResourcePackage({ id, label: pkgLabel.trim() });
    },
    onSuccess: async () => {
      setPkgEditorOpen(false);
      await qc.invalidateQueries({ queryKey: ['cluster_resource_package', id] });
      await qc.invalidateQueries({ queryKey: ['cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.toast.updated') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);

  const deletePkgM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      return await deleteClusterResourcePackage(id);
    },
    onSuccess: async () => {
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.toast.deleted') });
      await qc.invalidateQueries({ queryKey: ['cluster_resource_packages'] });
      // NOTE: navigation is handled by the user via the back link; we keep this non-magical.
      setDeleteOpen(false);
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  // ------
  // Items
  // ------

  const [itemEditor, setItemEditor] = useState<ItemEditorState>(null);
  const [itemCrId, setItemCrId] = useState('');
  const [itemValue, setItemValue] = useState('');

  const openCreateItem = () => {
    setItemCrId('');
    setItemValue('');
    setItemEditor({ mode: 'create' });
  };

  const openEditItem = (it: ClusterResourcePackageItem) => {
    const crId = typeof (it as any).cluster_resource?.id === 'number' ? String((it as any).cluster_resource.id) : '';
    const val = typeof it.value === 'number' ? String(it.value) : '';
    setItemCrId(crId);
    setItemValue(val);
    setItemEditor({ mode: 'edit', item: it });
  };

  const createItemM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      const crId = parsePositiveInt(itemCrId);
      const v = Number(itemValue);
      if (!crId) throw new Error('Missing cluster resource');
      if (!Number.isFinite(v)) throw new Error('Invalid value');
      return await createClusterResourcePackageItem({ pkgId: id, clusterResourceId: crId, value: v });
    },
    onSuccess: async () => {
      setItemEditor(null);
      await qc.invalidateQueries({ queryKey: ['cluster_resource_package_items', id] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.items.toast.created') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const updateItemM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      const itemId = itemEditor?.item?.id;
      if (!itemId) throw new Error('Missing item id');
      const v = Number(itemValue);
      if (!Number.isFinite(v)) throw new Error('Invalid value');
      return await updateClusterResourcePackageItem({ pkgId: id, itemId, value: v });
    },
    onSuccess: async () => {
      setItemEditor(null);
      await qc.invalidateQueries({ queryKey: ['cluster_resource_package_items', id] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.items.toast.updated') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const [deleteItemOpen, setDeleteItemOpen] = useState<{ open: boolean; item?: ClusterResourcePackageItem }>(() => ({
    open: false,
    item: undefined,
  }));

  const deleteItemM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      const itemId = deleteItemOpen.item?.id;
      if (!itemId) throw new Error('Missing item');
      return await deleteClusterResourcePackageItem({ pkgId: id, itemId });
    },
    onSuccess: async () => {
      setDeleteItemOpen({ open: false, item: undefined });
      await qc.invalidateQueries({ queryKey: ['cluster_resource_package_items', id] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.items.toast.deleted') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  // -----------
  // Assignments
  // -----------
  const [assignEditor, setAssignEditor] = useState<AssignmentEditorState>(null);
  const [assignEnvId, setAssignEnvId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignComment, setAssignComment] = useState('');
  const [assignFromPersonal, setAssignFromPersonal] = useState(false);

  const openAssignCreate = () => {
    setAssignEnvId('');
    setAssignUserId('');
    setAssignComment('');
    setAssignFromPersonal(false);
    setAssignEditor({ mode: 'create' });
  };

  const openAssignEdit = (rec: UserClusterResourcePackage) => {
    setAssignEnvId(typeof (rec as any).environment?.id === 'number' ? String((rec as any).environment.id) : '');
    setAssignUserId(typeof (rec as any).user?.id === 'number' ? String((rec as any).user.id) : '');
    setAssignComment(typeof rec.comment === 'string' ? rec.comment : '');
    setAssignFromPersonal(false);
    setAssignEditor({ mode: 'edit', record: rec });
  };

  const createAssignM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      const eId = parsePositiveInt(assignEnvId);
      const uId = parsePositiveInt(assignUserId);
      if (!eId) throw new Error('Missing environment');
      if (!uId) throw new Error('Missing user');

      return await createUserClusterResourcePackage({
        environmentId: eId,
        userId: uId,
        clusterResourcePackageId: id,
        comment: assignComment,
        fromPersonal: assignFromPersonal,
      });
    },
    onSuccess: async () => {
      setAssignEditor(null);
      await qc.invalidateQueries({ queryKey: ['user_cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.assign.toast.created') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const updateAssignM = useMutation({
    mutationFn: async () => {
      const recId = assignEditor?.record?.id;
      if (!recId) throw new Error('Missing record');
      return await updateUserClusterResourcePackage({ id: recId, comment: assignComment });
    },
    onSuccess: async () => {
      setAssignEditor(null);
      await qc.invalidateQueries({ queryKey: ['user_cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.assign.toast.updated') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const [deleteAssignState, setDeleteAssignState] = useState<{ open: boolean; rec?: UserClusterResourcePackage }>(() => ({
    open: false,
    rec: undefined,
  }));

  const deleteAssignM = useMutation({
    mutationFn: async () => {
      const recId = deleteAssignState.rec?.id;
      if (!recId) throw new Error('Missing record');
      return await deleteUserClusterResourcePackage(recId);
    },
    onSuccess: async () => {
      setDeleteAssignState({ open: false, rec: undefined });
      await qc.invalidateQueries({ queryKey: ['user_cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.assign.toast.deleted') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  // -------
  // Render
  // -------
  if (!id) {
    return <ErrorState error={new Error('Missing id')} testId="admin.cluster.resource_package_detail.missing" />;
  }

  if (pkgQ.isLoading) {
    return <LoadingState testId="admin.cluster.resource_package_detail.loading" />;
  }

  if (pkgQ.isError) {
    return <ErrorState error={pkgQ.error} testId="admin.cluster.resource_package_detail.error" />;
  }

  if (!pkg) {
    return <EmptyState title={t('admin.cluster.resource_package_detail.not_found.title')} message={t('admin.cluster.resource_package_detail.not_found.body')} />;
  }

  return (
    <div className="space-y-4">
      <ObjectHeader
        testId="admin.cluster.resource_package_detail.header"
        kicker={
          <span>
            <Link className="hover:underline" to="/admin/cluster/resource-packages">
              {t('admin.cluster.tab.resource_packages')}
            </Link>{' '}
            · <span className="font-mono text-xs">#{id}</span>
          </span>
        }
        title={label}
        badges={<Badge variant={badge.variant}>{badge.label}</Badge>}
        meta={
          personal ? (
            <span>
              {t('common.environment')}: <span className="font-medium text-fg">{envLabel(env)}</span>
              <span className="mx-2 text-faint">·</span>
              {t('common.user')}: <span className="font-medium text-fg">{userLabel(user)}</span>
            </span>
          ) : (
            <span>{t('admin.cluster.resource_package_detail.meta.global')}</span>
          )
        }
        right={
          <div className="flex items-center gap-2">
            <StatCard
              size="sm"
              label={t('admin.cluster.resource_package_detail.stat.items')}
              value={String(items.length)}
            />
            <StatCard
              size="sm"
              label={t('admin.cluster.resource_package_detail.stat.assigned')}
              value={personal ? '—' : String(assignmentTotal)}
            />
          </div>
        }
        actions={
          <>
            <Button variant="secondary" onClick={openPkgEditor} testId="admin.cluster.resource_package_detail.edit">
              {t('common.edit')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(true);
              }}
              disabled={personal}
              disabledReason={personal ? t('admin.cluster.resource_packages.delete_disabled.personal') : undefined}
              testId="admin.cluster.resource_package_detail.delete"
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />

      {!personal ? (
        <Alert variant="warn" testId="admin.cluster.resource_package_detail.alert">
          <div className="font-medium">{t('admin.cluster.resource_package_detail.warning.title')}</div>
          <div className="mt-1 text-sm">
            {t('admin.cluster.resource_package_detail.warning.body', { count: String(assignmentTotal) })}
          </div>
        </Alert>
      ) : (
        <Alert variant="neutral" testId="admin.cluster.resource_package_detail.alert.personal">
          <div className="font-medium">{t('admin.cluster.resource_package_detail.personal.title')}</div>
          <div className="mt-1 text-sm">{t('admin.cluster.resource_package_detail.personal.body')}</div>
        </Alert>
      )}

      <Card testId="admin.cluster.resource_package_detail.items">
        <CardHeader
          title={t('admin.cluster.resource_packages.items.title')}
          right={
            <Button variant="primary" onClick={openCreateItem} testId="admin.cluster.resource_package_detail.items.add">
              {t('admin.cluster.resource_packages.items.add')}
            </Button>
          }
        />
        <CardBody>
          {itemsQ.isError ? (
            <ErrorState error={itemsQ.error} testId="admin.cluster.resource_package_detail.items.error" />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('admin.cluster.resource_packages.items.empty.title')}
              message={t('admin.cluster.resource_packages.items.empty.body')}
              testId="admin.cluster.resource_package_detail.items.empty"
            />
          ) : (
            <TableCard minWidth="md" testId="admin.cluster.resource_package_detail.items.table">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.resource_packages.items.col.resource')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.resource_packages.items.col.value')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const itemId = it.id;
                  const cr = (it as any).cluster_resource as ClusterResource | null | undefined;
                  const v = typeof it.value === 'number' ? it.value : null;

                  return (
                    <tr key={itemId} data-testid={`admin.cluster.resource_package_detail.items.row.${itemId}`}>
                      <td className="px-3 py-2">
                        <div className="text-fg">{crLabel(cr)}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg">{v == null ? '—' : String(v)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditItem(it)}
                            testId={`admin.cluster.resource_package_detail.items.row.${itemId}.edit`}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteItemOpen({ open: true, item: it })}
                            testId={`admin.cluster.resource_package_detail.items.row.${itemId}.delete`}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </CardBody>
      </Card>

      {!personal ? (
        <Card testId="admin.cluster.resource_package_detail.assignments">
          <CardHeader
            title={t('admin.cluster.resource_packages.assign.title')}
            right={
              <Button variant="primary" onClick={openAssignCreate} testId="admin.cluster.resource_package_detail.assign.add">
                {t('admin.cluster.resource_packages.assign.add')}
              </Button>
            }
          />
          <CardBody>
            {assignmentsQ.isError ? (
              <ErrorState error={assignmentsQ.error} testId="admin.cluster.resource_package_detail.assign.error" />
            ) : assignments.length === 0 ? (
              <EmptyState
                title={t('admin.cluster.resource_packages.assign.empty.title')}
                message={t('admin.cluster.resource_packages.assign.empty.body')}
                testId="admin.cluster.resource_package_detail.assign.empty"
              />
            ) : (
              <TableCard
                minWidth="lg"
                testId="admin.cluster.resource_package_detail.assign.table"
                footer={
                  <KeysetPagination
                    testId="admin.cluster.resource_package_detail.assign.pagination"
                    page={assignmentsPagination.page}
                    pageCount={assignmentsPagination.stack.length}
                    canPrev={assignmentsPagination.canPrev}
                    canNext={assignmentCanNext}
                    onPrev={assignmentsPagination.goPrev}
                    onNext={() => assignmentsPagination.goNext(assignmentCursor)}
                    onGoToPage={assignmentsPagination.goToPage}
                    limit={assignmentsPagination.limit}
                    allowedLimits={assignmentsPagination.allowedLimits}
                    onLimitChange={assignmentsPagination.setLimit}
                  />
                }
              >
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.environment')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.user')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.comment')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.resource_packages.assign.col.added_by')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.created_at')}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((rec) => {
                    const recId = rec.id;
                    const e = (rec as any).environment as Environment | null | undefined;
                    const u = (rec as any).user as any;
                    const ab = (rec as any).added_by as any;
                    const comment = typeof rec.comment === 'string' ? rec.comment : '';
                    const createdAt = typeof rec.created_at === 'string' ? rec.created_at : null;

                    return (
                      <tr key={recId} data-testid={`admin.cluster.resource_package_detail.assign.row.${recId}`}>
                        <td className="px-3 py-2 text-muted">{envLabel(e)}</td>
                        <td className="px-3 py-2 text-fg">{userLabel(u)}</td>
                        <td className="px-3 py-2 text-muted">{comment || '—'}</td>
                        <td className="px-3 py-2 text-muted">{userLabel(ab)}</td>
                        <td className="px-3 py-2 text-muted">{formatDateTime(createdAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openAssignEdit(rec)}
                              testId={`admin.cluster.resource_package_detail.assign.row.${recId}.edit`}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteAssignState({ open: true, rec })}
                              testId={`admin.cluster.resource_package_detail.assign.row.${recId}.delete`}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableCard>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* Package editor */}
      <Modal
        open={pkgEditorOpen}
        title={t('admin.cluster.resource_packages.edit.title')}
        onClose={() => (updatePkgM.isPending ? null : setPkgEditorOpen(false))}
        testId="admin.cluster.resource_package_detail.pkg_editor"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setPkgEditorOpen(false)} disabled={updatePkgM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => updatePkgM.mutate()}
              loading={updatePkgM.isPending}
              disabled={!pkgLabel.trim()}
              testId="admin.cluster.resource_package_detail.pkg_editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="text-sm font-medium text-fg">{t('common.label')}</div>
          <Input
            value={pkgLabel}
            onChange={(e) => setPkgLabel(e.target.value)}
            placeholder={t('admin.cluster.resource_packages.form.label_placeholder')}
            autoComplete="off"
            testId="admin.cluster.resource_package_detail.pkg_editor.label"
          />
        </div>
      </Modal>

      {/* Delete package */}
      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => deletePkgM.mutate()}
        danger
        title={t('admin.cluster.resource_packages.delete_confirm.title')}
        description={t('admin.cluster.resource_packages.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deletePkgM.isPending}
        confirmDisabled={!id}
        testId="admin.cluster.resource_package_detail.delete_confirm"
      >
        <div className="space-y-3">
          <div className="text-sm text-muted">
            {t('admin.cluster.resource_packages.delete_confirm.impact', { count: String(assignmentTotal) })}
          </div>
        </div>
      </ConfirmDialog>

      {/* Item editor */}
      <Modal
        open={Boolean(itemEditor)}
        title={itemEditor?.mode === 'edit' ? t('admin.cluster.resource_packages.items.edit.title') : t('admin.cluster.resource_packages.items.create.title')}
        onClose={() => (createItemM.isPending || updateItemM.isPending ? null : setItemEditor(null))}
        testId="admin.cluster.resource_package_detail.item_editor"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setItemEditor(null)} disabled={createItemM.isPending || updateItemM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (itemEditor?.mode === 'edit') updateItemM.mutate();
                else createItemM.mutate();
              }}
              loading={createItemM.isPending || updateItemM.isPending}
              disabled={itemEditor?.mode === 'create' ? !parsePositiveInt(itemCrId) || !itemValue.trim() : !itemValue.trim()}
              testId="admin.cluster.resource_package_detail.item_editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-fg">{t('admin.cluster.resource_packages.items.field.resource')}</div>
            <div className="mt-1">
              <Select
                value={itemCrId}
                onChange={(e) => setItemCrId(e.target.value)}
                options={crOptions}
                disabled={itemEditor?.mode === 'edit'}
                testId="admin.cluster.resource_package_detail.item_editor.resource"
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-fg">{t('admin.cluster.resource_packages.items.field.value')}</div>
            <div className="mt-1">
              <Input
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                placeholder="0"
                autoComplete="off"
                testId="admin.cluster.resource_package_detail.item_editor.value"
              />
            </div>
            <div className="mt-1 text-xs text-muted">{t('admin.cluster.resource_packages.items.field.value_hint')}</div>
          </div>
        </div>
      </Modal>

      {/* Delete item */}
      <ConfirmDialog
        open={deleteItemOpen.open}
        onCancel={() => setDeleteItemOpen({ open: false, item: undefined })}
        onConfirm={() => deleteItemM.mutate()}
        danger
        title={t('admin.cluster.resource_packages.items.delete_confirm.title')}
        description={t('admin.cluster.resource_packages.items.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteItemM.isPending}
        testId="admin.cluster.resource_package_detail.item_delete_confirm"
      >
        <div className="text-sm text-muted">
          {t('admin.cluster.resource_packages.items.delete_confirm.impact', { count: personal ? '1' : String(assignmentTotal) })}
        </div>
      </ConfirmDialog>

      {/* Assignment editor */}
      <Modal
        open={Boolean(assignEditor)}
        title={assignEditor?.mode === 'edit' ? t('admin.cluster.resource_packages.assign.edit.title') : t('admin.cluster.resource_packages.assign.create.title')}
        onClose={() =>
          createAssignM.isPending || updateAssignM.isPending ? null : setAssignEditor(null)
        }
        testId="admin.cluster.resource_package_detail.assign_editor"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setAssignEditor(null)}
              disabled={createAssignM.isPending || updateAssignM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (assignEditor?.mode === 'edit') updateAssignM.mutate();
                else createAssignM.mutate();
              }}
              loading={createAssignM.isPending || updateAssignM.isPending}
              disabled={
                assignEditor?.mode === 'create'
                  ? !parsePositiveInt(assignEnvId) || !parsePositiveInt(assignUserId)
                  : false
              }
              testId="admin.cluster.resource_package_detail.assign_editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-fg">{t('common.environment')}</div>
              <div className="mt-1">
                <Select
                  value={assignEnvId}
                  onChange={(e) => setAssignEnvId(e.target.value)}
                  options={envOptions}
                  disabled={assignEditor?.mode === 'edit'}
                  testId="admin.cluster.resource_package_detail.assign_editor.environment"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-fg">{t('common.user')}</div>
              <div className="mt-1">
                <UserLookupInput
                  value={assignUserId}
                  onChange={(v) => setAssignUserId(v)}
                  placeholder={t('admin.cluster.resource_packages.assign.user_placeholder')}
                  disabled={assignEditor?.mode === 'edit'}
                  testId="admin.cluster.resource_package_detail.assign_editor.user"
                  loadingLabel={t('common.loading')}
                  noResultsLabel={t('common.no_results')}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-fg">{t('common.comment')}</div>
            <div className="mt-1">
              <Textarea
                value={assignComment}
                onChange={(e) => setAssignComment(e.target.value)}
                rows={3}
                placeholder={t('admin.cluster.resource_packages.assign.comment_placeholder')}
                testId="admin.cluster.resource_package_detail.assign_editor.comment"
              />
            </div>
          </div>

          {assignEditor?.mode === 'create' ? (
            <SwitchRow
              checked={assignFromPersonal}
              onChange={(v) => setAssignFromPersonal(Boolean(v))}
              label={t('admin.cluster.resource_packages.assign.from_personal.label')}
              description={t('admin.cluster.resource_packages.assign.from_personal.description')}
              testId="admin.cluster.resource_package_detail.assign_editor.from_personal"
            />
          ) : null}
        </div>
      </Modal>

      {/* Delete assignment */}
      <ConfirmDialog
        open={deleteAssignState.open}
        onCancel={() => setDeleteAssignState({ open: false, rec: undefined })}
        onConfirm={() => deleteAssignM.mutate()}
        danger
        title={t('admin.cluster.resource_packages.assign.delete_confirm.title')}
        description={t('admin.cluster.resource_packages.assign.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteAssignM.isPending}
        testId="admin.cluster.resource_package_detail.assign_delete_confirm"
      >
        <div className="text-sm text-muted">
          {t('admin.cluster.resource_packages.assign.delete_confirm.hint', {
            user: userLabel((deleteAssignState.rec as any)?.user),
            environment: envLabel((deleteAssignState.rec as any)?.environment),
          })}
        </div>
      </ConfirmDialog>
    </div>
  );
}

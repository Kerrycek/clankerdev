import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';

import { useChrome } from '../../../../components/layout/ChromeContext';
import { FilterBar } from '../../../../components/layout/FilterBar';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { Select } from '../../../../components/ui/Select';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { TableCard } from '../../../../components/ui/TableCard';

import { getMetaActionStateId } from '../../../../lib/api/haveapi';
import { fetchLocations, type Location } from '../../../../lib/api/infra';
import { objectRef } from '../../../../lib/objectRef';
import { parsePositiveInt } from '../../../../lib/parse';
import {
  createDnsResolver,
  deleteDnsResolver,
  fetchDnsResolvers,
  updateDnsResolver,
  type DnsResolver,
} from '../../../../lib/api/dnsResolvers';

function locLabel(l: Location | null | undefined): string {
  const x: any = l ?? {};
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  return label || (typeof x.id === 'number' ? `#${x.id}` : '—');
}

type EditorState =
  | null
  | {
      mode: 'create' | 'edit';
      resolver?: DnsResolver;
    };

type FormState = {
  label: string;
  ipAddr: string;
  isUniversal: boolean;
  locationId: string;
};

function initForm(r?: DnsResolver): FormState {
  const x: any = r ?? {};
  return {
    label: typeof x.label === 'string' ? x.label : '',
    ipAddr: typeof x.ip_addr === 'string' ? x.ip_addr : '',
    isUniversal: typeof x.is_universal === 'boolean' ? x.is_universal : true,
    locationId: typeof x.location?.id === 'number' ? String(x.location.id) : '',
  };
}

export function DnsResolversPage() {
  const { t } = useI18n();
  const chrome = useChrome();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const pagination = useKeysetPagination({
    id: 'admin.cluster.dns_resolvers',
    filterKey: '',
    searchParams,
    setSearchParams,
    wipeQueryKeys: ['q', 'is_universal', 'location'],
    allowedLimits: [25, 50, 100, 200],
    defaultLimit: 50,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: async () => (await fetchLocations({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const locs = locationsQ.data ?? [];

  const listQ = useQuery({
    queryKey: ['dns_resolvers', pagination.cursor, pagination.limit],
    queryFn: async () =>
      (
        await fetchDnsResolvers({
          limit: pagination.limit,
          fromId: pagination.cursor,
        })
      ).data,
    staleTime: 5_000,
  });

  const resolvers = listQ.data ?? [];

  const pageCursor = resolvers.length > 0 ? resolvers[resolvers.length - 1]?.id : undefined;
  const hasMore = resolvers.length === pagination.limit && typeof pageCursor === 'number';
  const canNext = pagination.hasForward || hasMore;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<FormState>(() => initForm());
  const [deleteState, setDeleteState] = useState<{ open: boolean; resolver?: DnsResolver; force: boolean }>({
    open: false,
    resolver: undefined,
    force: false,
  });

  const openCreate = () => {
    createM.reset();
    setForm(initForm());
    setEditor({ mode: 'create' });
  };

  const openEdit = (r: DnsResolver) => {
    updateM.reset();
    setForm(initForm(r));
    setEditor({ mode: 'edit', resolver: r });
  };

  const createM = useMutation({
    mutationFn: async () => {
      const locId = parsePositiveInt(form.locationId.trim());
      return createDnsResolver({
        ipAddr: form.ipAddr.trim(),
        label: form.label.trim(),
        isUniversal: form.isUniversal,
        locationId: form.isUniversal ? null : locId ?? null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.created') });
      setEditor(null);
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const r = editor?.resolver;
      if (!r) throw new Error('Missing resolver');

      const locId = parsePositiveInt(form.locationId.trim());
      return updateDnsResolver({
        id: r.id,
        ipAddr: form.ipAddr.trim(),
        label: form.label.trim(),
        isUniversal: form.isUniversal,
        locationId: form.isUniversal ? null : locId ?? null,
      });
    },
    onMutate: () => {
      const resolverId = editor?.resolver?.id;
      if (!resolverId) return {};
      const ref = objectRef('DnsResolver', resolverId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
      const resolverId = editor?.resolver?.id;
      if (asId)
        chrome.trackActionState(asId, {
          actionLabelKey: 'admin.cluster.dns_resolvers.action.update',
          objectLabel: form.label.trim() || undefined,
          object: resolverId ? objectRef('DnsResolver', resolverId) : undefined,
        });

      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.saved') });
      setEditor(null);
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      const r = deleteState.resolver;
      if (!r) throw new Error('Missing resolver');
      return deleteDnsResolver({ id: r.id, force: deleteState.force });
    },
    onMutate: () => {
      const resolverId = deleteState.resolver?.id;
      if (!resolverId) return {};
      const ref = objectRef('DnsResolver', resolverId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
      const resolverId = deleteState.resolver?.id;
      if (asId)
        chrome.trackActionState(asId, {
          actionLabelKey: 'admin.cluster.dns_resolvers.action.delete',
          objectLabel: deleteState.resolver?.label ?? undefined,
          object: resolverId ? objectRef('DnsResolver', resolverId) : undefined,
        });

      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.deleted') });
      setDeleteState({ open: false, resolver: undefined, force: false });
    },
  });

  const busy = createM.isPending || updateM.isPending;

  if (listQ.isLoading) {
    return <LoadingState testId="admin.cluster.dns_resolvers.loading" />;
  }

  if (listQ.isError) {
    return (
      <ErrorState
        title={t('admin.cluster.dns_resolvers.error.title')}
        message={t('admin.cluster.dns_resolvers.error.body')}
        onRetry={() => listQ.refetch()}
        testId="admin.cluster.dns_resolvers.error"
      />
    );
  }

  return (
    <div className="mt-4 space-y-4" data-testid="admin.cluster.dns_resolvers.page">
      <FilterBar testId="admin.cluster.dns_resolvers.filters" className="justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={shareUrl} label={t('common.copy_link')} testId="admin.cluster.dns_resolvers.copy_link" />
          <Button variant="secondary" onClick={() => listQ.refetch()}>{t('common.refresh')}</Button>
          <Button variant="primary" onClick={openCreate} testId="admin.cluster.dns_resolvers.create">
            {t('admin.cluster.dns_resolvers.create.button')}
          </Button>
        </div>
      </FilterBar>

      {resolvers.length === 0 ? (
        <EmptyState
          title={t('admin.cluster.dns_resolvers.empty.title')}
          message={t('admin.cluster.dns_resolvers.empty.body')}
          testId="admin.cluster.dns_resolvers.empty"
        />
      ) : (
        <TableCard
          testId="admin.cluster.dns_resolvers.table"
          minWidth="lg"
          footer={
            <KeysetPagination
              testId="admin.cluster.dns_resolvers.pagination"
              canPrev={pagination.canPrev}
              canNext={canNext}
              page={pagination.page}
              pageCount={pagination.stack.length}
              onPrev={pagination.goPrev}
              onNext={() => pagination.goNext(pageCursor)}
              onGoToPage={pagination.goToPage}
              limit={pagination.limit}
              allowedLimits={pagination.allowedLimits}
              onLimitChange={pagination.setLimit}
            />
          }
        >
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.label')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.dns_resolvers.col.ip_addr')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.dns_resolvers.col.universal')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.location')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {resolvers.map((r) => {
              const id = r.id;
              const label = typeof r.label === 'string' && r.label.trim() ? r.label : `#${id}`;
              const ip = typeof r.ip_addr === 'string' ? r.ip_addr : '—';
              const uni = Boolean(r.is_universal);

              return (
                <tr key={id} data-testid={`admin.cluster.dns_resolvers.row.${id}`}>
                  <td className="px-3 py-2 text-fg">{label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{ip}</td>
                  <td className="px-3 py-2">
                    <Badge variant={uni ? 'ok' : 'neutral'}>
                      {uni ? t('admin.cluster.dns_resolvers.badge.universal') : t('admin.cluster.dns_resolvers.badge.location_bound')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted">{uni ? '—' : locLabel((r as any).location ?? null)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(r)}
                        testId={`admin.cluster.dns_resolvers.row.${id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          deleteM.reset();
                          setDeleteState({ open: true, resolver: r, force: false });
                        }}
                        testId={`admin.cluster.dns_resolvers.row.${id}.delete`}
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

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'edit' ? t('admin.cluster.dns_resolvers.edit.title') : t('admin.cluster.dns_resolvers.create.title')}
        onClose={() => {
          if (busy) return;
          if (editor?.mode === 'edit') updateM.reset();
          else createM.reset();
          setEditor(null);
        }}
        testId="admin.cluster.dns_resolvers.editor"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (editor?.mode === 'edit') updateM.reset();
                else createM.reset();
                setEditor(null);
              }}
              disabled={busy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                if (editor?.mode === 'edit') updateM.mutate();
                else createM.mutate();
              }}
              disabled={!form.label.trim() || !form.ipAddr.trim() || (!form.isUniversal && !parsePositiveInt(form.locationId.trim()))}
              testId="admin.cluster.dns_resolvers.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('common.label')}</div>
            <Input
              testId="admin.cluster.dns_resolvers.editor.label"
              ariaLabel={t('common.label')}
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('admin.cluster.dns_resolvers.field.ip_addr')}</div>
            <div className="text-xs text-muted">{t('admin.cluster.dns_resolvers.field.ip_addr_desc')}</div>
            <Input
              testId="admin.cluster.dns_resolvers.editor.ip"
              ariaLabel={t('admin.cluster.dns_resolvers.field.ip_addr')}
              value={form.ipAddr}
              onChange={(e) => setForm((p) => ({ ...p, ipAddr: e.target.value }))}
              className="font-mono text-xs tabular-nums"
            />
          </div>

          <SwitchRow
            testId="admin.cluster.dns_resolvers.editor.universal"
            label={t('admin.cluster.dns_resolvers.field.universal')}
            description={t('admin.cluster.dns_resolvers.field.universal_desc')}
            checked={form.isUniversal}
            onChange={(v) => setForm((p) => ({ ...p, isUniversal: v }))}
          />

          {!form.isUniversal ? (
            <div className="space-y-1">
              <div className="text-sm font-medium text-fg">{t('common.location')}</div>
              <Select
                testId="admin.cluster.dns_resolvers.editor.location"
                value={form.locationId}
                onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                options={[{ value: '', label: t('common.select') }, ...locs.map((l) => ({ value: String(l.id), label: locLabel(l) }))]}
              />
            </div>
          ) : null}

          {locationsQ.isError ? (
            <Alert variant="warn" title={t('admin.cluster.dns_resolvers.locations.error')}>{formatErrorMessage(locationsQ.error)}</Alert>
          ) : null}
          {(editor?.mode === 'edit' ? updateM.isError : createM.isError) ? (
            <Alert variant="danger" title={t('common.error')} testId="admin.cluster.dns_resolvers.editor.error">
              {formatErrorMessage(editor?.mode === 'edit' ? updateM.error : createM.error)}
            </Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title={t('admin.cluster.dns_resolvers.delete.title')}
        description={
          deleteState.resolver
            ? t('admin.cluster.dns_resolvers.delete.desc', {
                label: typeof deleteState.resolver.label === 'string' ? deleteState.resolver.label : `#${deleteState.resolver.id}`,
              })
            : undefined
        }
        danger
        confirmLabel={t('common.delete')}
        confirmLoading={deleteM.isPending}
        onCancel={() => {
          if (deleteM.isPending) return;
          deleteM.reset();
          setDeleteState({ open: false, resolver: undefined, force: false });
        }}
        onConfirm={() => deleteM.mutate()}
        testId="admin.cluster.dns_resolvers.delete"
      >
        <div className="space-y-3">
          <SwitchRow
            testId="admin.cluster.dns_resolvers.delete.force"
            label={t('admin.cluster.dns_resolvers.delete.force')}
            description={t('admin.cluster.dns_resolvers.delete.force_desc')}
            checked={deleteState.force}
            onChange={(v) => setDeleteState((p) => ({ ...p, force: v }))}
          />
          {deleteM.isError ? (
            <Alert variant="danger" title={t('common.error')} testId="admin.cluster.dns_resolvers.delete.error">
              {formatErrorMessage(deleteM.error)}
            </Alert>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}

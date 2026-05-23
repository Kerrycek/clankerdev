import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';

import { useChrome } from '../../../components/layout/ChromeContext';

import {
  createDnsRecord,
  deleteDnsRecord,
  fetchDnsRecords,
  updateDnsRecord,
  type DnsRecord,
} from '../../../lib/api/dns';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { formatErrorMessage } from '../../../lib/errors';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';

import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusDot } from '../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../components/ui/tone';

import { useDnsZoneContext } from './DnsZoneContext';
import { preflightDnsZoneNotBusy } from './dnsPreflight';
import { gateDnsAction } from '../../../lib/gates/dns';
import { getMetaActionStateId } from '../../../lib/api/haveapi';

const TYPE_OPTIONS = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR', 'CAA'];

function recordName(r: DnsRecord): string {
  return String(r.name ?? '');
}

function recordDynamicEnabled(r: DnsRecord): boolean {
  // Historical e2e fixtures used `dynamic`; production uses `dynamic_update_enabled`.
  const v = (r as any).dynamic_update_enabled;
  if (v !== undefined) return v === true;
  return (r as any).dynamic === true;
}

export function DnsZoneRecordsPage() {
  const { t } = useI18n();
  const chrome = useChrome();
  const { zone, refetch: refetchZone, refetchChains, zoneRef, busyLocalLock, busyTransaction, concernClasses } =
    useDnsZoneContext();

  const yesNoBadge = (v: unknown) =>
    v === true ? <Badge variant="ok">{t('common.yes')}</Badge> : <Badge variant="neutral">{t('common.no')}</Badge>;

  const enabledBadge = (v: unknown) =>
    v === true ? (
      <Badge variant="ok">{t('common.enabled')}</Badge>
    ) : (
      <Badge variant="warn">{t('common.disabled')}</Badge>
    );

  const zoneLabelForToast = String((zone as any).name ?? (zone as any).label ?? `Zone #${zone.id}`);

  const [searchParams, setSearchParams] = useSearchParams();
  const [qstr, setQstr] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = qstr.trim();
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [qstr, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: 'dns.records.list',
    filterKey: JSON.stringify({ zoneId: zone.id, q: qstr.trim() }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('A');
  const [createContent, setCreateContent] = useState('');
  const [createTtl, setCreateTtl] = useState('');
  const [createPriority, setCreatePriority] = useState('');
  const [createComment, setCreateComment] = useState('');
  const [createEnabled, setCreateEnabled] = useState(true);
  const [createDynamic, setCreateDynamic] = useState(false);

  const [edit, setEdit] = useState<DnsRecord | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTtl, setEditTtl] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editDynamic, setEditDynamic] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<DnsRecord | null>(null);

  const recordsQ = useQuery({
    queryKey: ['dns_records', 'index', { dns_zone: zone.id, limit: pagination.limit, fromId: pagination.fromId, q: qstr.trim() }],
    queryFn: async () =>
      fetchDnsRecords({
        dns_zone: zone.id,
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qstr.trim() || undefined,
      }),
  });

  const createM = useMutation({
    mutationFn: async () => {
      await preflightDnsZoneNotBusy({ zoneId: zone.id, t, concernClasses, knownBusy: busyTransaction || busyLocalLock });
      return createDnsRecord({
        dns_zone: zone.id,
        name: createName.trim(),
        type: createType,
        content: createContent,
        ttl: createTtl.trim() ? Number(createTtl.trim()) : undefined,
        priority: createPriority.trim() ? Number(createPriority.trim()) : undefined,
        comment: createComment.trim() || undefined,
        enabled: createEnabled,
        dynamic_update_enabled: createDynamic,
      });
    },
    onMutate: () => {
      chrome.acquireLocalLock(zoneRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dns.record.create.label',
          objectLabel: zoneLabelForToast,
          object: zoneRef,
        });
      }
      setCreateOpen(false);
      setCreateName('');
      setCreateType('A');
      setCreateContent('');
      setCreateTtl('');
      setCreatePriority('');
      setCreateComment('');
      setCreateEnabled(true);
      setCreateDynamic(false);
      pagination.goToPage(1);
      recordsQ.refetch();
      refetchZone();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(zoneRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!edit) throw new Error('No record selected');
      await preflightDnsZoneNotBusy({ zoneId: zone.id, t, concernClasses, knownBusy: busyTransaction || busyLocalLock });
      return updateDnsRecord(edit.id, {
        content: editContent,
        ttl: editTtl.trim() ? Number(editTtl.trim()) : undefined,
        priority: editPriority.trim() ? Number(editPriority.trim()) : undefined,
        comment: editComment.trim() || undefined,
        enabled: editEnabled,
        dynamic_update_enabled: editDynamic,
      });
    },
    onMutate: () => {
      chrome.acquireLocalLock(zoneRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dns.record.update.label',
          objectLabel: zoneLabelForToast,
          object: zoneRef,
        });
      }
      setEdit(null);
      recordsQ.refetch();
      refetchZone();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(zoneRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      if (!confirmDelete) throw new Error('No record selected');
      await preflightDnsZoneNotBusy({ zoneId: zone.id, t, concernClasses, knownBusy: busyTransaction || busyLocalLock });
      return deleteDnsRecord(confirmDelete.id);
    },
    onMutate: () => {
      chrome.acquireLocalLock(zoneRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dns.record.delete.label',
          objectLabel: zoneLabelForToast,
          object: zoneRef,
        });
      }
      setConfirmDelete(null);
      recordsQ.refetch();
      refetchZone();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(zoneRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const pageData = recordsQ.data?.data ?? [];
  const totalCount =
    typeof recordsQ.data?.meta?.['total_count'] === 'number' ? Number(recordsQ.data.meta['total_count']) : pageData.length;
  const rows = pageData;

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData as any), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const filtersActive = Boolean(qstr.trim());

  const openEdit = (r: DnsRecord) => {
    setEdit(r);
    setEditContent(String(r.content ?? ''));
    setEditTtl(r.ttl != null ? String(r.ttl) : '');
    setEditPriority(r.priority != null ? String(r.priority) : '');
    setEditComment(String(r.comment ?? ''));
    setEditEnabled(r.enabled !== false);
    setEditDynamic(recordDynamicEnabled(r));
  };

  const busyLocal = busyLocalLock || createM.isPending || updateM.isPending || deleteM.isPending;
  const gateCtx = { busyLocal, busyTransaction };

  const createGate = gateDnsAction('record.create', gateCtx);
  const updateGate = gateDnsAction('record.update', gateCtx);
  const deleteGate = gateDnsAction('record.delete', gateCtx);

  return (
    <div className="space-y-6" data-testid="dns.records.list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t('dns.zone.records.page.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dns.zone.records.page.description')}</p>
          {filtersActive ? <p className="mt-1 text-xs text-faint">{t('list.meta.filters_active')}</p> : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <Input
              value={qstr}
              onChange={(e) => setQstr(e.target.value)}
              placeholder={t('dns.zone.records.search.placeholder')}
              autoComplete="off"
              testId="dns.records.search.input"
            />
            <div className="mt-1 text-xs text-faint">
              {t('common.showing_n_of_m', { shown: rows.length, total: totalCount })}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => recordsQ.refetch()}
              disabled={recordsQ.isFetching}
              testId="dns.records.refresh"
            >
              {t('common.refresh')}
            </Button>
            <ActionButton
              onClick={() => setCreateOpen(true)}
              disabled={!createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dns.records.create.open"
            >
              {t('dns.zone.records.action.add')}
            </ActionButton>
          </div>
        </div>
      </div>

      {recordsQ.isLoading ? (
        <Card>
          <LoadingState testId="dns.records.loading" />
        </Card>
      ) : recordsQ.isError ? (
        <ErrorState
          testId="dns.records.error"
          title={t('dns.zone.records.load_failed')}
          error={recordsQ.error}
          onRetry={() => void recordsQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'dns.records', zoneId: zone.id }}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-sm text-muted">{t('dns.zone.records.empty')}</div>
              </Card>
            ) : (
              rows.map((r) => {
                const rowVariant = r.enabled ? 'ok' : 'warn';
                return (
                <Card key={r.id} testId={`dns.record.card.${r.id}`} className={r.enabled ? undefined : toneSurfaceClass('warn')}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusDot variant={rowVariant} testId={`dns.record.card.${r.id}.dot`} />
                          <div className="truncate text-base font-semibold text-fg">{recordName(r)}</div>
                          <Badge variant="neutral">{String(r.type ?? t('common.na'))}</Badge>
                        </div>
                        {r.comment ? <div className="mt-1 text-sm text-muted">{String(r.comment)}</div> : null}
                        <div className="mt-1 text-xs text-faint">#{r.id}</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {enabledBadge(r.enabled)}
                        {yesNoBadge(recordDynamicEnabled(r))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted">
                      <div>
                        <div className="text-faint">{t('dns.zone.records.table.content')}</div>
                        <div className="break-all font-medium text-fg">{String(r.content ?? '')}</div>
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <div>
                          <div className="text-faint">{t('dns.zone.records.table.ttl')}</div>
                          <div className="font-medium text-fg">{r.ttl != null ? String(r.ttl) : t('common.na')}</div>
                        </div>
                        <div>
                          <div className="text-faint">{t('dns.zone.records.table.priority')}</div>
                          <div className="font-medium text-fg">
                            {r.priority != null ? String(r.priority) : t('common.na')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {r.dynamic_update_url ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-faint">{t('dns.zone.records.field.ddns')}:</span>
                        <CopyButton
                          text={String(r.dynamic_update_url)}
                          label={t('common.copy_link')}
                          size="sm"
                          testId={`dns.record.card.${r.id}.ddns_copy`}
                        />
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(r)}
                        disabled={!updateGate.allowed}
                        disabledReason={!updateGate.allowed ? updateGate.reason : undefined}
                        testId={`dns.record.card.${r.id}.edit`}
                      >
                        {t('common.edit')}
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmDelete(r)}
                        disabled={!deleteGate.allowed}
                        disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                        testId={`dns.record.card.${r.id}.delete`}
                      >
                        {t('common.delete')}
                      </ActionButton>
                    </div>
                  </div>
                </Card>
              );
              })
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-list">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th className="py-2 pl-4 pr-3">{t('dns.zone.records.table.name')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.type')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.content')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.ttl')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.priority')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.enabled')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.records.table.dynamic')}</th>
                    <th className="py-2 pr-4 text-right">{t('dns.zone.records.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-muted">
                        {t('dns.zone.records.empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const rowVariant = r.enabled ? 'ok' : 'warn';
                      return (
                      <tr
                        key={r.id}
                        className="border-t border-border"
                        data-row-variant={r.enabled ? undefined : 'warn'}
                        data-testid={`dns.record.row.${r.id}`}
                      >
                        <td className="py-2 pl-4 pr-2">
                          <StatusDot variant={rowVariant} testId={`dns.record.row.${r.id}.dot`} />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-fg">{recordName(r)}</div>
                          {r.comment ? <div className="mt-1 text-xs text-muted">{String(r.comment)}</div> : null}
                          <div className="mt-1 text-xs text-faint">#{r.id}</div>
                          {r.dynamic_update_url ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-faint">{t('dns.zone.records.field.ddns')}:</span>
                              <CopyButton
                                text={String(r.dynamic_update_url)}
                                label={t('common.copy_link')}
                                size="sm"
                                testId={`dns.record.row.${r.id}.ddns_copy`}
                              />
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">{String(r.type ?? t('common.na'))}</td>
                        <td className="py-2 pr-3">
                          <div className="max-w-content-sm truncate">{String(r.content ?? '')}</div>
                        </td>
                        <td className="py-2 pr-3">{r.ttl != null ? String(r.ttl) : t('common.na')}</td>
                        <td className="py-2 pr-3">{r.priority != null ? String(r.priority) : t('common.na')}</td>
                        <td className="py-2 pr-3">{enabledBadge(r.enabled)}</td>
                        <td className="py-2 pr-3">{yesNoBadge(recordDynamicEnabled(r))}</td>
                        <td className="py-2 pr-4 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              onClick={() => openEdit(r)}
                              disabled={!updateGate.allowed}
                              disabledReason={!updateGate.allowed ? updateGate.reason : undefined}
                              testId={`dns.record.row.${r.id}.edit`}
                            >
                              {t('common.edit')}
                            </ActionButton>
                            <ActionButton
                              size="sm"
                              variant="danger"
                              onClick={() => setConfirmDelete(r)}
                              disabled={!deleteGate.allowed}
                              disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                              testId={`dns.record.row.${r.id}.delete`}
                            >
                              {t('common.delete')}
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <KeysetPagination
              page={pagination.page}
              pageCount={pagination.stack.length}
              canPrev={pagination.canPrev}
              canNext={hasMore}
              onPrev={pagination.goPrev}
              onNext={() => pagination.goNext(pageCursor)}
              onGoToPage={pagination.goToPage}
              limit={pagination.limit}
              allowedLimits={pagination.allowedLimits}
              onLimitChange={pagination.setLimit}
              testId="dns.records.pagination.desktop"
            />
          </Card>

          {/* Mobile pagination */}
          <div className="md:hidden">
            <Card>
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={hasMore}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="dns.records.pagination.mobile"
                className="border-t-0"
              />
            </Card>
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('dns.zone.records.modal.create.title')}>
        <div className="space-y-4" data-testid="dns.records.create.modal">
          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.name.label')}</div>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="www"
              testId="dns.records.create.name"
            />
            <div className="mt-1 text-xs text-faint">{t('dns.zone.records.modal.create.name.help')}</div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.type.label')}</div>
            <Select value={createType} onChange={(e) => setCreateType(e.target.value)} testId="dns.records.create.type">
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.content.label')}</div>
            <Input
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              placeholder="1.2.3.4"
              testId="dns.records.create.content"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.ttl.label')}</div>
              <Input
                value={createTtl}
                onChange={(e) => setCreateTtl(e.target.value)}
                placeholder="3600"
                testId="dns.records.create.ttl"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.priority.label')}</div>
              <Input
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
                placeholder="10"
                testId="dns.records.create.priority"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.comment.label')}</div>
            <Input
              value={createComment}
              onChange={(e) => setCreateComment(e.target.value)}
              placeholder={t('common.optional')}
              testId="dns.records.create.comment"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Checkbox
              checked={createEnabled}
              onChange={setCreateEnabled}
              label={t('common.enabled')}
              disabled={createM.isPending}
              testId="dns.records.create.enabled"
            />
            <Checkbox
              checked={createDynamic}
              onChange={setCreateDynamic}
              label={t('dns.zone.records.modal.create.dynamic.label')}
              disabled={createM.isPending}
              testId="dns.records.create.dynamic"
            />
          </div>

          {createM.isError ? (
            <Alert title={t('dns.zone.records.modal.create.failed')} variant="danger">
              {formatErrorMessage(createM.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={createM.isPending}
              testId="dns.records.create.cancel"
            >
              {t('common.cancel')}
            </Button>
            <ActionButton
              onClick={() => createM.mutate()}
              loading={createM.isPending}
              disabled={!createName.trim() || !createContent.trim() || !createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dns.records.create.submit"
            >
              {createM.isPending ? t('common.creating') : t('common.create')}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={t('dns.zone.records.modal.edit.title')}>
        <div className="space-y-4" data-testid="dns.records.edit.modal">
          <div className="text-sm text-muted">
            {t('dns.zone.records.modal.edit.subtitle', { name: edit ? recordName(edit) : '' })}
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.content.label')}</div>
            <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} testId="dns.records.edit.content" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.ttl.label')}</div>
              <Input
                value={editTtl}
                onChange={(e) => setEditTtl(e.target.value)}
                placeholder="3600"
                testId="dns.records.edit.ttl"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.priority.label')}</div>
              <Input
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                placeholder="10"
                testId="dns.records.edit.priority"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.records.modal.create.comment.label')}</div>
            <Input
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              placeholder={t('common.optional')}
              testId="dns.records.edit.comment"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Checkbox
              checked={editEnabled}
              onChange={setEditEnabled}
              label={t('common.enabled')}
              disabled={updateM.isPending}
              testId="dns.records.edit.enabled"
            />
            <Checkbox
              checked={editDynamic}
              onChange={setEditDynamic}
              label={t('dns.zone.records.modal.create.dynamic.label')}
              disabled={updateM.isPending}
              testId="dns.records.edit.dynamic"
            />
          </div>

          {updateM.isError ? (
            <Alert title={t('dns.zone.records.modal.edit.failed')} variant="danger">
              {formatErrorMessage(updateM.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setEdit(null)}
              disabled={updateM.isPending}
              testId="dns.records.edit.cancel"
            >
              {t('common.cancel')}
            </Button>
            <ActionButton
              onClick={() => updateM.mutate()}
              loading={updateM.isPending}
              disabled={!updateGate.allowed}
              disabledReason={!updateGate.allowed ? updateGate.reason : undefined}
              testId="dns.records.edit.submit"
            >
              {updateM.isPending ? t('common.saving') : t('common.save')}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        testId="dns.records.delete_confirm"
        title={t('dns.zone.records.delete_confirm.title')}
        description={t('dns.zone.records.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        danger
        confirmDisabled={!deleteGate.allowed}
        confirmLoading={deleteM.isPending}
        cancelDisabled={deleteM.isPending}
        onCancel={() => {
          setConfirmDelete(null);
          deleteM.reset();
        }}
        onConfirm={() => deleteM.mutate()}
      >
        {confirmDelete ? (
          <div className="text-sm text-muted">
            {t('dns.zone.records.delete_confirm.prompt', {
              name: recordName(confirmDelete),
              type: String(confirmDelete.type ?? t('common.na')),
            })}
          </div>
        ) : null}

        {!deleteGate.allowed ? (
          <Alert title={t(deleteGate.reason.titleKey)} variant="warn">
            {deleteGate.reason.descriptionKey ? t(deleteGate.reason.descriptionKey) : null}
          </Alert>
        ) : null}
        {deleteM.isError ? (
          <Alert title={t('dns.zone.records.delete_confirm.failed')} variant="danger">
            {formatErrorMessage(deleteM.error)}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

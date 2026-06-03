import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';

import { useChrome } from '../../../components/layout/ChromeContext';

import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

import { fetchTransactionChains } from '../../../lib/api/transactions';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import {
  createDatasetSnapshot,
  createSnapshotDownload,
  deleteDatasetSnapshot,
  fetchDatasetSnapshots,
  rollbackDatasetSnapshot,
  type Snapshot,
  type SnapshotDownloadFormat,
} from '../../../lib/api/datasets';

import { formatErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/format';
import { gateDatasetAction } from '../../../lib/gates/dataset';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { hasActiveChains } from '../../../lib/taskStatus';

import { useDatasetContext } from './DatasetContext';

function snapshotLabel(s: Snapshot): string {
  return String(s.label ?? s.name ?? `#${s.id}`);
}

function uniqSnapshots(input: Snapshot[]): Snapshot[] {
  const byId = new Map<number, Snapshot>();
  for (const s of input) {
    const id = Number((s as any).id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!byId.has(id)) byId.set(id, s);
  }
  return [...byId.values()];
}

type ConfirmState =
  | null
  | {
      kind: 'rollback' | 'delete';
      snapshot: Snapshot;
    };

export function DatasetSnapshotsPage() {
  const {
    dataset,
    refetch: refetchDataset,
    busyTransaction,
    refetchChains,
    datasetRef,
    busyLocalLock,
  } = useDatasetContext();
  const chrome = useChrome();
  const { t } = useI18n();

  const datasetLabelForToast = String((dataset as any).label ?? (dataset as any).name ?? `Dataset #${dataset.id}`);

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
    id: 'dataset.snapshots.list',
    filterKey: JSON.stringify({ datasetId: dataset.id, q: qstr.trim() }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');

  useEffect(() => {
    if (searchParams.get('action') !== 'create') return;
    setCreateOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('action');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSnapshot, setDownloadSnapshot] = useState<Snapshot | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<SnapshotDownloadFormat>('archive');
  const [downloadFromId, setDownloadFromId] = useState<string>('');
  const [downloadSendMail, setDownloadSendMail] = useState(true);

  // Candidate snapshot list for selecting a base snapshot (incremental streams).
  // This is separate from the paginated list view, because users may need to select snapshots
  // outside of the currently loaded page.
  const [candDatasetId, setCandDatasetId] = useState<number | null>(null);
  const [candSnaps, setCandSnaps] = useState<Snapshot[]>([]);
  const [candCursor, setCandCursor] = useState<number | null>(null);
  const [candHasMore, setCandHasMore] = useState(false);
  const [candBusy, setCandBusy] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);
  const candBatchSize = 100;

  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const snapsQ = useQuery({
    queryKey: ['datasets', dataset.id, 'snapshots', { limit: pagination.limit, fromId: pagination.fromId, q: qstr.trim() }],
    queryFn: async () =>
      fetchDatasetSnapshots(dataset.id, { limit: pagination.limit, fromId: pagination.fromId, q: qstr.trim() || undefined }),
  });

  async function preflightDatasetNotBusy() {
    const chainsRes = await fetchTransactionChains({ className: 'Dataset', rowId: dataset.id, limit: 10 });
    if (hasActiveChains(chainsRes.data)) {
      const err: any = new Error(t('toast.action_blocked.body'));
      err.code = 'BUSY';
      throw err;
    }
  }

  const createSnap = useMutation({
    mutationFn: async () => {
      await preflightDatasetNotBusy();
      return createDatasetSnapshot(dataset.id, { label: createLabel.trim() || undefined });
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined)
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dataset.snapshot.create.label',
          objectLabel: datasetLabelForToast,
          object: datasetRef,
        });

      setCreateOpen(false);
      setCreateLabel('');

      // Newly created snapshot is likely on page 1.
      pagination.goToPage(1);
      snapsQ.refetch();
      refetchDataset();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const rollbackSnap = useMutation({
    mutationFn: async (snapshotId: number) => {
      await preflightDatasetNotBusy();
      return rollbackDatasetSnapshot(dataset.id, snapshotId);
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined)
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dataset.snapshot.rollback.label',
          objectLabel: datasetLabelForToast,
          object: datasetRef,
        });

      snapsQ.refetch();
      refetchDataset();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const deleteSnap = useMutation({
    mutationFn: async (snapshotId: number) => {
      await preflightDatasetNotBusy();
      return deleteDatasetSnapshot(dataset.id, snapshotId);
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined)
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dataset.snapshot.delete.label',
          objectLabel: datasetLabelForToast,
          object: datasetRef,
        });

      snapsQ.refetch();
      refetchDataset();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const createDl = useMutation({
    mutationFn: async (payload: {
      snapshotId: number;
      fromSnapshotId?: number;
      format: SnapshotDownloadFormat;
      sendMail: boolean;
    }) => {
      await preflightDatasetNotBusy();
      return createSnapshotDownload({
        snapshot: payload.snapshotId,
        from_snapshot: payload.fromSnapshotId,
        format: payload.format,
        send_mail: payload.sendMail,
      });
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined)
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dataset.download.create.label',
          objectLabel: datasetLabelForToast,
          object: datasetRef,
        });

      setDownloadOpen(false);
      setDownloadSnapshot(null);
      setDownloadFromId('');
      setDownloadFormat('archive');
      setDownloadSendMail(true);
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const pageData = snapsQ.data?.data ?? [];
  const totalCount =
    typeof snapsQ.data?.meta?.['total_count'] === 'number' ? Number(snapsQ.data.meta['total_count']) : pageData.length;
  const rows = pageData;

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData as any), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const filtersActive = Boolean(qstr.trim());

  function openDownloadModal(s: Snapshot) {
    setDownloadSnapshot(s);
    setDownloadFormat('archive');
    setDownloadFromId('');
    setDownloadSendMail(true);
    setDownloadOpen(true);
  }

  function openConfirm(next: NonNullable<ConfirmState>) {
    setConfirmPhrase('');
    setConfirmError(null);
    setConfirm(next);
  }

  async function ensureCandidateSnapshots(mode: 'reset' | 'load-more') {
    if (candBusy) return;

    const isReset = mode === 'reset';
    const datasetChanged = candDatasetId !== dataset.id;
    if (isReset || datasetChanged) {
      setCandDatasetId(dataset.id);
      setCandSnaps([]);
      setCandCursor(null);
      setCandHasMore(false);
      setCandError(null);
    }

    const cursor = isReset || datasetChanged ? undefined : candCursor ?? undefined;
    if (!isReset && !datasetChanged && !candHasMore) return;

    setCandBusy(true);
    setCandError(null);
    try {
      const fetched = (await fetchDatasetSnapshots(dataset.id, { limit: candBatchSize, fromId: cursor })).data;
      const merged = uniqSnapshots([...(isReset || datasetChanged ? [] : candSnaps), ...fetched]);
      merged.sort((a, b) => Number(b.id) - Number(a.id));
      setCandSnaps(merged);
      setCandCursor(cursorFromDescendingPage(merged as any));
      setCandHasMore(fetched.length >= candBatchSize);
    } catch (e) {
      setCandError(formatErrorMessage(e));
    } finally {
      setCandBusy(false);
    }
  }

  // When opening the download modal, ensure candidates are loaded.
  useEffect(() => {
    if (!downloadOpen) return;
    // Reset to include newest candidates first.
    ensureCandidateSnapshots('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadOpen, dataset.id]);

  function onCreateDownload() {
    if (!downloadSnapshot) return;
    const fromIdRaw = downloadFormat === 'incremental_stream' ? Number(downloadFromId) : undefined;
    const fromId = Number.isFinite(fromIdRaw as any) && (fromIdRaw as any) > 0 ? fromIdRaw : undefined;
    createDl.mutate({
      snapshotId: downloadSnapshot.id,
      fromSnapshotId: fromId,
      format: downloadFormat,
      sendMail: downloadSendMail,
    });
  }

  const baseCandidates = useMemo(() => {
    const targetId = downloadSnapshot ? Number(downloadSnapshot.id) : NaN;
    const filtered = candSnaps.filter((s) => {
      const id = Number((s as any).id);
      if (!Number.isFinite(targetId)) return true;
      // Base snapshot should be older than the selected snapshot.
      return Number.isFinite(id) ? id < targetId : true;
    });
    return filtered;
  }, [candSnaps, downloadSnapshot]);

  const busyLocal =
    busyLocalLock ||
    createSnap.isPending ||
    rollbackSnap.isPending ||
    deleteSnap.isPending ||
    createDl.isPending ||
    confirmBusy;

  const createGate = gateDatasetAction('snapshot.create', { dataset, busyLocal, busyTransaction });
  const downloadGate = gateDatasetAction('download.create', { dataset, busyLocal, busyTransaction });
  const rollbackGate = gateDatasetAction('snapshot.rollback', { dataset, busyLocal, busyTransaction });
  const deleteGate = gateDatasetAction('snapshot.delete', { dataset, busyLocal, busyTransaction });

  const confirmGate = confirm?.kind === 'rollback' ? rollbackGate : confirm?.kind === 'delete' ? deleteGate : null;
  const confirmTestId =
    confirm?.kind === 'rollback'
      ? 'dataset.snapshots.rollback_confirm'
      : confirm?.kind === 'delete'
        ? 'dataset.snapshots.delete_confirm'
        : undefined;

  return (
    <div className="space-y-6" data-testid="dataset.snapshots.list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t('dataset.snapshots.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dataset.snapshots.subtitle')}</p>
          {filtersActive ? <p className="mt-1 text-xs text-faint">{t('list.meta.filters_active')}</p> : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <Input
              value={qstr}
              onChange={(e) => setQstr(e.target.value)}
              placeholder={t('dataset.snapshots.search.placeholder')}
              autoComplete="off"
              testId="dataset.snapshots.search.input"
            />
            <div className="mt-1 text-xs text-faint">
              {t('common.showing_n_of_m', { shown: rows.length, total: totalCount })}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              testId="dataset.snapshots.refresh"
              variant="secondary"
              onClick={() => snapsQ.refetch()}
              disabled={snapsQ.isFetching}
            >
              {t('common.refresh')}
            </Button>
            <ActionButton
              onClick={() => setCreateOpen(true)}
              disabled={!createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dataset.snapshots.create.open"
            >
              {t('dataset.snapshots.create.open')}
            </ActionButton>
          </div>
        </div>
      </div>

      {snapsQ.isLoading ? (
        <Card>
          <LoadingState testId="dataset.snapshots.loading" />
        </Card>
      ) : snapsQ.isError ? (
        <ErrorState
          testId="dataset.snapshots.error"
          title={t('dataset.snapshots.load_error.title')}
          error={snapsQ.error}
          onRetry={() => void snapsQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'dataset.snapshots', datasetId: dataset.id }}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-sm text-muted">{t('dataset.snapshots.empty')}</div>
              </Card>
            ) : (
              rows.map((s) => (
                <Card key={s.id} testId={`dataset.snapshots.card.${s.id}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-fg">{String(s.name ?? t('common.na'))}</div>
                        <div className="mt-0.5 text-xs text-faint">#{s.id}</div>
                        {s.label ? <div className="mt-1 text-sm text-muted">{String(s.label)}</div> : null}
                        <div className="mt-1 text-xs text-faint">
                          {t('dataset.snapshots.created_at', { dt: formatDateTime(s.created_at as any) })}
                        </div>
                      </div>
                      <Badge variant="neutral">#{s.id}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => openDownloadModal(s)}
                        disabled={!downloadGate.allowed}
                        disabledReason={!downloadGate.allowed ? downloadGate.reason : undefined}
                        testId={`dataset.snapshots.card.${s.id}.download`}
                      >
                        {t('common.download')}
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => openConfirm({ kind: 'rollback', snapshot: s })}
                        disabled={!rollbackGate.allowed}
                        disabledReason={!rollbackGate.allowed ? rollbackGate.reason : undefined}
                        testId={`dataset.snapshots.card.${s.id}.rollback`}
                      >
                        {t('common.rollback')}
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        variant="danger"
                        onClick={() => openConfirm({ kind: 'delete', snapshot: s })}
                        disabled={!deleteGate.allowed}
                        disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                        testId={`dataset.snapshots.card.${s.id}.delete`}
                      >
                        {t('common.delete')}
                      </ActionButton>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-list">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th className="py-2 pl-4 pr-3">{t('common.name')}</th>
                    <th className="py-2 pr-3">{t('common.label')}</th>
                    <th className="py-2 pr-3">{t('common.created')}</th>
                    <th className="py-2 pr-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-muted">
                        {t('dataset.snapshots.empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((s) => (
                      <tr key={s.id} className="border-t border-border" data-testid={`dataset.snapshots.row.${s.id}`}>
                        <td className="py-2 pl-4 pr-3">
                          <div className="font-medium text-fg">{String(s.name ?? t('common.na'))}</div>
                          <div className="mt-1 text-xs text-faint">#{s.id}</div>
                        </td>
                        <td className="py-2 pr-3">
                          {s.label ? String(s.label) : <span className="text-faint">{t('common.na')}</span>}
                        </td>
                        <td className="py-2 pr-3">{formatDateTime(s.created_at as any)}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              onClick={() => openDownloadModal(s)}
                              disabled={!downloadGate.allowed}
                              disabledReason={!downloadGate.allowed ? downloadGate.reason : undefined}
                              testId={`dataset.snapshots.row.${s.id}.download`}
                            >
                              {t('common.download')}
                            </ActionButton>
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              onClick={() => openConfirm({ kind: 'rollback', snapshot: s })}
                              disabled={!rollbackGate.allowed}
                              disabledReason={!rollbackGate.allowed ? rollbackGate.reason : undefined}
                              testId={`dataset.snapshots.row.${s.id}.rollback`}
                            >
                              {t('common.rollback')}
                            </ActionButton>
                            <ActionButton
                              size="sm"
                              variant="danger"
                              onClick={() => openConfirm({ kind: 'delete', snapshot: s })}
                              disabled={!deleteGate.allowed}
                              disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                              testId={`dataset.snapshots.row.${s.id}.delete`}
                            >
                              {t('common.delete')}
                            </ActionButton>
                            <Badge variant="neutral">#{s.id}</Badge>
                          </div>
                        </td>
                      </tr>
                    ))
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
              testId="dataset.snapshots.pagination.desktop"
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
                testId="dataset.snapshots.pagination.mobile"
                className="border-t-0"
              />
            </Card>
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('dataset.snapshots.create.modal_title')}>
        <div className="space-y-4" data-testid="dataset.snapshots.create.modal">
          <div className="text-sm text-muted">{t('dataset.snapshots.create.help')}</div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('common.label')}</div>
            <Input
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder={t('dataset.snapshots.create.label.placeholder')}
              testId="dataset.snapshots.create.label"
            />
          </div>

          {createSnap.isError ? (
            <Alert title={t('dataset.snapshots.create.error.title')} variant="danger">
              {formatErrorMessage(createSnap.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} testId="dataset.snapshots.create.cancel">
              {t('common.cancel')}
            </Button>
            <ActionButton
              onClick={() => createSnap.mutate()}
              loading={createSnap.isPending}
              disabled={!createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dataset.snapshots.create.submit"
            >
              {createSnap.isPending ? t('common.creating') : t('common.create')}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={downloadOpen} onClose={() => setDownloadOpen(false)} title={t('dataset.download.modal_title')}>
        <div className="space-y-4" data-testid="dataset.snapshots.download.modal">
          <div className="text-sm text-muted">
            {t('dataset.download.modal_help', {
              snapshot: downloadSnapshot ? snapshotLabel(downloadSnapshot) : t('common.na'),
            })}
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.format')}</div>
            <Select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value as SnapshotDownloadFormat)}
              testId="dataset.snapshots.download.format"
            >
              <option value="archive">{t('dataset.download.format.archive')}</option>
              <option value="stream">{t('dataset.download.format.stream')}</option>
              <option value="incremental_stream">{t('dataset.download.format.incremental_stream')}</option>
            </Select>
          </div>

          {downloadFormat === 'incremental_stream' ? (
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.from_snapshot')}</div>
              <Select
                value={downloadFromId}
                onChange={(e) => setDownloadFromId(e.target.value)}
                testId="dataset.snapshots.download.from_snapshot"
              >
                <option value="">{t('dataset.download.from_snapshot.none')}</option>
                {baseCandidates.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {snapshotLabel(s)} (#{s.id})
                  </option>
                ))}
              </Select>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-faint">{t('dataset.download.from_snapshot.help')}</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => ensureCandidateSnapshots('load-more')}
                  disabled={candBusy || !candHasMore}
                  testId="dataset.snapshots.download.load_more"
                >
                  {candBusy ? t('common.loading') : candHasMore ? t('dataset.download.load_older') : t('dataset.download.no_more')}
                </Button>
              </div>
              {candError ? (
                <div className="mt-2">
                  <Alert title={t('dataset.download.candidates.error.title')} variant="danger">
                    {candError}
                  </Alert>
                </div>
              ) : null}
            </div>
          ) : null}

          <Checkbox
            checked={downloadSendMail}
            onChange={setDownloadSendMail}
            label={t('dataset.download.send_mail.label')}
            testId="dataset.snapshots.download.send_mail"
          />

          {createDl.isError ? (
            <Alert title={t('dataset.download.create.error.title')} variant="danger">
              {formatErrorMessage(createDl.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDownloadOpen(false)} testId="dataset.snapshots.download.cancel">
              {t('common.cancel')}
            </Button>
            <ActionButton
              onClick={onCreateDownload}
              loading={createDl.isPending}
              disabled={!downloadSnapshot || !downloadGate.allowed}
              disabledReason={!downloadGate.allowed ? downloadGate.reason : undefined}
              testId="dataset.snapshots.download.submit"
            >
              {createDl.isPending ? t('common.creating') : t('dataset.download.create_link')}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        testId={confirmTestId}
        title={
          confirm?.kind === 'rollback'
            ? t('dataset.snapshots.confirm.rollback.title')
            : confirm?.kind === 'delete'
              ? t('dataset.snapshots.confirm.delete.title')
              : ''
        }
        description={
          confirm?.kind === 'rollback'
            ? t('dataset.snapshots.confirm.rollback.body', {
                snapshot: confirm ? snapshotLabel(confirm.snapshot) : t('common.na'),
              })
            : confirm?.kind === 'delete'
              ? t('dataset.snapshots.confirm.delete.body', {
                  snapshot: confirm ? snapshotLabel(confirm.snapshot) : t('common.na'),
                })
              : ''
        }
        confirmLabel={confirm?.kind === 'rollback' ? t('common.rollback') : t('common.delete')}
        danger
        confirmLoading={confirmBusy}
        confirmDisabled={confirmBusy || (confirmGate ? !confirmGate.allowed : false)}
        confirmationText={confirm ? snapshotLabel(confirm.snapshot) : undefined}
        confirmationValue={confirmPhrase}
        onConfirmationValueChange={setConfirmPhrase}
        cancelDisabled={confirmBusy}
        onCancel={() => {
          if (confirmBusy) return;
          setConfirm(null);
          setConfirmPhrase('');
          setConfirmError(null);
          setConfirmBusy(false);
        }}
        onConfirm={async () => {
          const c = confirm;
          if (!c || confirmBusy) return;
          if (confirmGate && !confirmGate.allowed) return;
          if (confirmPhrase !== snapshotLabel(c.snapshot)) return;
          setConfirmBusy(true);
          setConfirmError(null);
          try {
            if (c.kind === 'rollback') await rollbackSnap.mutateAsync(c.snapshot.id);
            else await deleteSnap.mutateAsync(c.snapshot.id);
            setConfirm(null);
          } catch (e) {
            setConfirmError(formatErrorMessage(e));
          } finally {
            setConfirmBusy(false);
          }
        }}
      >
        {confirmGate && !confirmGate.allowed && confirmGate.reason ? (
          <Alert title={t(confirmGate.reason.titleKey)} variant="warn">
            {confirmGate.reason.descriptionKey ? t(confirmGate.reason.descriptionKey) : null}
          </Alert>
        ) : null}

        {confirmError ? (
          <Alert title={t('common.action_failed')} variant="danger">
            {confirmError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

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
import { CopyButton } from '../../../components/ui/CopyButton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

import { fetchTransactionChains } from '../../../lib/api/transactions';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import {
  createSnapshotDownload,
  deleteSnapshotDownload,
  fetchDatasetSnapshots,
  fetchSnapshotDownloads,
  type Snapshot,
  type SnapshotDownload,
  type SnapshotDownloadFormat,
} from '../../../lib/api/datasets';

import { formatErrorMessage } from '../../../lib/errors';
import { formatDateTime, formatMiB } from '../../../lib/format';
import { gateDatasetAction } from '../../../lib/gates/dataset';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { hasActiveChains } from '../../../lib/taskStatus';

import { useDatasetContext } from './DatasetContext';

function readyBadge(dl: SnapshotDownload, t: (k: any) => string) {
  if (dl.ready === true) return <Badge variant="ok">{t('dataset.downloads.state.ready')}</Badge>;
  if (dl.ready === false) return <Badge variant="warn">{t('dataset.downloads.state.pending')}</Badge>;
  return <Badge variant="neutral">{t('dataset.downloads.state.unknown')}</Badge>;
}

function formatLabel(fmt: SnapshotDownloadFormat | undefined, t: (k: any) => string): string {
  if (fmt === 'archive') return t('dataset.download.format.archive');
  if (fmt === 'stream') return t('dataset.download.format.stream');
  if (fmt === 'incremental_stream') return t('dataset.download.format.incremental_stream');
  return fmt ? String(fmt) : t('common.na');
}

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

export function DatasetDownloadsPage() {
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
    id: 'dataset.downloads.list',
    filterKey: JSON.stringify({ datasetId: dataset.id, q: qstr.trim() }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createSnapshotId, setCreateSnapshotId] = useState<string>('');
  const [createFormat, setCreateFormat] = useState<SnapshotDownloadFormat>('archive');
  const [createFromId, setCreateFromId] = useState<string>('');
  const [createSendMail, setCreateSendMail] = useState(true);

  const [confirm, setConfirm] = useState<SnapshotDownload | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Candidate snapshots for the create modal (may need older snapshots than the current page).
  const [candDatasetId, setCandDatasetId] = useState<number | null>(null);
  const [candSnaps, setCandSnaps] = useState<Snapshot[]>([]);
  const [candCursor, setCandCursor] = useState<number | null>(null);
  const [candHasMore, setCandHasMore] = useState(false);
  const [candBusy, setCandBusy] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);
  const candBatchSize = 100;

  const dlsQ = useQuery({
    queryKey: ['datasets', dataset.id, 'snapshot_downloads', { limit: pagination.limit, fromId: pagination.fromId, q: qstr.trim() }],
    queryFn: async () =>
      fetchSnapshotDownloads({
        dataset: dataset.id,
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qstr.trim() || undefined,
      }),
  });

  async function preflightDatasetNotBusy() {
    const chainsRes = await fetchTransactionChains({ className: 'Dataset', rowId: dataset.id, limit: 10 });
    if (hasActiveChains(chainsRes.data)) {
      const err: any = new Error(t('toast.action_blocked.body'));
      err.code = 'BUSY';
      throw err;
    }
  }

  const createDl = useMutation({
    mutationFn: async () => {
      await preflightDatasetNotBusy();
      return createSnapshotDownload({
        snapshot: Number(createSnapshotId),
        from_snapshot:
          createFormat === 'incremental_stream' ? (createFromId ? Number(createFromId) : undefined) : undefined,
        format: createFormat,
        send_mail: createSendMail,
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

      setCreateOpen(false);
      setCreateSnapshotId('');
      setCreateFormat('archive');
      setCreateFromId('');
      setCreateSendMail(true);

      pagination.goToPage(1);
      dlsQ.refetch();
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

  const delDl = useMutation({
    mutationFn: async (id: number) => {
      await preflightDatasetNotBusy();
      return deleteSnapshotDownload(id);
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined)
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dataset.download.delete.label',
          objectLabel: datasetLabelForToast,
          object: datasetRef,
        });
      dlsQ.refetch();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const pageData = dlsQ.data?.data ?? [];
  const totalCount =
    typeof dlsQ.data?.meta?.['total_count'] === 'number' ? Number(dlsQ.data.meta['total_count']) : pageData.length;
  const rows = pageData;

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData as any), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const filtersActive = Boolean(qstr.trim());

  const selectedSnapshot = useMemo(() => {
    const id = Number(createSnapshotId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return candSnaps.find((s) => Number(s.id) === id) ?? null;
  }, [candSnaps, createSnapshotId]);

  const fromCandidates = useMemo(() => {
    if (createFormat !== 'incremental_stream') return [];
    const targetId = selectedSnapshot ? Number(selectedSnapshot.id) : NaN;
    return candSnaps
      .filter((s) => {
        const id = Number(s.id);
        if (!Number.isFinite(targetId)) return true;
        return Number.isFinite(id) ? id < targetId : true;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [candSnaps, createFormat, selectedSnapshot]);

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

  // When opening the create modal, ensure candidates are loaded.
  useEffect(() => {
    if (!createOpen) return;
    ensureCandidateSnapshots('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, dataset.id]);

  const busyLocal = busyLocalLock || createDl.isPending || delDl.isPending || confirmBusy;

  const createGate = gateDatasetAction('download.create', { dataset, busyLocal, busyTransaction });
  const deleteGate = gateDatasetAction('download.delete', { dataset, busyLocal, busyTransaction });

  return (
    <div className="space-y-6" data-testid="dataset.downloads.list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t('dataset.downloads.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dataset.downloads.subtitle')}</p>
          {filtersActive ? <p className="mt-1 text-xs text-faint">{t('list.meta.filters_active')}</p> : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <Input
              value={qstr}
              onChange={(e) => setQstr(e.target.value)}
              placeholder={t('dataset.downloads.search.placeholder')}
              autoComplete="off"
              testId="dataset.downloads.search.input"
            />
            <div className="mt-1 text-xs text-faint">
              {t('common.showing_n_of_m', { shown: rows.length, total: totalCount })}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              testId="dataset.downloads.refresh"
              variant="secondary"
              onClick={() => dlsQ.refetch()}
              disabled={dlsQ.isFetching}
            >
              {t('common.refresh')}
            </Button>
            <ActionButton
              onClick={() => setCreateOpen(true)}
              disabled={!createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dataset.downloads.create.open"
            >
              {t('dataset.downloads.create.open')}
            </ActionButton>
          </div>
        </div>
      </div>

      {dlsQ.isLoading ? (
        <Card>
          <LoadingState testId="dataset.downloads.loading" />
        </Card>
      ) : dlsQ.isError ? (
        <ErrorState
          testId="dataset.downloads.error"
          title={t('dataset.downloads.load_error.title')}
          error={dlsQ.error}
          onRetry={() => void dlsQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'dataset.downloads', datasetId: dataset.id }}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-sm text-muted">{t('dataset.downloads.empty')}</div>
              </Card>
            ) : (
              rows.map((dl) => {
                const snap = dl.snapshot as any;
                const snapId = typeof snap?.id === 'number' ? Number(snap.id) : undefined;
                const sha = (dl as any).sha256sum ?? (dl as any).sha256;
                return (
                  <Card key={dl.id} testId={`dataset.downloads.card.${dl.id}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-fg">
                            {dl.file_name ? String(dl.file_name) : t('dataset.downloads.item_title', { id: dl.id })}
                          </div>
                          <div className="mt-0.5 text-xs text-faint">#{dl.id}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                            {readyBadge(dl, t)}
                            <span>{formatLabel(dl.format, t)}</span>
                            {snapId ? <span>{t('dataset.downloads.snapshot_ref', { id: snapId })}</span> : null}
                          </div>
                          {dl.expiration_date ? (
                            <div className="mt-1 text-xs text-faint">
                              {t('dataset.downloads.expires_at', { dt: formatDateTime(dl.expiration_date as any) })}
                            </div>
                          ) : null}
                          {sha ? <div className="mt-1 break-words text-xs text-faint">sha256: {String(sha)}</div> : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <ActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => window.open(dl.url ?? '', '_blank', 'noopener,noreferrer')}
                          disabled={!dl.ready || !dl.url}
                          testId={`dataset.downloads.card.${dl.id}.download`}
                        >
                          {t('common.download')}
                        </ActionButton>

                        {dl.url ? (
                          <CopyButton
                            text={dl.url}
                            label={t('common.copy_link')}
                            size="sm"
                            testId={`dataset.downloads.card.${dl.id}.copy_link`}
                          />
                        ) : null}

                        {sha ? (
                          <CopyButton
                            text={String(sha)}
                            label={t('common.copy')}
                            size="sm"
                            testId={`dataset.downloads.card.${dl.id}.copy_sha256`}
                          />
                        ) : null}

                        <ActionButton
                          size="sm"
                          variant="danger"
                          onClick={() => setConfirm(dl)}
                          disabled={!deleteGate.allowed}
                          disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                          testId={`dataset.downloads.card.${dl.id}.delete`}
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

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-list">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th className="py-2 pl-4 pr-3">{t('dataset.downloads.table.snapshot')}</th>
                    <th className="py-2 pr-3">{t('dataset.downloads.table.format')}</th>
                    <th className="py-2 pr-3">{t('dataset.downloads.table.state')}</th>
                    <th className="py-2 pr-3">{t('dataset.downloads.table.expires')}</th>
                    <th className="py-2 pr-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-muted">
                        {t('dataset.downloads.empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((dl) => {
                      const snap = dl.snapshot as any;
                      const snapId = typeof snap?.id === 'number' ? Number(snap.id) : undefined;
                      const sha = (dl as any).sha256sum ?? (dl as any).sha256;

                      return (
                        <tr key={dl.id} className="border-t border-border" data-testid={`dataset.downloads.row.${dl.id}`}>
                          <td className="py-2 pl-4 pr-3">
                            <div className="font-medium text-fg">
                              {dl.file_name ? String(dl.file_name) : t('dataset.downloads.item_title', { id: dl.id })}
                            </div>
                            <div className="mt-1 text-xs text-faint">#{dl.id}</div>
                            {snapId ? (
                              <div className="mt-1 text-xs text-faint">{t('dataset.downloads.snapshot_ref', { id: snapId })}</div>
                            ) : null}
                            {dl.size !== undefined ? (
                              <div className="mt-1 text-xs text-faint">{t('dataset.downloads.size', { size: formatMiB(dl.size) })}</div>
                            ) : null}
                            {sha ? <div className="mt-1 break-words text-xs text-faint">sha256: {String(sha)}</div> : null}
                          </td>
                          <td className="py-2 pr-3">{formatLabel(dl.format, t)}</td>
                          <td className="py-2 pr-3">{readyBadge(dl, t)}</td>
                          <td className="py-2 pr-3">
                            {dl.expiration_date ? formatDateTime(dl.expiration_date as any) : <span className="text-faint">{t('common.na')}</span>}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <ActionButton
                                size="sm"
                                variant="secondary"
                                onClick={() => window.open(dl.url ?? '', '_blank', 'noopener,noreferrer')}
                                disabled={!dl.ready || !dl.url}
                                testId={`dataset.downloads.row.${dl.id}.download`}
                              >
                                {t('common.download')}
                              </ActionButton>

                              {dl.url ? (
                                <CopyButton
                                  text={dl.url}
                                  label={t('common.copy_link')}
                                  size="sm"
                                  testId={`dataset.downloads.row.${dl.id}.copy_link`}
                                />
                              ) : null}

                              {sha ? (
                                <CopyButton
                                  text={String(sha)}
                                  label={t('common.copy')}
                                  size="sm"
                                  testId={`dataset.downloads.row.${dl.id}.copy_sha256`}
                                />
                              ) : null}

                              <ActionButton
                                size="sm"
                                variant="danger"
                                onClick={() => setConfirm(dl)}
                                disabled={!deleteGate.allowed}
                                disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
                                testId={`dataset.downloads.row.${dl.id}.delete`}
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
              testId="dataset.downloads.pagination.desktop"
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
                testId="dataset.downloads.pagination.mobile"
                className="border-t-0"
              />
            </Card>
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('dataset.download.modal_title')}>
        <div className="space-y-4" data-testid="dataset.downloads.create.modal">
          <div className="text-sm text-muted">{t('dataset.downloads.create.help')}</div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.snapshot')}</div>
            <Select
              value={createSnapshotId}
              onChange={(e) => setCreateSnapshotId(e.target.value)}
              testId="dataset.downloads.create.snapshot"
            >
              <option value="">{t('dataset.download.snapshot.placeholder')}</option>
              {candSnaps.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {snapshotLabel(s)} (#{s.id})
                </option>
              ))}
            </Select>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-faint">{t('dataset.download.snapshot.help')}</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => ensureCandidateSnapshots('load-more')}
                disabled={candBusy || !candHasMore}
                testId="dataset.downloads.create.load_more"
              >
                {candBusy
                  ? t('common.loading')
                  : candHasMore
                    ? t('dataset.download.load_older')
                    : t('dataset.download.no_more')}
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

          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.format')}</div>
            <Select
              value={createFormat}
              onChange={(e) => setCreateFormat(e.target.value as SnapshotDownloadFormat)}
              testId="dataset.downloads.create.format"
            >
              <option value="archive">{t('dataset.download.format.archive')}</option>
              <option value="stream">{t('dataset.download.format.stream')}</option>
              <option value="incremental_stream">{t('dataset.download.format.incremental_stream')}</option>
            </Select>
          </div>

          {createFormat === 'incremental_stream' ? (
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.from_snapshot')}</div>
              <Select
                value={createFromId}
                onChange={(e) => setCreateFromId(e.target.value)}
                testId="dataset.downloads.create.from_snapshot"
              >
                <option value="">{t('dataset.download.from_snapshot.none')}</option>
                {fromCandidates.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {snapshotLabel(s)} (#{s.id})
                  </option>
                ))}
              </Select>
              <div className="mt-1 text-xs text-faint">{t('dataset.download.from_snapshot.help')}</div>
            </div>
          ) : null}

          <Checkbox
            checked={createSendMail}
            onChange={setCreateSendMail}
            label={t('dataset.download.send_mail.label')}
            testId="dataset.downloads.create.send_mail"
          />

          {createDl.isError ? (
            <Alert title={t('dataset.download.create.error.title')} variant="danger">
              {formatErrorMessage(createDl.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} testId="dataset.downloads.create.cancel">
              {t('common.cancel')}
            </Button>
            <ActionButton
              onClick={() => createDl.mutate()}
              loading={createDl.isPending}
              disabled={!createSnapshotId || !createGate.allowed}
              disabledReason={!createGate.allowed ? createGate.reason : undefined}
              testId="dataset.downloads.create.submit"
            >
              {createDl.isPending ? t('common.creating') : t('dataset.download.create_link')}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        testId="dataset.downloads.delete_confirm"
        title={t('dataset.downloads.confirm.delete.title')}
        description={t('dataset.downloads.confirm.delete.body', { id: confirm ? confirm.id : 0 })}
        confirmLabel={t('common.delete')}
        danger
        confirmLoading={confirmBusy}
        confirmDisabled={confirmBusy || !deleteGate.allowed}
        cancelDisabled={confirmBusy}
        onCancel={() => {
          if (confirmBusy) return;
          setConfirm(null);
          setConfirmError(null);
          setConfirmBusy(false);
        }}
        onConfirm={async () => {
          if (!confirm || confirmBusy || !deleteGate.allowed) return;
          setConfirmBusy(true);
          setConfirmError(null);
          try {
            await delDl.mutateAsync(confirm.id);
            setConfirm(null);
          } catch (e) {
            setConfirmError(formatErrorMessage(e));
          } finally {
            setConfirmBusy(false);
          }
        }}
      >
        {!deleteGate.allowed && deleteGate.reason ? (
          <Alert title={t(deleteGate.reason.titleKey)} variant="warn">
            {deleteGate.reason.descriptionKey ? t(deleteGate.reason.descriptionKey) : null}
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

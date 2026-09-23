import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useAuth } from "../../../app/auth";
import { useI18n } from "../../../app/i18n";
import { useChrome } from "../../../components/layout/ChromeContext";
import { Alert } from "../../../components/ui/Alert";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ErrorState } from "../../../components/ui/ErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { fetchTransactionChains } from "../../../lib/api/transactions";
import { getMetaActionStateId, getMetaTotalCount } from "../../../lib/api/haveapi";
import {
  createSnapshotDownload,
  deleteSnapshotDownload,
  fetchDatasetSnapshots,
  fetchSnapshotDownloads,
  type Snapshot,
  type SnapshotDownload,
} from "../../../lib/api/datasets";
import { formatErrorMessage } from "../../../lib/errors";
import { gateDatasetAction } from "../../../lib/gates/dataset";
import { useKeysetPagination } from "../../../lib/hooks/useKeysetPagination";
import { cursorFromAscendingPage } from "../../../lib/lockIndex";
import { hasActiveChains } from "../../../lib/taskStatus";
import { useDatasetContext } from "./DatasetContext";
import { DatasetDownloadCreateDialog } from "./DatasetDownloadCreateDialog";
import { DatasetDownloadsList } from "./DatasetDownloadsList";
import {
  buildSnapshotDownloadPayload,
  defaultSnapshotDownloadDraft,
  findSnapshotById,
  snapshotDownloadDraftFromDownload,
  incrementalFromCandidates,
  uniqSnapshots,
  type SnapshotDownloadDraft,
} from "./DatasetDownloadModel";

class BusyDatasetError extends Error {
  code = "BUSY";
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
  const { role } = useAuth();
  const datasetLabelForToast =
    dataset.label ??
    dataset.full_name ??
    dataset.name ??
    `Dataset #${dataset.id}`;

  const [searchParams, setSearchParams] = useSearchParams();
  const pagination = useKeysetPagination({
    id: "dataset.downloads.list",
    filterKey: String(dataset.id),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<SnapshotDownloadDraft>(() =>
    defaultSnapshotDownloadDraft(),
  );

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    setCreateOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const [confirm, setConfirm] = useState<SnapshotDownload | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [candDatasetId, setCandDatasetId] = useState<number | null>(null);
  const [candSnaps, setCandSnaps] = useState<Snapshot[]>([]);
  const [candCursor, setCandCursor] = useState<number | null>(null);
  const [candHasMore, setCandHasMore] = useState(false);
  const [candBusy, setCandBusy] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);
  const candBatchSize = 100;

  const dlsQ = useQuery({
    queryKey: [
      "datasets",
      dataset.id,
      "snapshot_downloads",
      { limit: pagination.limit, fromId: pagination.fromId },
    ],
    queryFn: async () =>
      fetchSnapshotDownloads({
        dataset: dataset.id,
        // Fetch one look-ahead row; total_count is informative, not a reliable
        // keyset end marker when a deep link or concurrent mutation is involved.
        limit: pagination.limit + 1,
        fromId: pagination.fromId,
        count: true,
      }),
  });

  async function preflightDatasetNotBusy() {
    const chainsRes = await fetchTransactionChains({
      className: "Dataset",
      rowId: dataset.id,
      limit: 10,
    });
    if (hasActiveChains(chainsRes.data))
      throw new BusyDatasetError(t("toast.action_blocked.body"));
  }

  const createDl = useMutation({
    mutationFn: async () => {
      await preflightDatasetNotBusy();
      return createSnapshotDownload(buildSnapshotDownloadPayload(createDraft));
    },
    onMutate: () => {
      chrome.acquireLocalLock(datasetRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: "action.dataset.download.create.label",
          objectLabel: datasetLabelForToast,
          object: datasetRef,
          progressTitleKey: "modal.dataset.download.create.title",
          blockUi: true,
        });
      }

      setCreateOpen(false);
      setCreateDraft(defaultSnapshotDownloadDraft());
      pagination.goToPage(1);
      dlsQ.refetch();
      refetchDataset();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: unknown) => {
      if (err instanceof BusyDatasetError) chrome.openTasks();
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
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: "action.dataset.download.delete.label",
          objectLabel: datasetLabelForToast,
          object: datasetRef,
          progressTitleKey: "modal.dataset.download.delete.title",
        });
      }
      dlsQ.refetch();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(datasetRef);
    },
    onError: (err: unknown) => {
      if (err instanceof BusyDatasetError) chrome.openTasks();
    },
  });

  const pageData = dlsQ.data?.data ?? [];
  const reportedTotalCount = getMetaTotalCount(dlsQ.data?.meta);
  const rows = pageData.slice(0, pagination.limit);
  const totalCount = reportedTotalCount ?? rows.length;
  const pageCursor = useMemo(
    () => cursorFromAscendingPage(rows),
    [rows],
  );
  const hasMore = pagination.hasForward || pageData.length > pagination.limit;
  const selectedSnapshot = useMemo(
    () => findSnapshotById(candSnaps, createDraft.snapshotId),
    [candSnaps, createDraft.snapshotId],
  );
  const fromCandidates = useMemo(
    () =>
      createDraft.format === "incremental_stream"
        ? incrementalFromCandidates(candSnaps, selectedSnapshot)
        : [],
    [candSnaps, createDraft.format, selectedSnapshot],
  );

  async function ensureCandidateSnapshots(mode: "reset" | "load-more") {
    if (candBusy) return;

    const isReset = mode === "reset";
    const datasetChanged = candDatasetId !== dataset.id;
    if (isReset || datasetChanged) {
      setCandDatasetId(dataset.id);
      setCandSnaps([]);
      setCandCursor(null);
      setCandHasMore(false);
      setCandError(null);
    }

    const cursor =
      isReset || datasetChanged ? undefined : (candCursor ?? undefined);
    if (!isReset && !datasetChanged && !candHasMore) return;

    setCandBusy(true);
    setCandError(null);
    try {
      const fetchedWithLookahead = (
        await fetchDatasetSnapshots(dataset.id, {
          limit: candBatchSize + 1,
          fromId: cursor,
        })
      ).data;
      const fetched = fetchedWithLookahead.slice(0, candBatchSize);
      const merged = uniqSnapshots([
        ...(isReset || datasetChanged ? [] : candSnaps),
        ...fetched,
      ]);
      merged.sort((a, b) => Number(b.id) - Number(a.id));
      setCandSnaps(merged);
      setCandCursor(cursorFromAscendingPage(fetched));
      setCandHasMore(fetchedWithLookahead.length > candBatchSize);
    } catch (e) {
      setCandError(formatErrorMessage(e));
    } finally {
      setCandBusy(false);
    }
  }

  useEffect(() => {
    if (!createOpen) return;
    ensureCandidateSnapshots("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, dataset.id]);

  const busyLocal =
    busyLocalLock || createDl.isPending || delDl.isPending || confirmBusy;
  const createGate = gateDatasetAction("download.create", {
    dataset,
    busyLocal,
    busyTransaction,
    role,
  });
  const deleteGate = gateDatasetAction("download.delete", {
    dataset,
    busyLocal,
    busyTransaction,
    role,
  });

  function openDeleteConfirm(download: SnapshotDownload) {
    setConfirmError(null);
    setConfirm(download);
  }

  function retryDownload(download: SnapshotDownload) {
    createDl.reset();
    setCreateDraft(snapshotDownloadDraftFromDownload(download));
    setCreateOpen(true);
  }

  return (
    <div className="space-y-6" data-testid="dataset.downloads.list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">
            {t("dataset.downloads.title")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t("dataset.downloads.subtitle")}
          </p>
          <p className="mt-1 text-xs text-faint">
            {t("common.showing_n_of_m", {
              shown: rows.length,
              total: totalCount,
            })}
          </p>
        </div>

        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <Button
            testId="dataset.downloads.refresh"
            variant="secondary"
            onClick={() => dlsQ.refetch()}
            disabled={dlsQ.isFetching}
          >
            {t("common.refresh")}
          </Button>
          <ActionButton
            onClick={() => {
              createDl.reset();
              setCreateOpen(true);
            }}
            disabled={!createGate.allowed}
            disabledReason={
              !createGate.allowed ? createGate.reason : undefined
            }
            testId="dataset.downloads.create.open"
          >
            {t("dataset.downloads.create.open")}
          </ActionButton>
        </div>
      </div>

      {dlsQ.isLoading ? (
        <Card>
          <LoadingState testId="dataset.downloads.loading" />
        </Card>
      ) : dlsQ.isError ? (
        <ErrorState
          testId="dataset.downloads.error"
          title={t("dataset.downloads.load_error.title")}
          error={dlsQ.error}
          onRetry={() => void dlsQ.refetch()}
          showBack={false}
          detailsExtra={{ page: "dataset.downloads", datasetId: dataset.id }}
        />
      ) : (
        <DatasetDownloadsList
          rows={rows}
          createGate={createGate}
          deleteGate={deleteGate}
          onDelete={openDeleteConfirm}
          onRetry={retryDownload}
          pagination={{
            page: pagination.page,
            pageCount: pagination.stack.length,
            canPrev: pagination.canPrev,
            canNext: hasMore,
            onPrev: pagination.goPrev,
            onNext: () => pagination.goNext(pageCursor),
            onGoToPage: pagination.goToPage,
            limit: pagination.limit,
            allowedLimits: pagination.allowedLimits,
            onLimitChange: pagination.setLimit,
          }}
        />
      )}

      <DatasetDownloadCreateDialog
        open={createOpen}
        onClose={() => {
          if (createDl.isPending) return;
          createDl.reset();
          setCreateOpen(false);
        }}
        datasetLabel={datasetLabelForToast}
        draft={createDraft}
        onDraftChange={setCreateDraft}
        snapshots={candSnaps}
        fromCandidates={fromCandidates}
        loadMoreSnapshots={() => ensureCandidateSnapshots("load-more")}
        candidatesBusy={candBusy}
        candidatesHasMore={candHasMore}
        candidatesError={candError}
        createGate={createGate}
        createError={createDl.error}
        createPending={createDl.isPending}
        onSubmit={() => createDl.mutate()}
      />

      <ConfirmDialog
        open={confirm !== null}
        testId="dataset.downloads.delete_confirm"
        title={t("dataset.downloads.confirm.delete.title")}
        description={t("dataset.downloads.confirm.delete.body", {
          id: confirm ? confirm.id : 0,
        })}
        confirmLabel={t("common.delete")}
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
            {deleteGate.reason.descriptionKey
              ? t(deleteGate.reason.descriptionKey)
              : null}
          </Alert>
        ) : null}

        <Alert
          title={t("dataset.downloads.confirm.delete.review.title")}
          variant="info"
        >
          {t("dataset.downloads.confirm.delete.review.body")}
        </Alert>

        {confirmError ? (
          <Alert title={t("common.action_failed")} variant="danger">
            {confirmError}
          </Alert>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

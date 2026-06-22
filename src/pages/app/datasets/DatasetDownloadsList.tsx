import React, { useMemo } from "react";

import { getRuntimeConfig } from "../../../app/config";
import { useI18n } from "../../../app/i18n";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Card } from "../../../components/ui/Card";
import { CopyButton } from "../../../components/ui/CopyButton";
import { KeysetPagination } from "../../../components/ui/KeysetPagination";
import type {
  SnapshotDownload,
  SnapshotDownloadFormat,
} from "../../../lib/api/datasets";
import { formatDateTime, formatMiB } from "../../../lib/format";
import type { GateDecision } from "../../../lib/gates/types";
import {
  downloadChecksum,
  downloadExpiration,
  refLabel,
  snapshotDownloadCanOpen,
  snapshotDownloadHref,
  snapshotDownloadStatus,
} from "./DatasetDownloadModel";
import {
  DatasetDownloadOpenButton,
  DatasetDownloadStateBadge,
  datasetDownloadStatusHelp,
  shouldOfferDownloadRetry,
} from "./DatasetDownloadStatusView";

function formatLabel(
  fmt: SnapshotDownloadFormat | undefined,
  t: (k: string) => string,
): string {
  if (fmt === "archive") return t("dataset.download.format.archive");
  if (fmt === "stream") return t("dataset.download.format.stream");
  if (fmt === "incremental_stream")
    return t("dataset.download.format.incremental_stream");
  return fmt ? String(fmt) : t("common.na");
}

type DatasetDownloadsPaginationProps = {
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  limit: number;
  allowedLimits: readonly number[];
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

export function DatasetDownloadsList(props: {
  rows: SnapshotDownload[];
  isAdmin: boolean;
  createGate: GateDecision;
  deleteGate: GateDecision;
  onDelete: (download: SnapshotDownload) => void;
  onRetry: (download: SnapshotDownload) => void;
  pagination: DatasetDownloadsPaginationProps;
}) {
  const { t } = useI18n();
  const cfg = useMemo(() => getRuntimeConfig(), []);
  const downloadHrefOptions = useMemo(
    () => ({
      webuiUrl: cfg.webuiUrl,
      origin:
        typeof window !== "undefined" ? window.location.origin : undefined,
    }),
    [cfg.webuiUrl],
  );
  const now = useMemo(() => new Date(), [props.rows]);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {props.rows.length === 0 ? (
          <Card>
            <div className="p-4 text-center text-sm text-muted">
              {t("dataset.downloads.empty")}
            </div>
          </Card>
        ) : (
          props.rows.map((download) => {
            const snap = download.snapshot;
            const snapId =
              snap && typeof snap === "object" ? Number(snap.id) : undefined;
            const fromSnap = download.from_snapshot;
            const fromSnapId =
              fromSnap && typeof fromSnap === "object"
                ? Number(fromSnap.id)
                : undefined;
            const expiration = downloadExpiration(download);
            const checksum = downloadChecksum(download);
            const downloadHref = snapshotDownloadHref(
              download,
              downloadHrefOptions,
            );
            const status = snapshotDownloadStatus(download, {
              href: downloadHref,
              now,
            });
            const canOpen = snapshotDownloadCanOpen(status, downloadHref);
            const statusText = datasetDownloadStatusHelp(status, download, t);
            return (
              <Card
                key={download.id}
                testId={`dataset.downloads.card.${download.id}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-fg">
                        {download.file_name
                          ? String(download.file_name)
                          : t("dataset.downloads.item_title", {
                              id: download.id,
                            })}
                      </div>
                      <div className="mt-0.5 text-xs text-faint">
                        #{download.id}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                        <DatasetDownloadStateBadge status={status} t={t} />
                        <span>{formatLabel(download.format, t)}</span>
                        {Number.isFinite(snapId) ? (
                          <span>
                            {t("dataset.downloads.snapshot_ref", {
                              id: snapId,
                            })}
                          </span>
                        ) : null}
                        {Number.isFinite(fromSnapId) ? (
                          <span>
                            {t("dataset.downloads.from_snapshot_ref", {
                              id: fromSnapId,
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="mt-1 text-xs text-muted"
                        data-testid={`dataset.downloads.card.${download.id}.status_detail`}
                      >
                        {statusText}
                      </div>
                      {expiration ? (
                        <div className="mt-1 text-xs text-faint">
                          {t("dataset.downloads.expires_at", {
                            dt: formatDateTime(expiration),
                          })}
                        </div>
                      ) : null}
                      {checksum ? (
                        <div className="mt-1 break-words text-xs text-faint">
                          sha256: {checksum}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <DatasetDownloadOpenButton
                      href={downloadHref}
                      canOpen={canOpen}
                      disabledTitle={statusText}
                      testId={`dataset.downloads.card.${download.id}.download`}
                    />

                    {canOpen && downloadHref ? (
                      <CopyButton
                        text={downloadHref}
                        label={t("common.copy_link")}
                        size="sm"
                        testId={`dataset.downloads.card.${download.id}.copy_link`}
                      />
                    ) : null}

                    {checksum ? (
                      <CopyButton
                        text={checksum}
                        label={t("common.copy")}
                        size="sm"
                        testId={`dataset.downloads.card.${download.id}.copy_sha256`}
                      />
                    ) : null}

                    {shouldOfferDownloadRetry(status) ? (
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onClick={() => props.onRetry(download)}
                        disabled={!props.createGate.allowed}
                        disabledReason={
                          !props.createGate.allowed
                            ? props.createGate.reason
                            : undefined
                        }
                        testId={`dataset.downloads.card.${download.id}.retry`}
                      >
                        {t("common.retry")}
                      </ActionButton>
                    ) : null}

                    {props.isAdmin ? (
                      <ActionButton
                        size="sm"
                        variant="danger"
                        onClick={() => props.onDelete(download)}
                        disabled={!props.deleteGate.allowed}
                        disabledReason={
                          !props.deleteGate.allowed
                            ? props.deleteGate.reason
                            : undefined
                        }
                        testId={`dataset.downloads.card.${download.id}.delete`}
                      >
                        {t("common.delete")}
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-list">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pl-4 pr-3">
                  {t("dataset.downloads.table.snapshot")}
                </th>
                <th className="py-2 pr-3">
                  {t("dataset.downloads.table.format")}
                </th>
                <th className="py-2 pr-3">
                  {t("dataset.downloads.table.state")}
                </th>
                <th className="py-2 pr-3">
                  {t("dataset.downloads.table.expires")}
                </th>
                <th className="py-2 pr-4">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted"
                  >
                    {t("dataset.downloads.empty")}
                  </td>
                </tr>
              ) : (
                props.rows.map((download) => {
                  const snap = download.snapshot;
                  const snapId =
                    snap && typeof snap === "object"
                      ? Number(snap.id)
                      : undefined;
                  const expiration = downloadExpiration(download);
                  const checksum = downloadChecksum(download);
                  const downloadHref = snapshotDownloadHref(
                    download,
                    downloadHrefOptions,
                  );
                  const status = snapshotDownloadStatus(download, {
                    href: downloadHref,
                    now,
                  });
                  const canOpen = snapshotDownloadCanOpen(status, downloadHref);
                  const statusText = datasetDownloadStatusHelp(
                    status,
                    download,
                    t,
                  );

                  return (
                    <tr
                      key={download.id}
                      className="border-t border-border"
                      data-testid={`dataset.downloads.row.${download.id}`}
                    >
                      <td className="py-2 pl-4 pr-3">
                        <div className="font-medium text-fg">
                          {download.file_name
                            ? String(download.file_name)
                            : t("dataset.downloads.item_title", {
                                id: download.id,
                              })}
                        </div>
                        <div className="mt-1 text-xs text-faint">
                          #{download.id}
                        </div>
                        {Number.isFinite(snapId) ? (
                          <div className="mt-1 text-xs text-faint">
                            {t("dataset.downloads.snapshot_ref", {
                              id: snapId,
                            })}
                          </div>
                        ) : null}
                        {download.from_snapshot ? (
                          <div className="mt-1 text-xs text-faint">
                            {t("dataset.downloads.from_snapshot", {
                              snapshot: refLabel(
                                download.from_snapshot,
                                t("common.na"),
                              ),
                            })}
                          </div>
                        ) : null}
                        {download.size !== undefined ? (
                          <div className="mt-1 text-xs text-faint">
                            {t("dataset.downloads.size", {
                              size: formatMiB(download.size),
                            })}
                          </div>
                        ) : null}
                        {checksum ? (
                          <div className="mt-1 break-words text-xs text-faint">
                            sha256: {checksum}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        {formatLabel(download.format, t)}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="space-y-1">
                          <DatasetDownloadStateBadge status={status} t={t} />
                          <div
                            className="max-w-xs text-xs text-muted"
                            data-testid={`dataset.downloads.row.${download.id}.status_detail`}
                          >
                            {statusText}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {expiration ? (
                          formatDateTime(expiration)
                        ) : (
                          <span className="text-faint">{t("common.na")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <DatasetDownloadOpenButton
                            href={downloadHref}
                            canOpen={canOpen}
                            disabledTitle={statusText}
                            testId={`dataset.downloads.row.${download.id}.download`}
                          />

                          {canOpen && downloadHref ? (
                            <CopyButton
                              text={downloadHref}
                              label={t("common.copy_link")}
                              size="sm"
                              testId={`dataset.downloads.row.${download.id}.copy_link`}
                            />
                          ) : null}

                          {checksum ? (
                            <CopyButton
                              text={checksum}
                              label={t("common.copy")}
                              size="sm"
                              testId={`dataset.downloads.row.${download.id}.copy_sha256`}
                            />
                          ) : null}

                          {shouldOfferDownloadRetry(status) ? (
                            <ActionButton
                              size="sm"
                              variant="secondary"
                              onClick={() => props.onRetry(download)}
                              disabled={!props.createGate.allowed}
                              disabledReason={
                                !props.createGate.allowed
                                  ? props.createGate.reason
                                  : undefined
                              }
                              testId={`dataset.downloads.row.${download.id}.retry`}
                            >
                              {t("common.retry")}
                            </ActionButton>
                          ) : null}

                          {props.isAdmin ? (
                            <ActionButton
                              size="sm"
                              variant="danger"
                              onClick={() => props.onDelete(download)}
                              disabled={!props.deleteGate.allowed}
                              disabledReason={
                                !props.deleteGate.allowed
                                  ? props.deleteGate.reason
                                  : undefined
                              }
                              testId={`dataset.downloads.row.${download.id}.delete`}
                            >
                              {t("common.delete")}
                            </ActionButton>
                          ) : null}
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
          {...props.pagination}
          testId="dataset.downloads.pagination.desktop"
        />
      </Card>

      <div className="md:hidden">
        <Card>
          <KeysetPagination
            {...props.pagination}
            testId="dataset.downloads.pagination.mobile"
            className="border-t-0"
          />
        </Card>
      </div>
    </>
  );
}

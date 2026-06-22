import React from "react";

import { useI18n } from "../../../app/i18n";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import type { SnapshotDownload } from "../../../lib/api/datasets";
import {
  snapshotDownloadFailureMessage,
  type SnapshotDownloadStatus,
} from "./DatasetDownloadModel";

export function DatasetDownloadStateBadge(props: {
  status: SnapshotDownloadStatus;
  t: (k: string) => string;
}) {
  switch (props.status) {
    case "ready":
      return (
        <Badge variant="ok">{props.t("dataset.downloads.state.ready")}</Badge>
      );
    case "pending":
      return (
        <Badge variant="warn">
          {props.t("dataset.downloads.state.pending")}
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="neutral">
          {props.t("dataset.downloads.state.expired")}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="danger">
          {props.t("dataset.downloads.state.failed")}
        </Badge>
      );
    case "missing_link":
      return (
        <Badge variant="warn">
          {props.t("dataset.downloads.state.missing_link")}
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral">
          {props.t("dataset.downloads.state.unknown")}
        </Badge>
      );
  }
}

export function datasetDownloadStatusHelp(
  status: SnapshotDownloadStatus,
  download: SnapshotDownload,
  t: (k: string) => string,
) {
  if (status === "failed") {
    return (
      snapshotDownloadFailureMessage(download) ??
      t("dataset.downloads.state_detail.failed")
    );
  }
  return t(`dataset.downloads.state_detail.${status}`);
}

export function shouldOfferDownloadRetry(
  status: SnapshotDownloadStatus,
): boolean {
  return (
    status === "expired" || status === "failed" || status === "missing_link"
  );
}

export function DatasetDownloadOpenButton(props: {
  href?: string;
  canOpen: boolean;
  disabledTitle: string;
  testId: string;
}) {
  const { t } = useI18n();

  if (props.canOpen && props.href) {
    return (
      <Button
        as="a"
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        size="sm"
        variant="secondary"
        testId={props.testId}
      >
        {t("common.download")}
      </Button>
    );
  }

  return (
    <ActionButton
      size="sm"
      variant="secondary"
      disabled
      title={props.disabledTitle}
      testId={props.testId}
    >
      {t("common.download")}
    </ActionButton>
  );
}

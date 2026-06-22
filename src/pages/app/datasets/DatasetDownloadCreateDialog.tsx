import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { Snapshot, SnapshotDownloadFormat } from '../../../lib/api/datasets';
import type { GateDecision } from '../../../lib/gates/types';
import { formatErrorMessage } from '../../../lib/errors';
import {
  findSnapshotById,
  snapshotLabel,
  type SnapshotDownloadDraft,
  validateSnapshotDownloadDraft,
} from './DatasetDownloadModel';

function formatLabel(fmt: SnapshotDownloadFormat | undefined, t: (k: string) => string): string {
  if (fmt === 'archive') return t('dataset.download.format.archive');
  if (fmt === 'stream') return t('dataset.download.format.stream');
  if (fmt === 'incremental_stream') return t('dataset.download.format.incremental_stream');
  return fmt ? String(fmt) : t('common.na');
}

function boolLabel(value: boolean, t: (k: string) => string): string {
  return value ? t('common.yes') : t('common.no');
}

function CreateDownloadReview(props: {
  draft: SnapshotDownloadDraft;
  snapshots: Snapshot[];
  fromCandidates: Snapshot[];
  datasetLabel: string;
}) {
  const { t } = useI18n();
  const selected = findSnapshotById(props.snapshots, props.draft.snapshotId);
  const from = findSnapshotById(props.fromCandidates, props.draft.fromSnapshotId);
  const validation = validateSnapshotDownloadDraft(props.draft);

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid="dataset.downloads.create.review">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t('dataset.downloads.review.title')}</div>
        <div className="mt-1 text-muted">{t('dataset.downloads.review.intro')}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs text-faint">{t('common.dataset')}</div>
          <div className="font-medium text-fg">{props.datasetLabel}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('dataset.download.field.snapshot')}</div>
          <div className="font-medium text-fg">{selected ? `${snapshotLabel(selected)} (#${selected.id})` : t('dataset.download.snapshot.placeholder')}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('dataset.download.field.format')}</div>
          <div className="font-medium text-fg">{formatLabel(props.draft.format, t)}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('dataset.download.field.from_snapshot')}</div>
          <div className="font-medium text-fg">
            {props.draft.format === 'incremental_stream'
              ? from
                ? `${snapshotLabel(from)} (#${from.id})`
                : t('dataset.download.from_snapshot.none')
              : t('common.na')}
          </div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('dataset.download.send_mail.label')}</div>
          <div className="font-medium text-fg">{boolLabel(props.draft.sendMail, t)}</div>
        </div>
      </div>

      {validation.issues.includes('from_snapshot_same_or_newer') ? (
        <Alert title={t('dataset.downloads.validation.from_snapshot.title')} variant="warn">
          {t('dataset.downloads.validation.from_snapshot.body')}
        </Alert>
      ) : null}

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>{t('dataset.downloads.review.temporary')}</li>
        <li>{t('dataset.downloads.review.readiness')}</li>
        <li>{props.draft.format === 'incremental_stream' ? t('dataset.downloads.review.incremental') : t('dataset.downloads.review.full')}</li>
      </ul>
    </div>
  );
}

export function DatasetDownloadCreateDialog(props: {
  open: boolean;
  onClose: () => void;
  datasetLabel: string;
  draft: SnapshotDownloadDraft;
  onDraftChange: (draft: SnapshotDownloadDraft) => void;
  snapshots: Snapshot[];
  fromCandidates: Snapshot[];
  loadMoreSnapshots: () => void;
  candidatesBusy: boolean;
  candidatesHasMore: boolean;
  candidatesError: string | null;
  createGate: GateDecision;
  createError: unknown;
  createPending: boolean;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const validation = validateSnapshotDownloadDraft(props.draft);

  function patch(patch: Partial<SnapshotDownloadDraft>) {
    props.onDraftChange({ ...props.draft, ...patch });
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={t('dataset.download.modal_title')}>
      <div className="space-y-4" data-testid="dataset.downloads.create.modal">
        <div className="text-sm text-muted">{t('dataset.downloads.create.help')}</div>
        <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
          {t('dataset.downloads.create.scope', { dataset: props.datasetLabel })}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.snapshot')}</div>
          <Select
            value={props.draft.snapshotId}
            onChange={(e) => patch({ snapshotId: e.target.value, fromSnapshotId: '' })}
            testId="dataset.downloads.create.snapshot"
          >
            <option value="">{t('dataset.download.snapshot.placeholder')}</option>
            {props.snapshots.map((snapshot) => (
              <option key={snapshot.id} value={String(snapshot.id)}>
                {snapshotLabel(snapshot)} (#{snapshot.id})
              </option>
            ))}
          </Select>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-faint">{t('dataset.download.snapshot.help')}</div>
            <Button
              size="sm"
              variant="secondary"
              onClick={props.loadMoreSnapshots}
              disabled={props.candidatesBusy || !props.candidatesHasMore}
              testId="dataset.downloads.create.load_more"
            >
              {props.candidatesBusy
                ? t('common.loading')
                : props.candidatesHasMore
                  ? t('dataset.download.load_older')
                  : t('dataset.download.no_more')}
            </Button>
          </div>
          {props.candidatesError ? (
            <div className="mt-2">
              <Alert title={t('dataset.download.candidates.error.title')} variant="danger">
                {props.candidatesError}
              </Alert>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.format')}</div>
          <Select
            value={props.draft.format}
            onChange={(e) => patch({ format: e.target.value as SnapshotDownloadFormat, fromSnapshotId: '' })}
            testId="dataset.downloads.create.format"
          >
            <option value="archive">{t('dataset.download.format.archive')}</option>
            <option value="stream">{t('dataset.download.format.stream')}</option>
            <option value="incremental_stream">{t('dataset.download.format.incremental_stream')}</option>
          </Select>
        </div>

        {props.draft.format === 'incremental_stream' ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted">{t('dataset.download.field.from_snapshot')}</div>
            <Select
              value={props.draft.fromSnapshotId}
              onChange={(e) => patch({ fromSnapshotId: e.target.value })}
              testId="dataset.downloads.create.from_snapshot"
            >
              <option value="">{t('dataset.download.from_snapshot.none')}</option>
              {props.fromCandidates.map((snapshot) => (
                <option key={snapshot.id} value={String(snapshot.id)}>
                  {snapshotLabel(snapshot)} (#{snapshot.id})
                </option>
              ))}
            </Select>
            <div className="mt-1 text-xs text-faint">{t('dataset.download.from_snapshot.help')}</div>
          </div>
        ) : null}

        <Checkbox
          checked={props.draft.sendMail}
          onChange={(checked) => patch({ sendMail: checked })}
          label={t('dataset.download.send_mail.label')}
          testId="dataset.downloads.create.send_mail"
        />

        <CreateDownloadReview
          draft={props.draft}
          snapshots={props.snapshots}
          fromCandidates={props.fromCandidates}
          datasetLabel={props.datasetLabel}
        />

        {props.createError ? (
          <Alert title={t('dataset.download.create.error.title')} variant="danger">
            {formatErrorMessage(props.createError)}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} testId="dataset.downloads.create.cancel">
            {t('common.cancel')}
          </Button>
          <ActionButton
            onClick={props.onSubmit}
            loading={props.createPending}
            disabled={!validation.ok || !props.createGate.allowed}
            disabledReason={!props.createGate.allowed ? props.createGate.reason : undefined}
            testId="dataset.downloads.create.submit"
          >
            {props.createPending ? t('common.creating') : t('dataset.download.create_link')}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}

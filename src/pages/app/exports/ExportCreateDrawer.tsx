import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DatasetLookupInput } from '../../../components/ui/DatasetLookupInput';
import { HostIpLookupInput } from '../../../components/ui/HostIpLookupInput';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { Dataset, Snapshot } from '../../../lib/api/datasets';
import {
  resourceLabel,
  type CreateExportFormState,
  type ExportCreateIssue,
  validateCreateExportForm,
} from './ExportModel';

function selectedSnapshotLabel(snapshots: Snapshot[], idValue: string): string {
  const id = Number(idValue);
  if (!Number.isFinite(id) || id <= 0) return '—';
  const snapshot = snapshots.find((item) => Number(item.id) === id);
  return snapshot ? `${resourceLabel(snapshot)} (#${snapshot.id})` : `#${id}`;
}

function boolLabel(value: boolean, t: (k: string) => string): string {
  return value ? t('common.enabled') : t('common.disabled');
}

function issueLabel(issue: ExportCreateIssue, t: (k: string) => string): string {
  switch (issue) {
    case 'dataset_required':
      return t('exports.validation.dataset_required');
    case 'snapshot_required':
      return t('exports.validation.snapshot_required');
    case 'host_required':
      return t('exports.validation.host_required');
    case 'threads_invalid':
      return t('exports.validation.threads_invalid');
  }
}

function ExportCreateReview(props: {
  form: CreateExportFormState;
  dataset: Dataset | undefined;
  snapshots: Snapshot[];
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const form = props.form;
  const validation = validateCreateExportForm(form, props.isAdmin);
  const sourceLabel = form.sourceType === 'snapshot'
    ? selectedSnapshotLabel(props.snapshots, form.snapshotId)
    : props.dataset
      ? resourceLabel(props.dataset)
      : form.datasetId
        ? `#${form.datasetId}`
        : '—';

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid="exports.create.review">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t('exports.review.title')}</div>
        <div className="mt-1 text-muted">{t('exports.review.create_intro')}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs text-faint">{t('exports.field.source')}</div>
          <div className="font-medium text-fg">{sourceLabel}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('exports.field.address')}</div>
          <div className="font-medium text-fg">{form.hostIpId ? `#${form.hostIpId}` : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('exports.field.scope')}</div>
          <div className="font-medium text-fg">{form.allVps ? t('exports.field.all_vps') : t('exports.field.selected_hosts')}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('exports.field.mode')}</div>
          <div className="font-medium text-fg">{form.rw ? t('exports.mode.rw') : t('exports.mode.ro')}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('common.state')}</div>
          <div className="font-medium text-fg">{boolLabel(form.enabled, t)}</div>
        </div>
        {props.isAdmin ? (
          <div>
            <div className="text-xs text-faint">{t('exports.field.threads')}</div>
            <div className="font-medium text-fg">{form.threads || '—'}</div>
          </div>
        ) : null}
      </div>

      {validation.issues.length > 0 ? (
        <Alert title={t('exports.validation.title')} variant="warn">
          <ul className="list-disc space-y-1 pl-5">
            {validation.issues.map((issue) => <li key={issue}>{issueLabel(issue, t)}</li>)}
          </ul>
        </Alert>
      ) : null}

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>{form.sourceType === 'snapshot' ? t('exports.review.snapshot_temporary') : t('exports.review.dataset_persistent')}</li>
        <li>{form.rw ? t('exports.review.rw') : t('exports.review.ro')}</li>
        <li>{form.allVps ? t('exports.review.all_vps') : t('exports.review.selected_hosts')}</li>
        <li>{form.rootSquash ? t('exports.review.root_squash_on') : t('exports.review.root_squash_off')}</li>
      </ul>
    </div>
  );
}

export function ExportCreateDrawer(props: {
  open: boolean;
  onClose: () => void;
  embedded: boolean;
  fixedDatasetId?: number;
  form: CreateExportFormState;
  onFormChange: (form: CreateExportFormState) => void;
  selectedDataset: Dataset | undefined;
  snapshots: Snapshot[];
  selectedDatasetOwnerId?: number;
  isAdmin: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const validation = validateCreateExportForm(props.form, props.isAdmin);

  function patch(patch: Partial<CreateExportFormState>) {
    props.onFormChange({ ...props.form, ...patch });
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t('exports.create.title')}
      size="lg"
      testId={props.embedded ? 'dataset.exports.create' : 'exports.create'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!validation.ok || props.pending}
            loading={props.pending}
            onClick={props.onSubmit}
            testId="exports.create.submit"
          >
            {props.pending ? t('common.working') : t('exports.create.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {props.fixedDatasetId === undefined ? (
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('common.dataset')}</div>
            <DatasetLookupInput
              value={props.form.datasetId}
              onChange={(value) => patch({ datasetId: value, snapshotId: '' })}
              testId="exports.create.dataset"
              ariaLabel={t('common.dataset')}
              placeholder={t('exports.form.dataset.placeholder')}
            />
          </div>
        ) : (
          <Card>
            <CardBody>
              <div className="text-sm text-muted">{props.selectedDataset ? resourceLabel(props.selectedDataset) : `#${props.fixedDatasetId}`}</div>
            </CardBody>
          </Card>
        )}

        <div>
          <div className="mb-1 text-sm font-medium text-fg">{t('exports.form.source')}</div>
          <Select
            value={props.form.sourceType}
            onChange={(e) => patch({ sourceType: e.target.value as 'dataset' | 'snapshot', snapshotId: '' })}
            ariaLabel={t('exports.form.source')}
          >
            <option value="dataset">{t('exports.form.source.dataset')}</option>
            <option value="snapshot">{t('exports.form.source.snapshot')}</option>
          </Select>
        </div>

        {props.form.sourceType === 'snapshot' ? (
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('common.snapshot')}</div>
            <Select
              value={props.form.snapshotId}
              onChange={(e) => patch({ snapshotId: e.target.value })}
              disabled={!props.form.datasetId}
              ariaLabel={t('common.snapshot')}
            >
              <option value="">{t('exports.form.snapshot.placeholder')}</option>
              {props.snapshots.map((snapshot) => (
                <option key={snapshot.id} value={String(snapshot.id)}>{resourceLabel(snapshot)}</option>
              ))}
            </Select>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.address')}</div>
          <HostIpLookupInput
            value={props.form.hostIpId}
            onChange={(value) => patch({ hostIpId: value })}
            userId={props.selectedDatasetOwnerId}
            testId="exports.create.host_ip"
            ariaLabel={t('exports.field.address')}
            placeholder={t('exports.form.address.placeholder')}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox checked={props.form.allVps} onChange={(value) => patch({ allVps: value })} label={t('exports.field.all_vps')} />
          <Checkbox checked={props.form.enabled} onChange={(value) => patch({ enabled: value })} label={t('common.enabled')} />
          <Checkbox checked={props.form.rw} onChange={(value) => patch({ rw: value })} label={t('exports.field.rw')} />
          <Checkbox checked={props.form.sync} onChange={(value) => patch({ sync: value })} label={t('exports.field.sync')} />
          <Checkbox checked={props.form.subtreeCheck} onChange={(value) => patch({ subtreeCheck: value })} label={t('exports.field.subtree_check')} />
          <Checkbox checked={props.form.rootSquash} onChange={(value) => patch({ rootSquash: value })} label={t('exports.field.root_squash')} />
        </div>

        {props.isAdmin ? (
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.threads')}</div>
            <Input value={props.form.threads} onChange={(e) => patch({ threads: e.target.value })} ariaLabel={t('exports.field.threads')} />
          </div>
        ) : null}

        <ExportCreateReview
          form={props.form}
          dataset={props.selectedDataset}
          snapshots={props.snapshots}
          isAdmin={props.isAdmin}
        />

      </div>
    </Modal>
  );
}

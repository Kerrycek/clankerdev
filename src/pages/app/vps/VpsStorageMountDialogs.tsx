import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { Dataset, VpsMount } from '../../../lib/api/vpsMounts';
import type { GateDecision } from '../../../lib/gates/types';
import {
  buildMountDiff,
  datasetLabel,
  type MountDiffField,
  type MountDiffItem,
  type MountDraft,
  type MountStartFail,
} from './VpsStorageModel';

export interface StartFailOption {
  value: MountStartFail;
  label: string;
  desc: string;
}

type DraftPatch = Partial<MountDraft>;

function boolLabel(t: ReturnType<typeof useI18n>['t'], value: boolean): string {
  return value ? t('common.yes') : t('common.no');
}

function diffFieldLabel(t: ReturnType<typeof useI18n>['t'], field: MountDiffField): string {
  switch (field) {
    case 'mountpoint':
      return t('vps.storage.review.field.mountpoint');
    case 'type':
      return t('vps.storage.review.field.type');
    case 'mode':
      return t('vps.storage.review.field.mode');
    case 'on_start_fail':
      return t('vps.storage.review.field.on_start_fail');
    case 'enabled':
      return t('vps.storage.review.field.enabled');
    case 'master_enabled':
      return t('vps.storage.review.field.master_enabled');
    case 'use_default_map':
      return t('vps.storage.review.field.use_default_map');
  }
}

function valueLabel(t: ReturnType<typeof useI18n>['t'], value: string | boolean): string {
  if (typeof value === 'boolean') return boolLabel(t, value);
  if (value === 'rw') return t('vps.storage.mode.rw');
  if (value === 'ro') return t('vps.storage.mode.ro');
  if (value === 'nfs') return t('vps.storage.type.nfs');
  if (value === 'bind') return t('vps.storage.type.bind');
  if (value === 'ignore') return t('vps.storage.on_start_fail.ignore.label');
  if (value === 'umount') return t('vps.storage.on_start_fail.umount.label');
  if (value === 'fail') return t('vps.storage.on_start_fail.fail.label');
  return value || '—';
}

function MountReviewPanel(props: { draft: MountDraft; canAdmin: boolean; operation: 'create' | 'edit'; diff?: MountDiffItem[] }) {
  const { t } = useI18n();
  const draft = props.draft;
  const startRiskKey = draft.onStartFail === 'fail' ? 'vps.storage.review.risk.start_fail_fail' : 'vps.storage.review.risk.start_fail_soft';
  const modeRiskKey = draft.mode === 'rw' ? 'vps.storage.review.risk.mode_rw' : 'vps.storage.review.risk.mode_ro';

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid={`vps.storage.${props.operation}.review`}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t('vps.storage.review.title')}</div>
        <div className="mt-1 text-muted">
          {props.operation === 'create' ? t('vps.storage.review.create_intro') : t('vps.storage.review.edit_intro')}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs text-faint">{t('vps.storage.review.field.dataset')}</div>
          <div className="font-medium">{datasetLabel(draft.dataset)}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('vps.storage.review.field.mountpoint')}</div>
          <div className="font-medium">{draft.mountpoint.trim() || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('vps.storage.review.field.access')}</div>
          <div className="font-medium">
            {valueLabel(t, draft.type)} · {valueLabel(t, draft.mode)}
          </div>
        </div>
        <div>
          <div className="text-xs text-faint">{t('vps.storage.review.field.on_start_fail')}</div>
          <div className="font-medium">{valueLabel(t, draft.onStartFail)}</div>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>{t(modeRiskKey)}</li>
        <li>{t(startRiskKey)}</li>
        <li>{draft.enabled ? t('vps.storage.review.risk.enabled') : t('vps.storage.review.risk.disabled')}</li>
        <li>{draft.useDefaultMap ? t('vps.storage.review.risk.default_map') : t('vps.storage.review.risk.custom_map')}</li>
        {props.canAdmin ? <li>{draft.masterEnabled ? t('vps.storage.review.risk.master_enabled') : t('vps.storage.review.risk.master_disabled')}</li> : null}
      </ul>

      {props.diff && props.diff.length > 0 ? (
        <div className="rounded-md border border-border bg-surface p-2 text-xs" data-testid="vps.storage.edit.diff">
          <div className="mb-1 font-medium text-fg">{t('vps.storage.review.changed_fields')}</div>
          <div className="space-y-1">
            {props.diff.map((item) => (
              <div key={item.field} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr]">
                <div className="text-muted">{diffFieldLabel(t, item.field)}</div>
                <div>{valueLabel(t, item.before)}</div>
                <div className="font-medium">{valueLabel(t, item.after)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MountFormFields(props: {
  mode: 'create' | 'edit';
  draft: MountDraft;
  canAdmin: boolean;
  startFailOptions: StartFailOption[];
  datasetName?: string;
  foundDataset?: Dataset | null;
  findError?: string | null;
  findLoading?: boolean;
  onFindDataset?: () => void;
  onDatasetNameChange?: (value: string) => void;
  onDraftPatch: (patch: DraftPatch) => void;
}) {
  const { t } = useI18n();
  const draft = props.draft;

  return (
    <div className="space-y-4">
      {props.mode === 'create' ? (
        <div>
          <div className="text-xs font-medium text-muted">{t('vps.storage.dataset_find.label')}</div>
          <div className="mt-1 flex items-center gap-2">
            <Input
              testId="vps.storage.mounts.create.dataset"
              value={props.datasetName ?? ''}
              onChange={(e) => props.onDatasetNameChange?.(e.target.value)}
              placeholder={t('vps.storage.dataset_find.placeholder')}
              autoComplete="off"
            />
            <Button
              variant="secondary"
              size="sm"
              testId="vps.storage.mounts.create.find_dataset"
              onClick={props.onFindDataset}
              loading={props.findLoading}
            >
              {t('common.find')}
            </Button>
          </div>
          {props.findError ? <div className="mt-1 text-xs text-danger">{props.findError}</div> : null}
          {props.foundDataset ? (
            <div className="mt-2 rounded-md border border-border bg-surface-2 p-2 text-sm">
              <div className="font-medium">{datasetLabel(props.foundDataset)}</div>
              <div className="mt-0.5 text-xs text-muted">#{props.foundDataset.id}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface-2 p-2 text-sm">
          <div className="font-medium">{datasetLabel(draft.dataset)}</div>
          <div className="mt-0.5 text-xs text-muted">{t('vps.storage.edit.dataset_locked')}</div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-muted">{t(`vps.storage.${props.mode}.field.mountpoint`)}</div>
        <div className="mt-1">
          <Input
            testId={`vps.storage.mounts.${props.mode}.mountpoint`}
            value={draft.mountpoint}
            onChange={(e) => props.onDraftPatch({ mountpoint: e.target.value })}
            placeholder="/mnt/data"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-muted">{t(`vps.storage.${props.mode}.field.type`)}</div>
          <div className="mt-1">
            <Select
              testId={`vps.storage.mounts.${props.mode}.type`}
              value={draft.type}
              onChange={(e) => props.onDraftPatch({ type: e.target.value === 'bind' ? 'bind' : 'nfs' })}
              options={[
                { value: 'nfs', label: t('vps.storage.type.nfs') },
                { value: 'bind', label: t('vps.storage.type.bind') },
              ]}
            />
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted">{t(`vps.storage.${props.mode}.field.mode`)}</div>
          <div className="mt-1">
            <Select
              testId={`vps.storage.mounts.${props.mode}.mode`}
              value={draft.mode}
              onChange={(e) => props.onDraftPatch({ mode: e.target.value === 'ro' ? 'ro' : 'rw' })}
              options={[
                { value: 'rw', label: t('vps.storage.mode.rw') },
                { value: 'ro', label: t('vps.storage.mode.ro') },
              ]}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted">{t(`vps.storage.${props.mode}.field.on_start_fail`)}</div>
        <div className="mt-1">
          <Select
            testId={`vps.storage.mounts.${props.mode}.on_start_fail`}
            value={draft.onStartFail}
            onChange={(e) => props.onDraftPatch({ onStartFail: e.target.value === 'umount' || e.target.value === 'fail' ? e.target.value : 'ignore' })}
            options={props.startFailOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
        <div className="mt-1 text-xs text-muted">{props.startFailOptions.find((option) => option.value === draft.onStartFail)?.desc}</div>
      </div>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            data-testid={`vps.storage.mounts.${props.mode}.enabled`}
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => props.onDraftPatch({ enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
          />
          <span>{t(`vps.storage.${props.mode}.field.enabled`)}</span>
        </label>

        {props.canAdmin ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid={`vps.storage.mounts.${props.mode}.master_enabled`}
              type="checkbox"
              checked={draft.masterEnabled}
              onChange={(e) => props.onDraftPatch({ masterEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
            />
            <span>{t(`vps.storage.${props.mode}.field.master_enabled`)}</span>
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            data-testid={`vps.storage.mounts.${props.mode}.use_default_map`}
            type="checkbox"
            checked={draft.useDefaultMap}
            onChange={(e) => props.onDraftPatch({ useDefaultMap: e.target.checked })}
            className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
          />
          <span>{t(`vps.storage.${props.mode}.field.use_default_map`)}</span>
        </label>
      </div>
    </div>
  );
}

export function VpsStorageMountCreateModal(props: {
  open: boolean;
  draft: MountDraft;
  canAdmin: boolean;
  gate: GateDecision;
  datasetName: string;
  foundDataset: Dataset | null;
  findError: string | null;
  createError: string | null;
  findLoading: boolean;
  createLoading: boolean;
  canSubmit: boolean;
  startFailOptions: StartFailOption[];
  onClose: () => void;
  onFindDataset: () => void;
  onDatasetNameChange: (value: string) => void;
  onDraftPatch: (patch: DraftPatch) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={props.open}
      testId="vps.storage.mounts.create"
      title={t('vps.storage.create.title')}
      onClose={props.onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" testId="vps.storage.mounts.create.cancel" onClick={props.onClose} disabled={props.createLoading}>
            {t('common.cancel')}
          </Button>
          <ActionButton
            testId="vps.storage.mounts.create.submit"
            disabled={!props.canSubmit || !props.gate.allowed}
            disabledReason={!props.gate.allowed ? props.gate.reason : undefined}
            loading={props.createLoading}
            onClick={props.onSubmit}
          >
            {t('common.create')}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        {props.createError ? (
          <Alert title={t('vps.storage.create.error.title')} variant="danger">
            {props.createError}
          </Alert>
        ) : null}
        <MountFormFields {...props} mode="create" />
        <MountReviewPanel draft={props.draft} canAdmin={props.canAdmin} operation="create" />
      </div>
    </Modal>
  );
}

export function VpsStorageMountEditModal(props: {
  open: boolean;
  draft: MountDraft;
  mount: VpsMount | null;
  canAdmin: boolean;
  gate: GateDecision;
  editError: string | null;
  editLoading: boolean;
  canSubmit: boolean;
  startFailOptions: StartFailOption[];
  onClose: () => void;
  onDraftPatch: (patch: DraftPatch) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const diff = props.mount ? buildMountDiff(props.draft, props.mount, props.canAdmin) : [];

  return (
    <Modal
      open={props.open}
      testId="vps.storage.mounts.edit"
      title={t('vps.storage.edit.title')}
      onClose={props.onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" testId="vps.storage.mounts.edit.cancel" onClick={props.onClose} disabled={props.editLoading}>
            {t('common.cancel')}
          </Button>
          <ActionButton
            testId="vps.storage.mounts.edit.submit"
            disabled={!props.canSubmit || !props.gate.allowed}
            disabledReason={!props.gate.allowed ? props.gate.reason : undefined}
            loading={props.editLoading}
            onClick={props.onSubmit}
          >
            {t('common.save')}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        {props.editError ? (
          <Alert title={t('vps.storage.edit.error.title')} variant="danger">
            {props.editError}
          </Alert>
        ) : null}
        <MountFormFields {...props} mode="edit" />
        <MountReviewPanel draft={props.draft} canAdmin={props.canAdmin} operation="edit" diff={diff} />
      </div>
    </Modal>
  );
}

export function VpsStorageMountDeleteDialog(props: {
  open: boolean;
  target: VpsMount | null;
  gate: GateDecision;
  error: string | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      testId="vps.storage.mounts.delete_confirm"
      open={props.open}
      title={t('vps.storage.delete.title')}
      description={t('vps.storage.delete.description')}
      danger
      confirmLabel={t('common.delete')}
      confirmLoading={props.loading}
      confirmDisabled={!props.gate.allowed}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    >
      {props.error ? (
        <Alert title={t('vps.storage.delete.error.title')} variant="danger">
          {props.error}
        </Alert>
      ) : props.target ? (
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium">{String(props.target.mountpoint ?? '—')}</div>
            <div className="mt-0.5 text-xs text-muted">{datasetLabel(props.target.dataset)}</div>
          </div>
          <div className="rounded-md border border-warn-border bg-warn-bg p-3 text-xs text-warn">
            {t('vps.storage.delete.impact')}
          </div>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

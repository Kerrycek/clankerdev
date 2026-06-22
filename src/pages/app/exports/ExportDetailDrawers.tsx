import React, { type Dispatch, type SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Drawer } from '../../../components/ui/Drawer';
import { Input } from '../../../components/ui/Input';
import { IpAddressLookupInput } from '../../../components/ui/IpAddressLookupInput';
import type { ExportHost } from '../../../lib/api/exports';
import {
  hostLabel,
  type EditExportFormState,
  type ExportDiffField,
  type ExportDiffItem,
  type ExportHostDiffField,
  type ExportHostDiffItem,
} from './ExportModel';

export type ExportHostFormState = {
  ip_address: number | null;
  rw: boolean;
  sync: boolean;
  subtree_check: boolean;
  root_squash: boolean;
};

function exportFieldLabel(field: ExportDiffField, t: (key: string) => string): string {
  switch (field) {
    case 'enabled': return t('common.enabled');
    case 'all_vps': return t('exports.field.all_vps');
    case 'rw': return t('exports.field.rw');
    case 'sync': return t('exports.field.sync');
    case 'subtree_check': return t('exports.field.subtree_check');
    case 'root_squash': return t('exports.field.root_squash');
    case 'threads': return t('exports.field.threads');
  }
}

function hostFieldLabel(field: ExportHostDiffField, t: (key: string) => string): string {
  switch (field) {
    case 'rw': return t('exports.field.rw');
    case 'sync': return t('exports.field.sync');
    case 'subtree_check': return t('exports.field.subtree_check');
    case 'root_squash': return t('exports.field.root_squash');
  }
}

function optionValueLabel(field: ExportDiffField | ExportHostDiffField, value: boolean | number | string, t: (key: string) => string): string {
  if (field === 'rw') return value ? t('exports.mode.rw') : t('exports.mode.ro');
  if (typeof value === 'boolean') return value ? t('common.enabled') : t('common.disabled');
  return String(value);
}

function ExportEditReview(props: { diff: ExportDiffItem[]; invalidThreads: boolean }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid="exports.edit.review">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t('exports.review.edit_title')}</div>
        <div className="mt-1 text-muted">{t('exports.review.edit_intro')}</div>
      </div>

      {props.invalidThreads ? (
        <Alert title={t('exports.validation.title')} variant="warn">
          {t('exports.validation.threads_invalid')}
        </Alert>
      ) : null}

      {props.diff.length > 0 ? (
        <ul className="space-y-2">
          {props.diff.map((item) => (
            <li key={item.field} className="rounded-md border border-border bg-surface p-2">
              <div className="text-xs font-medium text-muted">{exportFieldLabel(item.field, t)}</div>
              <div className="mt-1 text-xs text-fg">
                {optionValueLabel(item.field, item.before, t)} → {optionValueLabel(item.field, item.after, t)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-muted">{t('exports.review.no_changes')}</div>
      )}
    </div>
  );
}

function HostEditReview(props: { editingHost: ExportHost | null; form: ExportHostFormState; diff: ExportHostDiffItem[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3 text-sm" data-testid="exports.host.review">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          {props.editingHost ? t('exports.host.review.edit_title') : t('exports.host.review.create_title')}
        </div>
        <div className="mt-1 text-muted">
          {props.editingHost ? t('exports.host.review.edit_intro') : t('exports.host.review.create_intro')}
        </div>
      </div>

      {!props.editingHost ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs text-faint">{t('exports.detail.hosts.address')}</div>
            <div className="font-medium text-fg">{props.form.ip_address ? `#${props.form.ip_address}` : t('exports.form.address.placeholder')}</div>
          </div>
          <div>
            <div className="text-xs text-faint">{t('exports.field.mode')}</div>
            <div className="font-medium text-fg">{props.form.rw ? t('exports.mode.rw') : t('exports.mode.ro')}</div>
          </div>
        </div>
      ) : props.diff.length > 0 ? (
        <ul className="space-y-2">
          {props.diff.map((item) => (
            <li key={item.field} className="rounded-md border border-border bg-surface p-2">
              <div className="text-xs font-medium text-muted">{hostFieldLabel(item.field, t)}</div>
              <div className="mt-1 text-xs text-fg">
                {optionValueLabel(item.field, item.before, t)} → {optionValueLabel(item.field, item.after, t)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-muted">{t('exports.review.no_changes')}</div>
      )}
    </div>
  );
}

export function ExportEditDrawer(props: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  form: EditExportFormState;
  setForm: Dispatch<SetStateAction<EditExportFormState>>;
  diff: ExportDiffItem[];
  invalidThreads: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <Drawer open={props.open} onClose={props.onClose} title={t('exports.update.title')} width="lg" testId="exports.detail.edit.drawer">
      <div className="space-y-4">
        <Checkbox checked={props.form.enabled} onChange={(checked) => props.setForm((prev) => ({ ...prev, enabled: checked }))} testId="exports.edit.enabled">{t('common.enabled')}</Checkbox>
        <Checkbox checked={props.form.all_vps} onChange={(checked) => props.setForm((prev) => ({ ...prev, all_vps: checked }))} testId="exports.edit.all_vps">{t('exports.field.all_vps')}</Checkbox>
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox checked={props.form.rw} onChange={(checked) => props.setForm((prev) => ({ ...prev, rw: checked }))} testId="exports.edit.rw">{t('exports.field.rw')}</Checkbox>
          <Checkbox checked={props.form.sync} onChange={(checked) => props.setForm((prev) => ({ ...prev, sync: checked }))} testId="exports.edit.sync">{t('exports.field.sync')}</Checkbox>
          <Checkbox checked={props.form.subtree_check} onChange={(checked) => props.setForm((prev) => ({ ...prev, subtree_check: checked }))} testId="exports.edit.subtree_check">{t('exports.field.subtree_check')}</Checkbox>
          <Checkbox checked={props.form.root_squash} onChange={(checked) => props.setForm((prev) => ({ ...prev, root_squash: checked }))} testId="exports.edit.root_squash">{t('exports.field.root_squash')}</Checkbox>
        </div>
        {props.isAdmin ? (
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.threads')}</div>
            <Input value={props.form.threads} onChange={(e) => props.setForm((prev) => ({ ...prev, threads: e.target.value }))} testId="exports.edit.threads" ariaLabel={t('exports.field.threads')} />
          </div>
        ) : null}
        <ExportEditReview diff={props.diff} invalidThreads={props.invalidThreads} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            loading={props.pending}
            disabled={props.invalidThreads || props.diff.length === 0 || props.pending}
            onClick={props.onSubmit}
            testId="exports.edit.submit"
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

export function ExportHostEditorDrawer(props: {
  open: boolean;
  onClose: () => void;
  editingHost: ExportHost | null;
  form: ExportHostFormState;
  setForm: Dispatch<SetStateAction<ExportHostFormState>>;
  userId?: number;
  allVps: boolean;
  diff: ExportHostDiffItem[];
  pending: boolean;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <Drawer open={props.open} onClose={props.onClose} title={props.editingHost ? t('exports.host.edit_title') : t('exports.host.add_title')} width="lg" testId="exports.detail.host.editor">
      <div className="space-y-4">
        {!props.editingHost ? (
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('exports.detail.hosts.address')}</div>
            <IpAddressLookupInput value={props.form.ip_address} onChange={(v) => props.setForm((prev) => ({ ...prev, ip_address: v }))} userId={props.userId} placeholder={t('exports.host.address.placeholder')} ariaLabel={t('exports.detail.hosts.address')} testId="exports.host.ip_address" disabled={props.allVps} />
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-muted">{t('exports.detail.hosts.address')}</div>
            <div className="mt-1 font-mono text-xs text-fg">{hostLabel(props.editingHost)}</div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox checked={props.form.rw} onChange={(checked) => props.setForm((prev) => ({ ...prev, rw: checked }))} testId="exports.host.rw">{t('exports.field.rw')}</Checkbox>
          <Checkbox checked={props.form.sync} onChange={(checked) => props.setForm((prev) => ({ ...prev, sync: checked }))} testId="exports.host.sync">{t('exports.field.sync')}</Checkbox>
          <Checkbox checked={props.form.subtree_check} onChange={(checked) => props.setForm((prev) => ({ ...prev, subtree_check: checked }))} testId="exports.host.subtree_check">{t('exports.field.subtree_check')}</Checkbox>
          <Checkbox checked={props.form.root_squash} onChange={(checked) => props.setForm((prev) => ({ ...prev, root_squash: checked }))} testId="exports.host.root_squash">{t('exports.field.root_squash')}</Checkbox>
        </div>
        <HostEditReview editingHost={props.editingHost} form={props.form} diff={props.diff} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            loading={props.pending}
            onClick={props.onSubmit}
            disabled={(!props.editingHost && !props.form.ip_address) || (Boolean(props.editingHost) && props.diff.length === 0) || props.pending}
            testId="exports.host.submit"
          >
            {props.editingHost ? t('common.save') : t('exports.host.add')}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

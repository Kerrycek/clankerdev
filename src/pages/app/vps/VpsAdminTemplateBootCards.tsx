import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { OsTemplate } from '../../../lib/api/osTemplates';
import type { GateDecision } from '../../../lib/gates/types';
import {
  adminConfirmTarget,
  isAdminConfirmSatisfied,
  type BootForm,
  type TemplateForm,
} from './VpsAdminLifecycleModel';
import type { Vps } from '../../../lib/api/vps';
import {
  ActionGateAlert,
  ActionImpactSummary,
  AsyncActionResult,
  DangerTypedConfirm,
  Field,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
} from './VpsLifecyclePrimitives';
import { vpsLabel } from './VpsLifecycleModel';

export type { BootForm, TemplateForm } from './VpsAdminLifecycleModel';

function templateLabel(tpl: OsTemplate): string {
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`);
}

function findTemplate(templates: OsTemplate[], rawId: string): OsTemplate | undefined {
  const id = Number(rawId.trim());
  return Number.isInteger(id) ? templates.find((tpl) => Number(tpl.id) === id) : undefined;
}

function templateDisplay(templates: OsTemplate[], rawId: string, empty: string): string {
  const selected = findTemplate(templates, rawId);
  if (selected) return templateLabel(selected);
  return rawId.trim() ? `#${rawId.trim()}` : empty;
}

export function VpsAdminTemplateCard(props: {
  vps: Vps;
  form: TemplateForm;
  onChange: Dispatch<SetStateAction<TemplateForm>>;
  templates: OsTemplate[];
  templatesLoading: boolean;
  gate: GateDecision;
  pending: boolean;
  succeeded: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const confirmTarget = adminConfirmTarget(props.vps);
  const confirmSatisfied = isAdminConfirmSatisfied(props.form.confirmText, confirmTarget);
  const currentTemplate = templateDisplay(props.templates, String(props.vps.os_template?.id ?? ''), t('common.none'));
  const selectedTemplate = templateDisplay(props.templates, props.form.osTemplate, t('vps.lifecycle.placeholder.os_template'));

  const setForm = (patch: Partial<TemplateForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.template"
      footer={
        <LifecycleSubmitButton
          variant="primary"
          testId="vps.lifecycle.template.submit"
          disabled={!confirmSatisfied || !props.form.osTemplate}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.template.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="neutral">{t('vps.lifecycle.template.review.help')}</Alert>
      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.template.os_template_help')}>
          <Select
            value={props.form.osTemplate}
            onChange={(e) => setForm({ osTemplate: e.target.value, confirmText: '' })}
            disabled={props.pending || props.templatesLoading}
            testId="vps.lifecycle.template.os_template"
          >
            <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
            {props.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {templateLabel(tpl)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Checkbox
            checked={props.form.autoUpdate}
            onChange={(autoUpdate) => setForm({ autoUpdate, confirmText: '' })}
            label={t('vps.lifecycle.template.auto_update')}
            description={t('vps.lifecycle.template.auto_update_help')}
            testId="vps.lifecycle.template.auto_update"
          />
        </div>
      </div>

      <ActionImpactSummary testId="vps.lifecycle.template.review">
        <ImpactItem label={t('vps.lifecycle.admin_review.target')} testId="vps.lifecycle.template.review.target">
          {vpsLabel(props.vps, props.vps.id)}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.template.review.change')} testId="vps.lifecycle.template.review.change">
          {t('vps.lifecycle.template.review.change_body', { current: currentTemplate, next: selectedTemplate })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.template.review.payload')} testId="vps.lifecycle.template.review.payload">
          {t('vps.lifecycle.template.review.payload_body', {
            autoUpdate: props.form.autoUpdate ? t('common.yes') : t('common.no'),
          })}
        </ImpactItem>
      </ActionImpactSummary>

      <DangerTypedConfirm
        label={t('vps.lifecycle.admin_confirm.label')}
        help={t('vps.lifecycle.admin_confirm.help', { target: confirmTarget })}
        target={confirmTarget}
        value={props.form.confirmText}
        onChange={(confirmText) => setForm({ confirmText })}
        disabled={props.pending}
        testId="vps.lifecycle.template.confirm"
        satisfied={confirmSatisfied}
        mismatchTitle={t('vps.lifecycle.admin_confirm.mismatch_title')}
        mismatchBody={t('vps.lifecycle.admin_confirm.mismatch_body')}
      />

      <AsyncActionResult
        succeeded={props.succeeded}
        successTitle={t('vps.lifecycle.template.success')}
        successBody={t('vps.lifecycle.template.success_body')}
        errorTitle={t('vps.lifecycle.template.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

export function VpsAdminBootCard(props: {
  vps: Vps;
  form: BootForm;
  onChange: Dispatch<SetStateAction<BootForm>>;
  templates: OsTemplate[];
  templatesLoading: boolean;
  gate: GateDecision;
  pending: boolean;
  succeeded: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const confirmTarget = adminConfirmTarget(props.vps);
  const confirmSatisfied = isAdminConfirmSatisfied(props.form.confirmText, confirmTarget);
  const selectedTemplate = templateDisplay(props.templates, props.form.osTemplate, t('vps.lifecycle.placeholder.os_template'));

  const setForm = (patch: Partial<BootForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.boot"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.boot.submit"
          disabled={!confirmSatisfied || !props.form.osTemplate}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.boot.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="warn" title={t('vps.lifecycle.boot.warning_title')}>
        {t('vps.lifecycle.boot.warning_body')}
      </Alert>
      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.boot.os_template_help')}>
          <Select
            value={props.form.osTemplate}
            onChange={(e) => setForm({ osTemplate: e.target.value, confirmText: '' })}
            disabled={props.pending || props.templatesLoading}
            testId="vps.lifecycle.boot.os_template"
          >
            <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
            {props.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {templateLabel(tpl)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('vps.lifecycle.boot.mountpoint')} help={t('vps.lifecycle.boot.mountpoint_help')}>
          <Input
            value={props.form.mountpoint}
            onChange={(e) => setForm({ mountpoint: e.target.value, confirmText: '' })}
            disabled={props.pending || !props.form.mountRootDataset}
            testId="vps.lifecycle.boot.mountpoint"
          />
        </Field>
      </div>

      <Checkbox
        checked={props.form.mountRootDataset}
        onChange={(mountRootDataset) => setForm({ mountRootDataset, confirmText: '' })}
        label={t('vps.lifecycle.boot.mount_root_dataset')}
        description={t('vps.lifecycle.boot.mount_root_dataset_help')}
        testId="vps.lifecycle.boot.mount_root_dataset"
      />

      <ActionImpactSummary testId="vps.lifecycle.boot.review">
        <ImpactItem label={t('vps.lifecycle.admin_review.target')} testId="vps.lifecycle.boot.review.target">
          {vpsLabel(props.vps, props.vps.id)}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.boot.review.template')} testId="vps.lifecycle.boot.review.template">
          {selectedTemplate}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.boot.review.mount')} testId="vps.lifecycle.boot.review.mount">
          {props.form.mountRootDataset
            ? t('vps.lifecycle.boot.review.mount_body', { mountpoint: props.form.mountpoint.trim() || '—' })
            : t('vps.lifecycle.boot.review.mount_disabled')}
        </ImpactItem>
      </ActionImpactSummary>

      <DangerTypedConfirm
        label={t('vps.lifecycle.admin_confirm.label')}
        help={t('vps.lifecycle.admin_confirm.help', { target: confirmTarget })}
        target={confirmTarget}
        value={props.form.confirmText}
        onChange={(confirmText) => setForm({ confirmText })}
        disabled={props.pending}
        testId="vps.lifecycle.boot.confirm"
        satisfied={confirmSatisfied}
        mismatchTitle={t('vps.lifecycle.admin_confirm.mismatch_title')}
        mismatchBody={t('vps.lifecycle.admin_confirm.mismatch_body')}
      />

      <AsyncActionResult
        succeeded={props.succeeded}
        successTitle={t('vps.lifecycle.boot.success')}
        successBody={t('vps.lifecycle.boot.success_body')}
        errorTitle={t('vps.lifecycle.boot.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

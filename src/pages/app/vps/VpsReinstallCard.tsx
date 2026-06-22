import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { OsTemplate } from '../../../lib/api/osTemplates';
import type { Vps } from '../../../lib/api/vps';
import { formatMiB } from '../../../lib/format';
import type { GateDecision } from '../../../lib/gates/types';
import {
  ActionImpactSummary,
  AsyncActionResult,
  DangerTypedConfirm,
  Field,
  ImpactItem,
} from './VpsLifecyclePrimitives';
import {
  isVpsReinstallConfirmationSatisfied,
  reinstallUserDataFormats,
  vpsCurrentTemplateLabel,
  vpsReinstallConfirmationTarget,
  vpsReinstallTemplateLabel,
  type ReinstallForm,
  type ReinstallUserDataFormat,
} from './VpsReinstallModel';

function selectedTemplate(form: ReinstallForm, templates: OsTemplate[]): OsTemplate | undefined {
  const id = form.osTemplate.trim();
  if (!id) return undefined;
  return templates.find((tpl) => String(tpl.id) === id);
}

function nodeLabel(vps: Vps): string {
  const node = vps.node;
  if (!node) return '—';
  return String(node.domain_name ?? node.name ?? node.fqdn ?? `#${node.id}`).trim() || `#${node.id}`;
}

function ownerLabel(vps: Vps): string {
  const user = vps.user;
  if (!user) return '—';
  return String(user.login ?? user.full_name ?? `#${user.id}`).trim() || `#${user.id}`;
}

function resourceSummary(vps: Vps): string {
  const cpuRaw = typeof vps.cpu === 'number' ? vps.cpu : vps['cpus'];
  const parts = [
    typeof cpuRaw === 'number' ? `${cpuRaw} vCPU` : null,
    typeof vps.memory === 'number' ? formatMiB(vps.memory) : null,
    typeof vps.swap === 'number' ? `${formatMiB(vps.swap)} swap` : null,
    typeof vps.diskspace === 'number' ? `${formatMiB(vps.diskspace)} disk` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(' / ') : '—';
}

function ipAddressText(ip: IpAddress): string {
  const addr = String(ip.addr ?? '').trim();
  const prefix = typeof ip.prefix === 'number' ? `/${ip.prefix}` : '';
  return addr ? `${addr}${prefix}` : `#${ip.id}`;
}

function IpAddressList(props: { ips: IpAddress[]; loading: boolean; empty: string; loadingText: string }) {
  if (props.loading) return <span className="text-muted">{props.loadingText}</span>;
  if (!props.ips.length) return <span className="text-muted">{props.empty}</span>;

  return (
    <span className="inline-flex flex-col gap-0.5">
      {props.ips.map((ip) => (
        <span key={ip.id} className="font-mono text-xs">
          {ipAddressText(ip)}
        </span>
      ))}
    </span>
  );
}

function userDataFormatLabel(format: ReinstallUserDataFormat): string {
  return `user_data.format.${format}`;
}

export function VpsReinstallCard(props: {
  vps: Vps;
  form: ReinstallForm;
  onChange: React.Dispatch<React.SetStateAction<ReinstallForm>>;
  templates: OsTemplate[];
  templatesLoading: boolean;
  sourceIps: IpAddress[];
  sourceIpsLoading: boolean;
  gate: GateDecision;
  pending: boolean;
  succeeded: boolean;
  errorMessage?: string;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const target = vpsReinstallConfirmationTarget(props.vps);
  const confirmSatisfied = isVpsReinstallConfirmationSatisfied(props.form, target);
  const tpl = selectedTemplate(props.form, props.templates);
  const userDataContent = props.form.userDataContent.trim();
  const userDataMissing = props.form.userDataEnabled && !userDataContent;
  const userDataWillRun = props.form.userDataEnabled && Boolean(userDataContent);
  const selectedTemplateSupportsCloudInit = tpl?.enable_cloud_init === true;
  const disabled = !props.form.osTemplate || !confirmSatisfied || userDataMissing || !props.gate.allowed;

  const setForm = (patch: Partial<ReinstallForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <Card testId="vps.lifecycle.reinstall">
      <CardHeader title={t('vps.lifecycle.reinstall.review.title')} subtitle={t('vps.lifecycle.reinstall.review.subtitle')} />
      <CardBody className="space-y-4">
        <Alert variant="danger" title={t('vps.lifecycle.reinstall.warning_title')}>
          {t('vps.lifecycle.reinstall.warning_body')}
        </Alert>

        <ActionImpactSummary testId="vps.lifecycle.reinstall.impact">
          <ImpactItem label={t('vps.lifecycle.reinstall.impact.changes')} testId="vps.lifecycle.reinstall.impact.changes">
            {t('vps.lifecycle.reinstall.impact.changes_body')}
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.impact.remains')} testId="vps.lifecycle.reinstall.impact.remains">
            {t('vps.lifecycle.reinstall.impact.remains_body')}
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.impact.loss')} testId="vps.lifecycle.reinstall.impact.loss">
            {t('vps.lifecycle.reinstall.impact.loss_body')}
          </ImpactItem>
        </ActionImpactSummary>

        <div className="grid gap-3 md:grid-cols-2">
          <ImpactItem label={t('vps.lifecycle.reinstall.target')} testId="vps.lifecycle.reinstall.target">
            <span className="font-mono text-xs">{target}</span>
            <span className="ml-2 text-xs text-muted">#{props.vps.id}</span>
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.owner_node')} testId="vps.lifecycle.reinstall.owner_node">
            {ownerLabel(props.vps)} / {nodeLabel(props.vps)}
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.current_template')} testId="vps.lifecycle.reinstall.current_template">
            {vpsCurrentTemplateLabel(props.vps)}
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.resources')} testId="vps.lifecycle.reinstall.resources">
            {resourceSummary(props.vps)}
          </ImpactItem>
          <ImpactItem label={t('vps.lifecycle.reinstall.network')} testId="vps.lifecycle.reinstall.network">
            <IpAddressList
              ips={props.sourceIps}
              loading={props.sourceIpsLoading}
              empty={t('vps.lifecycle.reinstall.network_empty')}
              loadingText={t('common.loading')}
            />
          </ImpactItem>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.reinstall.os_template_help')}>
            <Select
              value={props.form.osTemplate}
              onChange={(e) => setForm({ osTemplate: e.target.value, confirmText: '' })}
              disabled={props.pending || props.templatesLoading}
              testId="vps.lifecycle.reinstall.os_template"
            >
              <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {vpsReinstallTemplateLabel(template)}
                </option>
              ))}
            </Select>
          </Field>

          <ImpactItem label={t('vps.lifecycle.reinstall.new_template')} testId="vps.lifecycle.reinstall.new_template">
            {vpsReinstallTemplateLabel(tpl)}
          </ImpactItem>
        </div>

        <Alert variant="neutral" title={t('vps.lifecycle.reinstall.payload.title')} testId="vps.lifecycle.reinstall.payload">
          {t('vps.lifecycle.reinstall.payload.body', {
            userData: userDataWillRun ? t('common.yes') : t('common.no'),
          })}
        </Alert>

        <details className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.reinstall.user_data">
          <summary className="cursor-pointer text-sm font-semibold text-fg" data-testid="vps.lifecycle.reinstall.user_data.summary">
            {t('vps.lifecycle.reinstall.user_data.title')}
          </summary>
          <div className="mt-3 space-y-3">
            <Checkbox
              checked={props.form.userDataEnabled}
              onChange={(checked) => setForm({ userDataEnabled: checked })}
              label={t('vps.lifecycle.reinstall.user_data.enable')}
              description={t('vps.lifecycle.reinstall.user_data.enable_help')}
              disabled={props.pending}
              testId="vps.lifecycle.reinstall.user_data.enable"
            />

            {props.form.userDataEnabled ? (
              <div className="space-y-3">
                <Alert variant={selectedTemplateSupportsCloudInit ? 'info' : 'neutral'} title={t('vps.lifecycle.reinstall.user_data.template_signal_title')}>
                  {selectedTemplateSupportsCloudInit
                    ? t('vps.lifecycle.reinstall.user_data.template_signal_cloud_init')
                    : t('vps.lifecycle.reinstall.user_data.template_signal_unknown')}
                </Alert>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t('vps.lifecycle.reinstall.user_data.format')} help={t('vps.lifecycle.reinstall.user_data.format_help')}>
                    <Select
                      value={props.form.userDataFormat}
                      onChange={(e) => setForm({ userDataFormat: e.target.value as ReinstallUserDataFormat })}
                      disabled={props.pending}
                      testId="vps.lifecycle.reinstall.user_data.format"
                    >
                      {reinstallUserDataFormats.map((format) => (
                        <option key={format} value={format}>
                          {t(userDataFormatLabel(format))}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <ImpactItem label={t('vps.lifecycle.reinstall.user_data.payload')} testId="vps.lifecycle.reinstall.user_data.payload">
                    {t('vps.lifecycle.reinstall.user_data.payload_body')}
                  </ImpactItem>
                </div>

                <Field label={t('vps.lifecycle.reinstall.user_data.content')} help={t('vps.lifecycle.reinstall.user_data.content_help')}>
                  <Textarea
                    value={props.form.userDataContent}
                    onChange={(e) => setForm({ userDataContent: e.target.value })}
                    disabled={props.pending}
                    rows={8}
                    testId="vps.lifecycle.reinstall.user_data.content"
                  />
                </Field>

                {userDataMissing ? (
                  <Alert variant="warn" title={t('vps.lifecycle.reinstall.user_data.empty_title')}>
                    {t('vps.lifecycle.reinstall.user_data.empty_body')}
                  </Alert>
                ) : null}
              </div>
            ) : (
              <Alert variant="neutral">{t('vps.lifecycle.reinstall.user_data.disabled_hint')}</Alert>
            )}
          </div>
        </details>

        <DangerTypedConfirm
          label={t('vps.lifecycle.reinstall.confirm.label')}
          help={t('vps.lifecycle.reinstall.confirm.help', { target })}
          target={target}
          value={props.form.confirmText}
          onChange={(confirmText) => setForm({ confirmText })}
          disabled={props.pending}
          inputClassName="font-mono"
          testId="vps.lifecycle.reinstall.confirm"
          ariaLabel={t('vps.lifecycle.reinstall.confirm.label')}
          satisfied={confirmSatisfied}
          mismatchTitle={t('vps.lifecycle.reinstall.confirm.mismatch_title')}
          mismatchBody={t('vps.lifecycle.reinstall.confirm.mismatch_body')}
        />

        <AsyncActionResult
          succeeded={props.succeeded}
          successTitle={t('vps.lifecycle.reinstall.started_title')}
          successBody={t('vps.lifecycle.reinstall.started_body')}
          errorTitle={t('vps.lifecycle.reinstall.error')}
          errorMessage={props.errorMessage}
        />

        <div className="flex justify-end">
          <ActionButton
            variant="danger"
            testId="vps.lifecycle.reinstall.submit"
            disabled={disabled}
            disabledReason={!props.gate.allowed ? props.gate.reason : undefined}
            loading={props.pending}
            onClick={props.onSubmit}
          >
            {t('vps.lifecycle.reinstall.submit')}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
}

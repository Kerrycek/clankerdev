import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { NodeLookupInput } from '../../../components/ui/NodeLookupInput';
import { VpsMigrationNodePicker } from './VpsMigrationNodePicker';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import type { Node } from '../../../lib/api/nodes';
import type { Vps } from '../../../lib/api/vps';
import { formatDateTime } from '../../../lib/format';
import type { GateDecision } from '../../../lib/gates/types';
import {
  buildMigrateTargetContext,
  findMigrateTargetNode,
  isMigrateReady,
  migrateNodeDisplay,
  nextMigrateFormForNodeChange,
  type MigrateForm,
  type MigrateTargetContext,
  type ReplaceForm,
} from './VpsAdminLifecycleModel';
import {
  ActionGateAlert,
  ActionImpactSummary,
  AsyncActionResult,
  DangerConfirmationNotice,
  Field,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
} from './VpsLifecyclePrimitives';
import { nodeLabel, pickedNodeLabel, vpsLabel } from './VpsLifecycleModel';

export type { MigrateForm, ReplaceForm } from './VpsAdminLifecycleModel';

const migrateWeekdayOptions = [
  { value: '0', labelKey: 'common.weekday.sun' },
  { value: '1', labelKey: 'common.weekday.mon' },
  { value: '2', labelKey: 'common.weekday.tue' },
  { value: '3', labelKey: 'common.weekday.wed' },
  { value: '4', labelKey: 'common.weekday.thu' },
  { value: '5', labelKey: 'common.weekday.fri' },
  { value: '6', labelKey: 'common.weekday.sat' },
] as const;

const migrateHourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

function formatExpirationPreview(rawValue: string, emptyLabel: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return emptyLabel;
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) ? formatDateTime(date.toISOString()) : trimmed;
}

export function VpsAdminReplaceCard(props: {
  vps: Vps;
  form: ReplaceForm;
  onChange: Dispatch<SetStateAction<ReplaceForm>>;
  selectedNodeLabel: string;
  onSelectedNodeLabelChange: (label: string) => void;
  gate: GateDecision;
  pending: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const targetNode = props.selectedNodeLabel || props.form.node.trim() || t('vps.lifecycle.replace.review.backend_default');
  const expiration = formatExpirationPreview(props.form.expirationDate, t('vps.lifecycle.replace.review.no_expiration'));

  const setForm = (patch: Partial<ReplaceForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.replace"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.replace.submit"
          disabled={props.pending}
          gate={props.gate}
          loading={props.pending}
          errorMessage={props.errorMessage}
          onClick={props.onSubmit}
          confirmation={{
            title: t('vps.lifecycle.replace.submit'),
            description: t('vps.lifecycle.replace.warning_body'),
            target: {
              vpsId: props.vps.id,
              objectLabel: String(props.vps.hostname ?? '') || `#${props.vps.id}`,
            },
          }}
        >
          {t('vps.lifecycle.replace.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="warn" title={t('vps.lifecycle.replace.warning_title')}>
        {t('vps.lifecycle.replace.warning_body')}
      </Alert>
      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.replace.node_help')}>
          <NodeLookupInput
            value={props.form.node}
            selectedLabel={props.selectedNodeLabel}
            onChange={(node) => {
              props.onSelectedNodeLabelChange('');
              setForm({ node });
            }}
            onPick={(node) => props.onSelectedNodeLabelChange(pickedNodeLabel(node))}
            placeholder={t('vps.lifecycle.placeholder.node_optional')}
            testId="vps.lifecycle.replace.node"
            disabled={props.pending}
          />
        </Field>
        <Field label={t('vps.lifecycle.field.expiration_date')} help={t('vps.lifecycle.replace.expiration_help')}>
          <Input
            type="datetime-local"
            value={props.form.expirationDate}
            onChange={(e) => setForm({ expirationDate: e.target.value })}
            testId="vps.lifecycle.replace.expiration"
            disabled={props.pending}
          />
        </Field>
      </div>

      <Checkbox
        checked={props.form.start}
        onChange={(start) => setForm({ start })}
        label={t('vps.lifecycle.replace.start')}
        description={t('vps.lifecycle.replace.start_help')}
        testId="vps.lifecycle.replace.start"
      />

      <Field label={t('vps.lifecycle.field.reason')} help={t('vps.lifecycle.replace.reason_help')}>
        <Textarea
          rows={3}
          value={props.form.reason}
          onChange={(e) => setForm({ reason: e.target.value })}
          testId="vps.lifecycle.replace.reason"
          disabled={props.pending}
        />
      </Field>

      <ActionImpactSummary testId="vps.lifecycle.replace.review">
        <ImpactItem label={t('vps.lifecycle.admin_review.target')} testId="vps.lifecycle.replace.review.target">
          {vpsLabel(props.vps, props.vps.id)}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.replace.review.destination')} testId="vps.lifecycle.replace.review.destination">
          {t('vps.lifecycle.replace.review.destination_body', { node: targetNode, expiration })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.replace.review.after')} testId="vps.lifecycle.replace.review.after">
          {t('vps.lifecycle.replace.review.after_body', {
            start: props.form.start ? t('common.yes') : t('common.no'),
            reason: props.form.reason.trim() || t('common.none'),
          })}
        </ImpactItem>
      </ActionImpactSummary>

      <DangerConfirmationNotice
        label={t('vps.lifecycle.admin_confirm.label')}
        help={t('vps.lifecycle.admin_confirm.help')}
        testId="vps.lifecycle.replace.confirm"
      />

      <AsyncActionResult
        errorTitle={t('vps.lifecycle.replace.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

export function VpsAdminMigrateCard(props: {
  vps: Vps;
  form: MigrateForm;
  onChange: Dispatch<SetStateAction<MigrateForm>>;
  nodes: Node[];
  nodesLoading: boolean;
  nodesError: boolean;
  onRetryNodes: () => void;
  targetContext: MigrateTargetContext;
  gate: GateDecision;
  pending: boolean;
  succeeded: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const setForm = (patch: Partial<MigrateForm>) => props.onChange((prev) => ({ ...prev, ...patch }));
  const setNodeValue = (value: string) => {
    const nextNode = findMigrateTargetNode(value, props.nodes);
    const nextContext = buildMigrateTargetContext(props.vps, nextNode);
    props.onChange((prev) => nextMigrateFormForNodeChange(prev, value, nextContext));
  };
  const targetNode = migrateNodeDisplay(props.targetContext.targetNode, props.form.node);
  const validTarget = props.targetContext.targetSelected
    && props.targetContext.targetNodeId !== props.targetContext.sourceNodeId
    && props.targetContext.targetNode?.active !== false
    && (!props.targetContext.targetNode?.type || props.targetContext.targetNode.type === 'node')
    && !props.nodesLoading && !props.nodesError;
  const sameNetworkScope = props.targetContext.sourceLocationId !== null
    && props.targetContext.sourceLocationId === props.targetContext.targetLocationId
    && props.targetContext.sourceEnvironmentId !== undefined
    && props.targetContext.sourceEnvironmentId === props.targetContext.targetEnvironmentId;

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.migrate"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.migrate.submit"
          disabled={!validTarget || !isMigrateReady(props.form)}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.migrate.submit')}
        </LifecycleSubmitButton>
      }
    >
      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />
      <VpsMigrationNodePicker
        nodes={props.nodes}
        sourceId={props.targetContext.sourceNodeId}
        sourceLabel={nodeLabel(props.vps)}
        value={props.form.node}
        onChange={setNodeValue}
        loading={props.nodesLoading}
        error={props.nodesError}
        onRetry={props.onRetryNodes}
        disabled={props.pending}
      />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.schedule_panel">
          <div className="mb-3">
            <div className="text-sm font-semibold text-fg">{t('vps.lifecycle.migrate.schedule.title')}</div>
          </div>
          <div className="space-y-3">
            <Field label={t('vps.lifecycle.migrate.schedule.label')} help={t(props.form.scheduleMode === 'custom' ? 'vps.lifecycle.migrate.schedule.custom_help' : props.form.scheduleMode === 'now' ? 'vps.lifecycle.migrate.schedule.now_help' : 'vps.lifecycle.migrate.schedule.maintenance_help')}>
              <Select
                value={props.form.scheduleMode}
                onChange={(e) => setForm({ scheduleMode: e.target.value as MigrateForm['scheduleMode'], confirm: false })}
                testId="vps.lifecycle.migrate.schedule"
                disabled={props.pending}
              >
                <option value="maintenance">{t('vps.lifecycle.migrate.schedule.maintenance')}</option>
                <option value="now">{t('vps.lifecycle.migrate.schedule.now')}</option>
                <option value="custom">{t('vps.lifecycle.migrate.schedule.custom')}</option>
              </Select>
            </Field>

            {props.form.scheduleMode === 'custom' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t('vps.lifecycle.migrate.finish_weekday')} help={t('vps.lifecycle.migrate.finish_weekday_help')}>
                  <Select
                    value={props.form.finishWeekday}
                    onChange={(e) => setForm({ finishWeekday: e.target.value, confirm: false })}
                    testId="vps.lifecycle.migrate.finish_weekday"
                    disabled={props.pending}
                  >
                    <option value="">{t('vps.lifecycle.migrate.schedule.choose_day')}</option>
                    {migrateWeekdayOptions.map((day) => (
                      <option key={day.value} value={day.value}>{t(day.labelKey)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('vps.lifecycle.migrate.finish_hour')} help={t('vps.lifecycle.migrate.finish_hour_help')}>
                  <Select
                    value={props.form.finishHour}
                    onChange={(e) => setForm({ finishHour: e.target.value, confirm: false })}
                    testId="vps.lifecycle.migrate.finish_hour"
                    disabled={props.pending}
                  >
                    <option value="">{t('vps.lifecycle.migrate.schedule.choose_hour')}</option>
                    {migrateHourOptions.map((hour) => (
                      <option key={hour.value} value={hour.value}>{hour.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
          </div>
        </div>

        <Field label={t('vps.lifecycle.migrate.reason')} help={t('vps.lifecycle.migrate.reason_help')}>
          <Textarea
            value={props.form.reason}
            onChange={(e) => setForm({ reason: e.target.value, confirm: false })}
            testId="vps.lifecycle.migrate.reason"
            rows={3}
            disabled={props.pending}
          />
        </Field>
      </div>

      <fieldset className="rounded-md border border-border p-3" disabled={props.pending}>
        <legend className="px-1 text-sm font-semibold">{t('vps.lifecycle.migrate.review.ip')}</legend>
        {!validTarget ? <p className="text-xs text-muted">{t('vps.lifecycle.migrate.ip_choose_target')}</p> : (
          props.targetContext.canTransferIpAddresses || props.targetContext.canReplaceIpAddresses ? (
            <div className="grid gap-2 md:grid-cols-2">
              {props.targetContext.canTransferIpAddresses ? (
                <Checkbox checked={props.form.transferIpAddresses} onChange={(v) => setForm({ transferIpAddresses: v, confirm: false })} label={t('vps.lifecycle.migrate.option.transfer_ip_addresses')} description={t('vps.lifecycle.migrate.transfer_help')} testId="vps.lifecycle.migrate.transfer_ip_addresses" />
              ) : null}
              {props.targetContext.canReplaceIpAddresses ? (
                <Checkbox checked={props.form.replaceIpAddresses} onChange={(v) => setForm({ replaceIpAddresses: v, confirm: false })} label={t('vps.lifecycle.migrate.option.replace_ip_addresses')} description={t('vps.lifecycle.migrate.replace_help')} testId="vps.lifecycle.migrate.replace_ip_addresses" />
              ) : null}
            </div>
          ) : <p className="text-xs text-muted">{t(sameNetworkScope ? 'vps.lifecycle.migrate.review.ip_same_location' : 'vps.lifecycle.migrate.ip_unknown')}</p>
        )}
      </fieldset>

      <fieldset className="rounded-md border border-border p-3" disabled={props.pending}>
        <legend className="px-1 text-sm font-semibold">{t('vps.lifecycle.migrate.execution')}</legend>
        <div className="grid gap-2 md:grid-cols-2">
          <Checkbox checked={props.form.cleanupData} onChange={(v) => setForm({ cleanupData: v, confirm: false })} label={t('vps.lifecycle.migrate.option.cleanup_data')} description={t('vps.lifecycle.migrate.cleanup_help')} testId="vps.lifecycle.migrate.cleanup_data" />
          <Checkbox checked={props.form.sendMail} onChange={(v) => setForm({ sendMail: v, confirm: false })} label={t('vps.lifecycle.migrate.option.send_mail')} description={t('vps.lifecycle.migrate.mail_help')} testId="vps.lifecycle.migrate.send_mail" />
          <Checkbox checked={props.form.noStart} onChange={(v) => setForm({ noStart: v, confirm: false })} label={t('vps.lifecycle.migrate.option.no_start')} testId="vps.lifecycle.migrate.no_start" />
          <Checkbox checked={props.form.skipStart} onChange={(v) => setForm({ skipStart: v, confirm: false })} label={t('vps.lifecycle.migrate.option.skip_start')} testId="vps.lifecycle.migrate.skip_start" />
          <Checkbox checked={props.form.stopOnError} onChange={(v) => setForm({ stopOnError: v, confirm: false })} label={t('vps.lifecycle.migrate.option.stop_on_error')} testId="vps.lifecycle.migrate.stop_on_error" />
        </div>
      </fieldset>

      <Checkbox
        checked={props.form.confirm}
        onChange={(confirm) => setForm({ confirm })}
        label={t('vps.lifecycle.migrate.confirm_target', { vps: vpsLabel(props.vps), node: targetNode })}
        disabled={props.pending || !validTarget}
        testId="vps.lifecycle.migrate.confirm"
      />

      <AsyncActionResult
        succeeded={props.succeeded}
        successTitle={t('vps.lifecycle.migrate.success')}
        successBody={t('vps.lifecycle.migrate.success_body')}
        errorTitle={t('vps.lifecycle.migrate.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

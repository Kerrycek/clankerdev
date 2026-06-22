import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { NodeLookupInput } from '../../../components/ui/NodeLookupInput';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import type { Node } from '../../../lib/api/nodes';
import type { Vps } from '../../../lib/api/vps';
import { formatDateTime } from '../../../lib/format';
import type { GateDecision } from '../../../lib/gates/types';
import {
  adminConfirmTarget,
  buildMigrateTargetContext,
  findMigrateTargetNode,
  isAdminConfirmSatisfied,
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
  DangerTypedConfirm,
  Field,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
} from './VpsLifecyclePrimitives';
import { nodeLabel, pickedNodeLabel, vpsLabel, vpsLocationLabel } from './VpsLifecycleModel';

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

function nodeLocationText(node: Node | undefined): string {
  const location = node?.location;
  if (!location) return '—';
  return String(location.label ?? location.description ?? location.domain ?? `#${location.id}`);
}

function formatExpirationPreview(rawValue: string, emptyLabel: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return emptyLabel;
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) ? formatDateTime(date.toISOString()) : trimmed;
}

function scheduleText(t: ReturnType<typeof useI18n>['t'], form: MigrateForm): string {
  if (form.scheduleMode === 'now') return t('vps.lifecycle.migrate.schedule.now');
  if (form.scheduleMode === 'maintenance') return t('vps.lifecycle.migrate.schedule.maintenance');
  const day = migrateWeekdayOptions.find((option) => option.value === form.finishWeekday);
  const hour = migrateHourOptions.find((option) => option.value === form.finishHour);
  return t('vps.lifecycle.migrate.review.timing_custom', {
    day: day ? t(day.labelKey) : t('common.na'),
    hour: hour?.label ?? t('common.na'),
  });
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
  const confirmTarget = adminConfirmTarget(props.vps);
  const confirmSatisfied = isAdminConfirmSatisfied(props.form.confirmText, confirmTarget);
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
          disabled={!confirmSatisfied}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
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
              setForm({ node, confirmText: '' });
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
            onChange={(e) => setForm({ expirationDate: e.target.value, confirmText: '' })}
            testId="vps.lifecycle.replace.expiration"
            disabled={props.pending}
          />
        </Field>
      </div>

      <Checkbox
        checked={props.form.start}
        onChange={(start) => setForm({ start, confirmText: '' })}
        label={t('vps.lifecycle.replace.start')}
        description={t('vps.lifecycle.replace.start_help')}
        testId="vps.lifecycle.replace.start"
      />

      <Field label={t('vps.lifecycle.field.reason')} help={t('vps.lifecycle.replace.reason_help')}>
        <Textarea
          rows={3}
          value={props.form.reason}
          onChange={(e) => setForm({ reason: e.target.value, confirmText: '' })}
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

      <DangerTypedConfirm
        label={t('vps.lifecycle.admin_confirm.label')}
        help={t('vps.lifecycle.admin_confirm.help', { target: confirmTarget })}
        target={confirmTarget}
        value={props.form.confirmText}
        onChange={(confirmText) => setForm({ confirmText })}
        disabled={props.pending}
        testId="vps.lifecycle.replace.confirm"
        satisfied={confirmSatisfied}
        mismatchTitle={t('vps.lifecycle.admin_confirm.mismatch_title')}
        mismatchBody={t('vps.lifecycle.admin_confirm.mismatch_body')}
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
  selectedNodeLabel: string;
  onSelectedNodeLabelChange: (label: string) => void;
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
    props.onSelectedNodeLabelChange('');
    const nextNode = findMigrateTargetNode(value, props.nodes);
    const nextContext = buildMigrateTargetContext(props.vps, nextNode);
    props.onChange((prev) => nextMigrateFormForNodeChange(prev, value, nextContext));
  };
  const targetNode = migrateNodeDisplay(props.targetContext.targetNode, props.form.node);
  const ipMode = props.targetContext.canTransferIpAddresses || props.targetContext.canReplaceIpAddresses
    ? t('vps.lifecycle.migrate.review.ip_body', {
        transfer: props.targetContext.canTransferIpAddresses ? (props.form.transferIpAddresses ? t('common.yes') : t('common.no')) : t('common.na'),
        replace: props.targetContext.canReplaceIpAddresses ? (props.form.replaceIpAddresses ? t('common.yes') : t('common.no')) : t('common.na'),
      })
    : t('vps.lifecycle.migrate.review.ip_same_location');

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.migrate"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.migrate.submit"
          disabled={!isMigrateReady(props.form)}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.migrate.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="neutral">{t('vps.lifecycle.migrate.review.help')}</Alert>
      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.migrate.node_help')}>
        <NodeLookupInput
          value={props.form.node}
          selectedLabel={props.selectedNodeLabel}
          onChange={setNodeValue}
          onPick={(node) => props.onSelectedNodeLabelChange(pickedNodeLabel(node))}
          placeholder={t('vps.lifecycle.placeholder.node')}
          loadingLabel={t('common.loading')}
          noResultsLabel={t('vps.lifecycle.migrate.no_nodes')}
          testId="vps.lifecycle.migrate.node"
          disabled={props.pending || props.nodesError || props.nodesLoading}
        />
        {props.nodesError ? <div className="mt-1 text-xs text-danger">{t('vps.lifecycle.migrate.nodes_load_error')}</div> : null}
      </Field>

      <div className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.schedule_panel">
        <div className="mb-3">
          <div className="text-sm font-semibold text-fg">{t('vps.lifecycle.migrate.schedule.title')}</div>
          <div className="text-xs text-muted">{t('vps.lifecycle.migrate.schedule.subtitle')}</div>
        </div>
        <div className="space-y-3">
          <Field label={t('vps.lifecycle.migrate.schedule.label')} help={t('vps.lifecycle.migrate.schedule.help')}>
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {props.targetContext.targetSelected && props.targetContext.canTransferIpAddresses ? (
          <Checkbox checked={props.form.transferIpAddresses} onChange={(v) => setForm({ transferIpAddresses: v, confirm: false })} label={t('vps.lifecycle.migrate.option.transfer_ip_addresses')} testId="vps.lifecycle.migrate.transfer_ip_addresses" />
        ) : null}
        {props.targetContext.targetSelected && props.targetContext.canReplaceIpAddresses ? (
          <Checkbox checked={props.form.replaceIpAddresses} onChange={(v) => setForm({ replaceIpAddresses: v, confirm: false })} label={t('vps.lifecycle.migrate.option.replace_ip_addresses')} testId="vps.lifecycle.migrate.replace_ip_addresses" />
        ) : null}
        <Checkbox checked={props.form.stopOnError} onChange={(v) => setForm({ stopOnError: v, confirm: false })} label={t('vps.lifecycle.migrate.option.stop_on_error')} testId="vps.lifecycle.migrate.stop_on_error" />
        <Checkbox checked={props.form.cleanupData} onChange={(v) => setForm({ cleanupData: v, confirm: false })} label={t('vps.lifecycle.migrate.option.cleanup_data')} testId="vps.lifecycle.migrate.cleanup_data" />
        <Checkbox checked={props.form.sendMail} onChange={(v) => setForm({ sendMail: v, confirm: false })} label={t('vps.lifecycle.migrate.option.send_mail')} testId="vps.lifecycle.migrate.send_mail" />
      </div>

      <details className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.advanced">
        <summary className="cursor-pointer text-sm font-semibold text-fg">{t('vps.lifecycle.migrate.advanced.title')}</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox checked={props.form.noStart} onChange={(v) => setForm({ noStart: v, confirm: false })} label={t('vps.lifecycle.migrate.option.no_start')} testId="vps.lifecycle.migrate.no_start" />
            <Checkbox checked={props.form.skipStart} onChange={(v) => setForm({ skipStart: v, confirm: false })} label={t('vps.lifecycle.migrate.option.skip_start')} testId="vps.lifecycle.migrate.skip_start" />
          </div>
          <Field label={t('vps.lifecycle.migrate.reason')} help={t('vps.lifecycle.migrate.reason_help')}>
            <Textarea
              value={props.form.reason}
              onChange={(e) => setForm({ reason: e.target.value, confirm: false })}
              testId="vps.lifecycle.migrate.reason"
              disabled={props.pending}
            />
          </Field>
        </div>
      </details>

      <ActionImpactSummary className="grid gap-3 md:grid-cols-2" testId="vps.lifecycle.migrate.review">
        <ImpactItem label={t('vps.lifecycle.migrate.review.route')} testId="vps.lifecycle.migrate.review.route">
          {t('vps.lifecycle.migrate.review.route_body', {
            sourceNode: nodeLabel(props.vps),
            targetNode,
            sourceLocation: vpsLocationLabel(props.vps),
            targetLocation: nodeLocationText(props.targetContext.targetNode),
          })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.migrate.review.timing')} testId="vps.lifecycle.migrate.review.timing">
          {scheduleText(t, props.form)}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.migrate.review.ip')} testId="vps.lifecycle.migrate.review.ip">
          {ipMode}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.migrate.review.cleanup')} testId="vps.lifecycle.migrate.review.cleanup">
          {t('vps.lifecycle.migrate.review.cleanup_body', {
            cleanup: props.form.cleanupData ? t('common.yes') : t('common.no'),
            mail: props.form.sendMail ? t('common.yes') : t('common.no'),
            noStart: props.form.noStart ? t('common.yes') : t('common.no'),
            skipStart: props.form.skipStart ? t('common.yes') : t('common.no'),
          })}
        </ImpactItem>
      </ActionImpactSummary>

      <Checkbox
        checked={props.form.confirm}
        onChange={(confirm) => setForm({ confirm })}
        label={t('vps.lifecycle.confirm.migrate')}
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

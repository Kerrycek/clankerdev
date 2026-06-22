import type { ReactNode } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import type { GateDecision } from '../../../lib/gates/types';
import {
  ActionConfirmChecklist,
  ActionGateAlert,
  ActionImpactSummary,
  AsyncActionResult,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
  type ActionChecklistItem,
} from './VpsLifecyclePrimitives';

export type PowerActionKind = 'start' | 'stop' | 'restart';

export function VpsPowerActionCard(props: {
  kind: PowerActionKind;
  gate: GateDecision;
  currentStateLabel: ReactNode;
  objectStateLabel: ReactNode;
  taskQueueLabel: ReactNode;
  confirm: boolean;
  onConfirmChange: (checked: boolean) => void;
  force?: boolean;
  onForceChange?: (checked: boolean) => void;
  pending: boolean;
  errorMessage?: string;
  onSubmit: () => void;
  onOpenTasks: () => void;
}) {
  const { t } = useI18n();
  const { kind } = props;
  const isStart = kind === 'start';

  const checklist: ActionChecklistItem[] = [];
  if (kind === 'stop') {
    checklist.push({
      checked: Boolean(props.force),
      onChange: (checked) => props.onForceChange?.(checked),
      label: t('vps.power.stop.force.label'),
      description: t('vps.power.stop.force.help'),
      testId: 'vps.lifecycle.stop.force',
    });
  }
  if (kind === 'restart') {
    checklist.push({
      checked: Boolean(props.force),
      onChange: (checked) => props.onForceChange?.(checked),
      label: t('vps.power.restart.force.label'),
      description: t('vps.power.restart.force.help'),
      testId: 'vps.lifecycle.restart.force',
    });
  }
  checklist.push({
    checked: props.confirm,
    onChange: props.onConfirmChange,
    label: t(`vps.lifecycle.power.${kind}.confirm`),
    testId: `vps.lifecycle.${kind}.confirm`,
  });

  return (
    <LifecycleActionShell
      testId={`vps.lifecycle.${kind}`}
      footer={
        <LifecycleSubmitButton
          variant={kind === 'stop' ? 'danger' : kind === 'restart' ? 'warn' : 'primary'}
          testId={`vps.lifecycle.${kind}.submit`}
          disabled={!props.confirm}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t(`action.vps.${kind}.label`)}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant={isStart ? 'neutral' : 'warn'} title={t(`vps.lifecycle.power.${kind}.safety_title`)}>
        {t(`vps.lifecycle.power.${kind}.safety_body`)}
      </Alert>

      <ActionImpactSummary>
        <ImpactItem label={t('vps.lifecycle.power.current_state')} testId={`vps.lifecycle.${kind}.current_state`}>
          {props.currentStateLabel}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.power.object_state')} testId={`vps.lifecycle.${kind}.object_state`}>
          {props.objectStateLabel}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.power.task_queue')} testId={`vps.lifecycle.${kind}.task_queue`}>
          {props.taskQueueLabel}
        </ImpactItem>
      </ActionImpactSummary>

      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <ActionConfirmChecklist items={checklist} />

      <AsyncActionResult
        errorTitle={t(`vps.lifecycle.power.${kind}.error`)}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

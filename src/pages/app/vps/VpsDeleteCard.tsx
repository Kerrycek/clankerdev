import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import type { Vps } from '../../../lib/api/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { AsyncActionResult, LifecycleActionShell, LifecycleSubmitButton } from './VpsLifecyclePrimitives';
import { VpsDeleteDangerContent } from './VpsDeleteConfirmation';
import {
  isVpsDeleteConfirmationSatisfied,
  vpsDeleteConfirmationTarget,
  type DeleteForm,
} from './VpsDeleteModel';

export type { DeleteForm } from './VpsDeleteModel';

export function VpsDeleteCard(props: {
  vps: Vps;
  isAdminMode: boolean;
  form: DeleteForm;
  onChange: Dispatch<SetStateAction<DeleteForm>>;
  gate: GateDecision;
  pending: boolean;
  errorMessage?: string;
  onOpenTasks?: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const target = vpsDeleteConfirmationTarget(props.vps);
  const confirmSatisfied = isVpsDeleteConfirmationSatisfied(props.form.confirmText, target);

  const setForm = (patch: Partial<DeleteForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.delete"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.delete.submit"
          disabled={!confirmSatisfied}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.delete.submit')}
        </LifecycleSubmitButton>
      }
    >
      <VpsDeleteDangerContent
        vps={props.vps}
        isAdminMode={props.isAdminMode}
        lazy={props.form.lazy}
        confirmText={props.form.confirmText}
        onLazyChange={(lazy) => setForm({ lazy })}
        onConfirmTextChange={(confirmText) => setForm({ confirmText })}
        pending={props.pending}
        gate={props.gate}
        onOpenTasks={props.onOpenTasks}
        impactTestId="vps.lifecycle.delete.impact"
        lazyTestId="vps.lifecycle.delete.lazy"
        confirmTestId="vps.lifecycle.delete.confirm"
      />

      <AsyncActionResult
        errorTitle={t('vps.lifecycle.delete.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

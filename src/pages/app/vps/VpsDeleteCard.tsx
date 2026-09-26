import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import type { Vps } from '../../../lib/api/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { AsyncActionResult, LifecycleActionShell, LifecycleSubmitButton } from './VpsLifecyclePrimitives';
import { VpsDeleteDangerContent } from './VpsDeleteConfirmation';
import { deleteExpirationValid, type DeleteForm } from './VpsDeleteModel';

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
          disabled={props.isAdminMode && !deleteExpirationValid(props.form)}
          gate={props.gate}
          loading={props.pending}
          errorMessage={props.errorMessage}
          onClick={props.onSubmit}
          confirmation={{
            title: t('vps.lifecycle.delete.submit'),
            description: [
              t('vps.lifecycle.delete.warning_body'),
              props.isAdminMode ? t(props.form.lazy ? 'vps.lifecycle.delete.mode_soft' : 'vps.lifecycle.delete.mode_hard') : '',
              props.isAdminMode && props.form.lazy && props.form.customExpiration
                ? `${t('vps.lifecycle.delete.expiration_label')}: ${props.form.expirationLocal?.replace('T', ' ')}`
                : '',
            ].filter(Boolean).join(' '),
            target: {
              vpsId: props.vps.id,
              objectLabel: String(props.vps.hostname ?? '') || `#${props.vps.id}`,
            },
          }}
        >
          {t('vps.lifecycle.delete.submit')}
        </LifecycleSubmitButton>
      }
    >
      <VpsDeleteDangerContent
        vps={props.vps}
        isAdminMode={props.isAdminMode}
        lazy={props.form.lazy}
        onLazyChange={(lazy) => setForm({ lazy })}
        form={props.form}
        onFormChange={setForm}
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

import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { Vps } from '../../../lib/api/vps';
import type { GateDecision } from '../../../lib/gates/types';
import {
  ActionGateAlert,
  ActionImpactSummary,
  ImpactItem,
} from './VpsLifecyclePrimitives';
import {
  vpsDeleteConfirmationTarget,
  vpsDeleteObjectLabel,
  type VpsDeleteConfirmationSource,
} from './VpsDeleteModel';

export type VpsDeleteDangerForm = {
  lazy: boolean;
  confirmText: string;
};

export type VpsListDeleteConfirm = {
  vpsId: number;
  kind: 'delete';
  force: false;
  lazy: boolean;
  confirmText: string;
};

function vpsIdFallback(vpsId: number): VpsDeleteConfirmationSource {
  return { id: vpsId, hostname: null };
}

export function VpsDeleteImpactSummary(props: {
  vps: VpsDeleteConfirmationSource;
  isAdminMode: boolean;
  lazy: boolean;
  testId?: string;
}) {
  const { t } = useI18n();
  const target = vpsDeleteConfirmationTarget(props.vps);
  const modeBody = props.isAdminMode
    ? props.lazy
      ? t('vps.lifecycle.delete.impact.mode_lazy_body')
      : t('vps.lifecycle.delete.impact.mode_hard_body')
    : t('vps.lifecycle.delete.impact.mode_user_body');

  return (
    <ActionImpactSummary className="grid gap-3 md:grid-cols-2" testId={props.testId}>
      <ImpactItem label={t('vps.lifecycle.delete.impact.target')} testId={props.testId ? `${props.testId}.target` : undefined}>
        <span className="font-mono text-xs">{target}</span>
        <span className="ml-2 text-xs text-muted">#{props.vps.id}</span>
      </ImpactItem>
      <ImpactItem label={t('vps.lifecycle.delete.impact.mode')} testId={props.testId ? `${props.testId}.mode` : undefined}>
        {modeBody}
      </ImpactItem>
      <ImpactItem label={t('vps.lifecycle.delete.impact.changes')} testId={props.testId ? `${props.testId}.changes` : undefined}>
        {t('vps.lifecycle.delete.impact.changes_body')}
      </ImpactItem>
      <ImpactItem label={t('vps.lifecycle.delete.impact.check')} testId={props.testId ? `${props.testId}.check` : undefined}>
        {t('vps.lifecycle.delete.impact.check_body')}
      </ImpactItem>
    </ActionImpactSummary>
  );
}

export function VpsDeleteDangerContent(props: {
  vps: VpsDeleteConfirmationSource;
  isAdminMode: boolean;
  lazy: boolean;
  confirmText: string;
  onLazyChange?: (lazy: boolean) => void;
  onConfirmTextChange: (confirmText: string) => void;
  pending?: boolean;
  gate?: GateDecision;
  onOpenTasks?: () => void;
  impactTestId?: string;
  lazyTestId: string;
  confirmTestId: string;
}) {
  const { t } = useI18n();

  return (
    <>
      <Alert variant="danger" title={t('vps.lifecycle.delete.warning_title')}>
        {t('vps.lifecycle.delete.warning_body')}
      </Alert>

      <VpsDeleteImpactSummary
        vps={props.vps}
        isAdminMode={props.isAdminMode}
        lazy={props.lazy}
        testId={props.impactTestId}
      />

      {props.isAdminMode ? (
        <Checkbox
          checked={props.lazy}
          onChange={(lazy) => props.onLazyChange?.(lazy)}
          label={t('vps.lifecycle.delete.lazy')}
          description={t('vps.lifecycle.delete.lazy_help')}
          testId={props.lazyTestId}
          disabled={props.pending}
        />
      ) : (
        <Alert variant="neutral">{t('vps.lifecycle.user_delete.summary')}</Alert>
      )}

      {props.gate ? <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} /> : null}
    </>
  );
}

export function VpsDeleteConfirmDialog(props: {
  open: boolean;
  vps?: Vps;
  vpsId: number;
  isAdminMode: boolean;
  form: VpsDeleteDangerForm;
  onChange: Dispatch<SetStateAction<VpsDeleteDangerForm>>;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (vars: { vpsId: number; lazy: boolean; objectLabel: string }) => void;
}) {
  const { t } = useI18n();
  const vps = props.vps ?? vpsIdFallback(props.vpsId);

  const setForm = (patch: Partial<VpsDeleteDangerForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  return (
    <ConfirmDialog
      open={props.open}
      testId="vps.list.delete_confirm"
      title={t('vps.list.delete_confirm.title')}
      description={t('vps.list.delete_confirm.description')}
      danger
      confirmLabel={t('action.vps.delete.label')}
      confirmLoading={props.loading}
      onCancel={props.onCancel}
      onConfirm={() => {
        props.onConfirm({
          vpsId: props.vpsId,
          lazy: props.form.lazy,
          objectLabel: vpsDeleteObjectLabel(vps),
        });
      }}
    >
      <div className="space-y-3">
        <VpsDeleteDangerContent
          vps={vps}
          isAdminMode={props.isAdminMode}
          lazy={props.form.lazy}
          confirmText={props.form.confirmText}
          onLazyChange={(lazy) => setForm({ lazy })}
          onConfirmTextChange={(confirmText) => setForm({ confirmText })}
          pending={props.loading}
          impactTestId="vps.list.delete_confirm.impact"
          lazyTestId="vps.list.delete_confirm.lazy"
          confirmTestId="vps.list.delete_confirm.confirm_text"
        />
      </div>
    </ConfirmDialog>
  );
}

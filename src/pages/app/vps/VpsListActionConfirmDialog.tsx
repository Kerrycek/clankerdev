import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { Vps } from '../../../lib/api/vps';
import { vpsDeleteObjectLabel } from './VpsDeleteModel';
import { VpsDeleteConfirmDialog, type VpsListDeleteConfirm } from './VpsDeleteConfirmation';
import { VpsPowerConfirmTarget } from './VpsPowerConfirmation';

export type VpsListPowerConfirm = {
  vpsId: number;
  kind: 'stop' | 'restart';
  force: boolean;
};

export type VpsListActionConfirm = VpsListPowerConfirm | VpsListDeleteConfirm;

export function VpsListActionConfirmDialog(props: {
  confirm: VpsListActionConfirm;
  vps?: Vps;
  isAdminMode: boolean;
  error?: { title: string; body?: string } | null;
  powerLoading?: boolean;
  deleteLoading?: boolean;
  onChange: Dispatch<SetStateAction<VpsListActionConfirm | null>>;
  onCancel: () => void;
  onConfirmPower: (vars: { vpsId: number; kind: 'stop' | 'restart'; force: boolean; objectLabel: string }) => void;
  onConfirmDelete: (vars: { vpsId: number; lazy: boolean; objectLabel: string; expiration_date?: string }) => void;
}) {
  const { t } = useI18n();
  const { confirm } = props;
  const objectLabel = props.vps ? vpsDeleteObjectLabel(props.vps) : t('common.vps_ref', { id: confirm.vpsId });

  if (confirm.kind === 'delete') {
    return (
      <VpsDeleteConfirmDialog
        open
        vps={props.vps}
        vpsId={confirm.vpsId}
        isAdminMode={props.isAdminMode}
        form={confirm}
        onChange={(updater) => {
          props.onChange((prev) => {
            if (!prev || prev.kind !== 'delete') return prev;
            const nextForm = typeof updater === 'function'
              ? updater(prev)
              : updater;
            return { ...prev, ...nextForm };
          });
        }}
        loading={props.deleteLoading}
        error={props.error}
        onCancel={props.onCancel}
        onConfirm={props.onConfirmDelete}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      testId="vps.list.power_confirm"
      title={confirm.kind === 'stop' ? t('vps.power.stop.confirm_title') : t('vps.power.restart.confirm_title')}
      description={confirm.kind === 'stop' ? t('vps.power.stop.confirm_desc_basic') : t('vps.power.restart.confirm_desc_basic')}
      danger={confirm.kind === 'stop'}
      confirmLabel={confirm.kind === 'stop' ? t('action.vps.stop.label') : t('action.vps.restart.label')}
      confirmLoading={props.powerLoading}
      onCancel={props.onCancel}
      onConfirm={() => props.onConfirmPower({
        vpsId: confirm.vpsId,
        kind: confirm.kind,
        force: confirm.force,
        objectLabel,
      })}
    >
      <div className="space-y-3">
        <VpsPowerConfirmTarget
          vpsId={confirm.vpsId}
          objectLabel={objectLabel}
          testId="vps.list.power_confirm.target"
        />
        {props.error ? (
          <Alert variant="danger" title={props.error.title} testId="vps.list.power_confirm.error">
            {props.error.body}
          </Alert>
        ) : null}
        <Checkbox
          checked={confirm.force}
          onChange={(checked) => props.onChange((prev) => (prev && prev.kind !== 'delete' ? { ...prev, force: checked } : prev))}
          label={t('common.force')}
          testId="vps.list.power_confirm.force"
        />
      </div>
    </ConfirmDialog>
  );
}

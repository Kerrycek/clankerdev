import React, { useEffect, useMemo, useState } from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { formatMiB } from '../../../lib/format';
import type { GateDecision } from '../../../lib/gates/types';
import { ssdSizeGiBInput, validateSsdResize } from './VpsStorageModel';

export function VpsStorageResizeDialog(props: {
  open: boolean;
  objectLabel: string;
  currentMiB: number | null;
  usedMiB: number | null;
  gate: GateDecision;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (valueMiB: number, adminOverride: boolean) => void;
}) {
  const { t } = useI18n();
  const [sizeGiB, setSizeGiB] = useState('');
  const [adminOverride, setAdminOverride] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setSizeGiB(ssdSizeGiBInput(props.currentMiB));
    setAdminOverride(false);
  }, [props.currentMiB, props.open]);

  const validation = useMemo(
    () => validateSsdResize(sizeGiB, props.currentMiB, props.usedMiB),
    [props.currentMiB, props.usedMiB, sizeGiB]
  );
  const validationMessage = validation.issue ? t(`vps.storage.resize.validation.${validation.issue}`) : null;
  const disabled = props.pending || !props.gate.allowed || !validation.ok;

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t('vps.storage.resize.title')}
      size="sm"
      testId="vps.storage.resize.modal"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} disabled={props.pending} testId="vps.storage.resize.cancel">
            {t('common.cancel')}
          </Button>
          <ActionButton
            onClick={() => {
              if (validation.valueMiB !== null && validation.ok) props.onSubmit(validation.valueMiB, adminOverride);
            }}
            loading={props.pending}
            disabled={disabled}
            disabledReason={!props.gate.allowed ? props.gate.reason : undefined}
            testId="vps.storage.resize.submit"
          >
            {t('vps.storage.resize.submit')}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert variant="info" title={t('vps.storage.resize.live.title')}>
          {t('vps.storage.resize.live.body')}
        </Alert>

        <div className="rounded-md border border-border bg-surface-2 p-3 text-sm">
          <div className="font-semibold text-fg">{props.objectLabel}</div>
          <div className="mt-1 text-muted">
            {t('vps.storage.resize.summary', {
              current: props.currentMiB !== null ? formatMiB(props.currentMiB) : t('common.na'),
              used: props.usedMiB !== null ? formatMiB(props.usedMiB) : t('common.na'),
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">{t('vps.storage.resize.field.size')}</span>
          <Input
            value={sizeGiB}
            type="number"
            min={0.01}
            step={1}
            inputMode="decimal"
            onChange={(event) => {
              setSizeGiB(event.target.value);
            }}
            disabled={props.pending}
            ariaInvalid={!validation.ok}
            testId="vps.storage.resize.size"
          />
          <span className="mt-1 block text-xs text-muted">{t('vps.storage.resize.field.size_help')}</span>
          {validationMessage ? <span className="mt-1 block text-xs text-danger">{validationMessage}</span> : null}
        </label>

        <Checkbox
          checked={adminOverride}
          onChange={setAdminOverride}
          label={t('vps.storage.resize.field.admin_override')}
          description={t('vps.storage.resize.field.admin_override_help')}
          disabled={props.pending}
          testId="vps.storage.resize.admin_override"
        />

        {props.error ? (
          <Alert variant="danger" title={t('vps.storage.resize.error')}>
            {props.error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

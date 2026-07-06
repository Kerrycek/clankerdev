import React from 'react';

import { useI18n } from '../../app/i18n';
import type { UserTotpDeviceCreateResponse } from '../../lib/api/userDossier';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SecretField } from '../ui/SecretField';
import { SwitchRow } from '../ui/SwitchRow';

import { looksLikeTotpCode, type TotpConfirmExistingStep, type TotpWizardStep } from './UserTotpDevicesModel';

export function UserTotpCreateWizardModal(props: {
  prefix: string;
  open: boolean;
  step: TotpWizardStep;
  label: string;
  onLabelChange: (value: string) => void;
  created: UserTotpDeviceCreateResponse | null;
  code: string;
  onCodeChange: (value: string) => void;
  recovery: string | null;
  ackRecovery: boolean;
  onAckRecoveryChange: (value: boolean) => void;
  createPending: boolean;
  createError: unknown;
  createIsError: boolean;
  confirmPending: boolean;
  confirmError: unknown;
  confirmIsError: boolean;
  onCreate: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (props.createPending || props.confirmPending) return;
        if (props.step === 3 && !props.ackRecovery) return;
        props.onClose();
      }}
      title={t('profile.mfa.totp.wizard.title')}
      testId={`${props.prefix}.totp.wizard`}
      footer={
        props.step === 1 ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={props.onClose} disabled={props.createPending} testId={`${props.prefix}.totp.wizard.cancel`}>
              {t('common.cancel')}
            </Button>
            <Button onClick={props.onCreate} loading={props.createPending} testId={`${props.prefix}.totp.wizard.create`}>
              {t('common.continue')}
            </Button>
          </div>
        ) : props.step === 2 ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={props.onClose} disabled={props.confirmPending} testId={`${props.prefix}.totp.wizard.close`}>
              {t('common.cancel')}
            </Button>
            <Button onClick={props.onConfirm} loading={props.confirmPending} testId={`${props.prefix}.totp.wizard.confirm`}>
              {t('profile.mfa.totp.wizard.confirm')}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                if (!props.ackRecovery) return;
                props.onClose();
              }}
              disabled={!props.ackRecovery}
              testId={`${props.prefix}.totp.wizard.done`}
            >
              {t('common.done')}
            </Button>
          </div>
        )
      }
    >
      {props.step === 1 ? (
        <div className="space-y-3">
          <div className="text-sm text-muted">{t('profile.mfa.totp.wizard.step1.help')}</div>
          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.field.label')}</div>
            <div className="mt-1">
              <Input
                value={props.label}
                onChange={(e) => props.onLabelChange(e.target.value)}
                placeholder={t('profile.mfa.totp.placeholder.label')}
                testId={`${props.prefix}.totp.wizard.label`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.hint.label')}</div>
          </div>
          {props.createIsError ? (
            <Alert variant="danger" title={t('profile.mfa.totp.wizard.create_failed')}>
              {formatErrorMessage(props.createError)}
            </Alert>
          ) : null}
        </div>
      ) : props.step === 2 ? (
        <div className="space-y-4">
          <div className="text-sm text-muted">{t('profile.mfa.totp.wizard.step2.help')}</div>

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.provisioning_uri')}</div>
            <div className="mt-1">
              <SecretField value={String(props.created?.provisioning_uri ?? '')} testId={`${props.prefix}.totp.wizard.uri`} />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.provisioning_uri_hint')}</div>
            {props.created?.provisioning_uri ? (
              <div className="mt-2 text-xs">
                <a className="underline text-accent" href={String(props.created.provisioning_uri)} data-testid={`${props.prefix}.totp.wizard.uri_link`}>
                  {t('profile.mfa.totp.wizard.open_in_authenticator')}
                </a>
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.secret')}</div>
            <div className="mt-1">
              <SecretField value={String(props.created?.secret ?? '')} testId={`${props.prefix}.totp.wizard.secret`} />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.secret_hint')}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.code')}</div>
            <div className="mt-1">
              <Input
                value={props.code}
                onChange={(e) => props.onCodeChange(e.target.value)}
                placeholder={t('profile.mfa.totp.placeholder.code')}
                testId={`${props.prefix}.totp.wizard.code`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.code_hint')}</div>
          </div>

          {props.confirmIsError ? (
            <Alert variant="danger" title={t('profile.mfa.totp.wizard.confirm_failed')}>
              {formatErrorMessage(props.confirmError)}
            </Alert>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="neutral" title={t('profile.mfa.totp.wizard.done_title')}>
            {t('profile.mfa.totp.wizard.done_body')}
          </Alert>

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.recovery_code')}</div>
            <div className="mt-1">
              <SecretField value={String(props.recovery ?? '')} testId={`${props.prefix}.totp.wizard.recovery`} />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.recovery_hint')}</div>
          </div>

          <SwitchRow
            label={t('profile.mfa.totp.wizard.ack_recovery')}
            checked={props.ackRecovery}
            onChange={props.onAckRecoveryChange}
            testId={`${props.prefix}.totp.wizard.ack`}
          />
        </div>
      )}
    </Modal>
  );
}

export function UserTotpConfirmExistingModal(props: {
  prefix: string;
  confirming: null | { id: number; label: string };
  step: TotpConfirmExistingStep;
  code: string;
  onCodeChange: (value: string) => void;
  recovery: string | null;
  ackRecovery: boolean;
  onAckRecoveryChange: (value: boolean) => void;
  pending: boolean;
  isError: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={props.confirming !== null}
      title={t('profile.mfa.totp.confirm_existing.title')}
      onClose={() => {
        if (props.pending) return;
        if (props.step === 'recovery' && !props.ackRecovery) return;
        props.onClose();
      }}
      testId={`${props.prefix}.totp.confirm_existing`}
    >
      {props.step === 'code' ? (
        <div className="space-y-4">
          <div className="text-sm text-muted">{t('profile.mfa.totp.confirm_existing.help')}</div>

          {props.confirming ? (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted">{t('profile.mfa.totp.confirm_existing.device')}</div>
              <Badge variant="neutral">{props.confirming.label || `#${props.confirming.id}`}</Badge>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.code')}</div>
            <div className="mt-1">
              <Input
                value={props.code}
                onChange={(e) => props.onCodeChange(e.target.value)}
                placeholder={t('profile.mfa.totp.placeholder.code')}
                testId={`${props.prefix}.totp.confirm_existing.code`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.code_hint')}</div>
          </div>

          {props.isError ? (
            <Alert variant="danger" title={t('profile.mfa.totp.wizard.confirm_failed')}>
              {formatErrorMessage(props.error)}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={props.onClose} disabled={props.pending} testId={`${props.prefix}.totp.confirm_existing.cancel`}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="warn"
              size="sm"
              onClick={props.onConfirm}
              disabled={props.pending || !looksLikeTotpCode(props.code)}
              loading={props.pending}
              testId={`${props.prefix}.totp.confirm_existing.confirm`}
            >
              {t('profile.mfa.totp.wizard.confirm')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="neutral" title={t('profile.mfa.totp.wizard.done_title')}>
            {t('profile.mfa.totp.wizard.done_body')}
          </Alert>

          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.recovery_code')}</div>
            <div className="mt-1">
              <SecretField value={String(props.recovery ?? '')} testId={`${props.prefix}.totp.confirm_existing.recovery`} />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.recovery_hint')}</div>
          </div>

          <SwitchRow
            label={t('profile.mfa.totp.wizard.ack_recovery')}
            checked={props.ackRecovery}
            onChange={props.onAckRecoveryChange}
            testId={`${props.prefix}.totp.confirm_existing.ack`}
          />

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                if (!props.ackRecovery) return;
                props.onClose();
              }}
              disabled={!props.ackRecovery}
              testId={`${props.prefix}.totp.confirm_existing.done`}
            >
              {t('common.done')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function UserTotpEditModal(props: {
  prefix: string;
  open: boolean;
  label: string;
  onLabelChange: (value: string) => void;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  pending: boolean;
  isError: boolean;
  error: unknown;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (props.pending) return;
        props.onClose();
      }}
      title={t('profile.mfa.totp.edit.title')}
      testId={`${props.prefix}.totp.edit`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} disabled={props.pending} testId={`${props.prefix}.totp.edit.cancel`}>
            {t('common.cancel')}
          </Button>
          <Button onClick={props.onSave} loading={props.pending} testId={`${props.prefix}.totp.edit.save`}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.field.label')}</div>
          <div className="mt-1">
            <Input
              value={props.label}
              onChange={(e) => props.onLabelChange(e.target.value)}
              placeholder={t('profile.mfa.totp.placeholder.label')}
              testId={`${props.prefix}.totp.edit.label`}
            />
          </div>
        </div>

        <SwitchRow label={t('profile.mfa.totp.field.enabled')} checked={props.enabled} onChange={props.onEnabledChange} testId={`${props.prefix}.totp.edit.enabled`} />

        {props.isError ? (
          <Alert variant="danger" title={t('profile.mfa.totp.edit.save_failed')}>
            {formatErrorMessage(props.error)}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

export function UserTotpDeleteConfirmDialog(props: {
  prefix: string;
  deleteId: number | null;
  pending: boolean;
  isError: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      open={props.deleteId !== null}
      title={t('profile.mfa.totp.delete.title')}
      description={t('profile.mfa.totp.delete.body')}
      confirmLabel={t('common.delete')}
      danger
      confirmLoading={props.pending}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
      testId={`${props.prefix}.totp.delete.confirm`}
    >
      {props.isError ? (
        <div className="mt-2">
          <Alert variant="danger">{formatErrorMessage(props.error)}</Alert>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

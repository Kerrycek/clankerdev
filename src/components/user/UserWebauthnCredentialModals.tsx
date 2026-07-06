import React from 'react';

import { useI18n } from '../../app/i18n';

import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SwitchRow } from '../ui/SwitchRow';

export function UserWebauthnCreateModal(props: {
  open: boolean;
  label: string;
  canRegister: boolean;
  pending: boolean;
  isError: boolean;
  error: unknown;
  testIdPrefix: string;
  onLabelChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (props.pending) return;
        props.onClose();
      }}
      title={t('profile.mfa.webauthn.create.title')}
      testId={`${prefix}.webauthn.create`}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={props.onClose}
            disabled={props.pending}
            testId={`${prefix}.webauthn.create.cancel`}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={props.onSubmit}
            loading={props.pending}
            disabled={!props.canRegister}
            testId={`${prefix}.webauthn.create.submit`}
          >
            {t('profile.mfa.webauthn.create.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-muted">{t('profile.mfa.webauthn.create.help')}</div>

        <div>
          <div className="text-xs font-medium text-muted">{t('profile.mfa.webauthn.field.label')}</div>
          <div className="mt-1">
            <Input
              value={props.label}
              onChange={(e) => props.onLabelChange(e.target.value)}
              placeholder={t('profile.mfa.webauthn.placeholder.label')}
              testId={`${prefix}.webauthn.create.label`}
            />
          </div>
          <div className="mt-1 text-xs text-faint">{t('profile.mfa.webauthn.hint.label')}</div>
        </div>

        {props.isError ? (
          <Alert variant="danger" title={t('profile.mfa.webauthn.create.failed')}>
            {formatErrorMessage(props.error)}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

export function UserWebauthnEditModal(props: {
  open: boolean;
  label: string;
  enabled: boolean;
  pending: boolean;
  isError: boolean;
  error: unknown;
  testIdPrefix: string;
  onLabelChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (props.pending) return;
        props.onClose();
      }}
      title={t('profile.mfa.webauthn.edit.title')}
      testId={`${prefix}.webauthn.edit`}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={props.onClose}
            disabled={props.pending}
            testId={`${prefix}.webauthn.edit.cancel`}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={props.onSubmit} loading={props.pending} testId={`${prefix}.webauthn.edit.save`}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="text-xs font-medium text-muted">{t('profile.mfa.webauthn.field.label')}</div>
          <div className="mt-1">
            <Input
              value={props.label}
              onChange={(e) => props.onLabelChange(e.target.value)}
              placeholder={t('profile.mfa.webauthn.placeholder.label')}
              testId={`${prefix}.webauthn.edit.label`}
            />
          </div>
        </div>

        <SwitchRow
          label={t('profile.mfa.webauthn.field.enabled')}
          checked={props.enabled}
          onChange={props.onEnabledChange}
          testId={`${prefix}.webauthn.edit.enabled`}
        />

        {props.isError ? (
          <Alert variant="danger" title={t('profile.mfa.webauthn.edit.save_failed')}>
            {formatErrorMessage(props.error)}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

export function UserWebauthnDeleteDialog(props: {
  open: boolean;
  pending: boolean;
  isError: boolean;
  error: unknown;
  testIdPrefix: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <ConfirmDialog
      open={props.open}
      title={t('profile.mfa.webauthn.delete.title')}
      description={t('profile.mfa.webauthn.delete.body')}
      confirmLabel={t('common.delete')}
      danger
      confirmLoading={props.pending}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
      testId={`${prefix}.webauthn.delete.confirm`}
    >
      {props.isError ? (
        <div className="mt-2">
          <Alert variant="danger">{formatErrorMessage(props.error)}</Alert>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

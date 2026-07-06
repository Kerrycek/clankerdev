import React from 'react';

import { useI18n } from '../../app/i18n';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function UserKnownDeviceForgetDialog(props: {
  open: boolean;
  loading: boolean;
  error: unknown;
  testIdPrefix: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      open={props.open}
      title={t('profile.security.known_devices.forget.title')}
      description={t('profile.security.known_devices.forget.body')}
      confirmLabel={t('profile.security.known_devices.action.forget')}
      danger
      confirmLoading={props.loading}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
      testId={`${props.testIdPrefix}.known_devices.forget.confirm`}
    >
      {props.error ? (
        <div className="mt-2">
          <Alert variant="danger">{formatErrorMessage(props.error)}</Alert>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

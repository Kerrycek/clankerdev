import React from 'react';

import { useI18n } from '../../app/i18n';
import type { UserSession } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

import {
  isUserSessionAccessToken,
  userSessionDisplayLabel,
} from './UserSessionsModel';

export function UserSessionRenameDialog(props: {
  open: boolean;
  label: string;
  error: string | null;
  saving: boolean;
  testIdPrefix: string;
  onLabelChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title={t('profile.sessions.rename.title')}
      testId={`${prefix}.rename_modal`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={props.onCancel} testId={`${prefix}.rename_modal.cancel`}>
            {t('common.cancel')}
          </Button>
          <Button onClick={props.onSave} loading={props.saving} testId={`${prefix}.rename_modal.save`}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      {props.error ? (
        <Alert variant="danger" title={t('profile.sessions.rename.failed')}>
          {props.error}
        </Alert>
      ) : null}

      <div className={props.error ? 'mt-4 space-y-3' : 'space-y-3'}>
        <div>
          <div className="text-sm font-medium">{t('profile.sessions.rename.field')}</div>
          <div className="mt-1">
            <Input
              value={props.label}
              onChange={(e) => props.onLabelChange(e.target.value)}
              placeholder={t('profile.sessions.rename.placeholder')}
              testId={`${prefix}.rename_modal.label`}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function UserSessionCloseDialog(props: {
  session: UserSession | null;
  closing: boolean;
  testIdPrefix: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const session = props.session;
  const isAccessToken = session ? isUserSessionAccessToken(session) : false;

  return (
    <ConfirmDialog
      open={session !== null}
      onCancel={props.onCancel}
      title={t('profile.sessions.close.title')}
      description={t('profile.sessions.close.description')}
      confirmLabel={t('profile.sessions.action.close')}
      danger
      confirmLoading={props.closing}
      onConfirm={props.onConfirm}
      testId={`${props.testIdPrefix}.close_dialog`}
    >
      {session ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted" data-testid={`${props.testIdPrefix}.close_dialog.review`}>
            <div>{t('profile.sessions.close.review_label', { label: userSessionDisplayLabel(session) })}</div>
            <div className="mt-1">
              {t('profile.sessions.close.review_last', {
                last: session.last_request_at ? formatDateTime(session.last_request_at) : '—',
              })}
            </div>
            {session.token_fragment ? (
              <div className="mt-1 font-mono text-xs">{t('profile.sessions.close.review_fragment', { fragment: session.token_fragment })}</div>
            ) : null}
          </div>

          {isAccessToken ? (
            <Alert variant="warn" title={t('profile.sessions.close.token_warning.title')}>
              {t('profile.sessions.close.token_warning.body')}
            </Alert>
          ) : null}

          {session.current ? (
            <Alert variant="danger" title={t('profile.sessions.close.current_warning.title')}>
              {t('profile.sessions.close.current_warning.body')}
            </Alert>
          ) : null}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

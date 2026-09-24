import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSearchParams } from 'react-router-dom';
import { getRuntimeConfig } from '../../app/config';
import { hardAssign } from '../../lib/browserNavigation';

import { useI18n } from '../../app/i18n';

import {
  deleteUserWebauthnCredential,
  fetchUserWebauthnCredentials,
  updateUserWebauthnCredential,
  type UserWebauthnCredential,
} from '../../lib/api/userDossier';

import { isWebauthnSupported } from '../../lib/webauthn';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';

import {
  buildWebauthnUpdatePayload,
  canStartWebauthnRegistration,
  isSecureWebauthnContext,
  sortWebauthnCredentialsByIdDesc,
} from './UserWebauthnCredentialsModel';
import {
  UserWebauthnDeleteDialog,
  UserWebauthnEditModal,
} from './UserWebauthnCredentialModals';
import { UserWebauthnCredentialsList } from './UserWebauthnCredentialsList';

export function UserWebauthnCredentialsPanel(props: {
  userId: number;
  /** Allow registration (current user only). */
  allowRegistration: boolean;
  /** Test id prefix, e.g. "profile.mfa" or "admin.user.mfa" */
  testIdPrefix: string;
}) {
  const { t, lang } = useI18n();
  const cfg = getRuntimeConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [registrationStatus] = useState(() => searchParams.get('registerStatus'));
  useEffect(() => {
    if (!props.allowRegistration || !searchParams.has('registerStatus')) return;
    const clean = new URLSearchParams(searchParams);
    clean.delete('registerStatus');
    clean.delete('registerMessage');
    setSearchParams(clean, { replace: true });
  }, [props.allowRegistration, searchParams, setSearchParams]);
  const qc = useQueryClient();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editing, setEditing] = useState<UserWebauthnCredential | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  // Only the BFF's own OAuth session can be handed off. Token sessions (including
  // impersonation) must never register a key for the underlying operator.
  const handoffAvailable = cfg.auth.kind === 'oauth2' && cfg.passkeyRegistrationUrl === '/oauth/passkey';

  const canRegister = canStartWebauthnRegistration({
    allowRegistration: props.allowRegistration && handoffAvailable,
    supported: isWebauthnSupported(),
    secureContext: isSecureWebauthnContext(),
  });

  const openCreate = () => {
    if (canRegister) hardAssign(`/oauth/passkey?lang=${lang}`);
  };

  const openEdit = (credential: UserWebauthnCredential) => {
    saveEditM.reset();
    setEditing(credential);
    setEditLabel(String(credential.label ?? ''));
    setEditEnabled(Boolean(credential.enabled));
  };

  const closeEdit = () => {
    saveEditM.reset();
    setEditing(null);
    setEditLabel('');
    setEditEnabled(true);
  };

  const credsQ = useQuery({
    queryKey: ['users', props.userId, 'webauthn_credentials'],
    queryFn: async () => (await fetchUserWebauthnCredentials(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const credsSorted = useMemo(() => sortWebauthnCredentialsByIdDesc(credsQ.data), [credsQ.data]);

  const invalidateWebauthnState = async () => {
    await qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
    await qc.invalidateQueries({ queryKey: ['users', props.userId] });
    await qc.invalidateQueries({ queryKey: ['user', 'current'] });
  };

  const saveEditM = useMutation({
    mutationFn: async () => {
      if (!editing) return;

      const next = buildWebauthnUpdatePayload(editLabel, editEnabled);
      if (!next.valid || !next.payload) throw new Error(t('profile.mfa.webauthn.validation.label_required'));

      return updateUserWebauthnCredential(props.userId, editing.id, next.payload);
    },
    onSuccess: async () => {
      await invalidateWebauthnState();
      closeEdit();
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteUserWebauthnCredential(props.userId, id),
    onSuccess: async () => {
      await invalidateWebauthnState();
      setDeleteId(null);
    },
  });

  const openDelete = (id: number) => {
    delM.reset();
    setDeleteId(id);
  };

  const closeDelete = () => {
    delM.reset();
    setDeleteId(null);
  };

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.webauthn.card`}>
        <CardHeader
          title={t('profile.mfa.webauthn.title')}
          subtitle={props.allowRegistration ? t('profile.mfa.webauthn.subtitle') : t('profile.mfa.webauthn.subtitle_admin')}
          actions={
            props.allowRegistration ? (
              <Button onClick={openCreate} disabled={!canRegister} testId={`${prefix}.webauthn.add`}>
                {t('profile.mfa.webauthn.add')}
              </Button>
            ) : null
          }
        />

        <CardBody>
          {props.allowRegistration && registrationStatus !== null ? (
            <Alert variant={registrationStatus === '1' ? 'info' : 'warn'} testId={`${prefix}.webauthn.return`}>
              {t(registrationStatus === '1' ? 'profile.mfa.webauthn.handoff.returned' : 'profile.mfa.webauthn.handoff.failed')}
            </Alert>
          ) : null}
          {props.allowRegistration && !canRegister ? (
            <Alert variant="warn" title={t('profile.mfa.webauthn.unsupported.title')}>
              {t(handoffAvailable ? 'profile.mfa.webauthn.unsupported.body' : 'profile.mfa.webauthn.handoff.unavailable')}
            </Alert>
          ) : null}

          {credsQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : credsQ.isError ? (
            <Alert variant="danger" title={t('profile.mfa.webauthn.load_failed')}>
              {formatErrorMessage(credsQ.error)}
            </Alert>
          ) : credsSorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.webauthn.empty`}>
              {t('profile.mfa.webauthn.empty')}
            </div>
          ) : (
            <UserWebauthnCredentialsList
              credentials={credsSorted}
              testIdPrefix={prefix}
              onEdit={openEdit}
              onDelete={openDelete}
            />
          )}
        </CardBody>
      </Card>

      <UserWebauthnEditModal
        open={editing !== null}
        label={editLabel}
        enabled={editEnabled}
        pending={saveEditM.isPending}
        isError={saveEditM.isError}
        error={saveEditM.error}
        testIdPrefix={prefix}
        onLabelChange={setEditLabel}
        onEnabledChange={setEditEnabled}
        onClose={closeEdit}
        onSubmit={() => saveEditM.mutate()}
      />

      <UserWebauthnDeleteDialog
        open={deleteId !== null}
        pending={delM.isPending}
        isError={delM.isError}
        error={delM.error}
        testIdPrefix={prefix}
        onCancel={closeDelete}
        onConfirm={() => {
          if (deleteId === null) return;
          delM.mutate(deleteId);
        }}
      />
    </>
  );
}

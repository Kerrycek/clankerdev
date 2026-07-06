import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  beginWebauthnRegistration,
  deleteUserWebauthnCredential,
  fetchUserWebauthnCredentials,
  finishWebauthnRegistration,
  updateUserWebauthnCredential,
  type UserWebauthnCredential,
} from '../../lib/api/userDossier';

import { creationOptionsFromJson, credentialToJson, isWebauthnSupported } from '../../lib/webauthn';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';

import {
  buildWebauthnUpdatePayload,
  canStartWebauthnRegistration,
  isNamedDomError,
  isSecureWebauthnContext,
  parseWebauthnRegistrationBegin,
  sortWebauthnCredentialsByIdDesc,
  validateWebauthnLabel,
} from './UserWebauthnCredentialsModel';
import {
  UserWebauthnCreateModal,
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
  const { t } = useI18n();
  const qc = useQueryClient();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editing, setEditing] = useState<UserWebauthnCredential | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');

  const canRegister = canStartWebauthnRegistration({
    allowRegistration: props.allowRegistration,
    supported: isWebauthnSupported(),
    secureContext: isSecureWebauthnContext(),
  });

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateLabel('');
  };

  const openEdit = (credential: UserWebauthnCredential) => {
    setEditing(credential);
    setEditLabel(String(credential.label ?? ''));
    setEditEnabled(Boolean(credential.enabled));
  };

  const closeEdit = () => {
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

  const registerM = useMutation({
    mutationFn: async () => {
      if (!canRegister) throw new Error(t('profile.mfa.webauthn.validation.not_supported'));

      const labelResult = validateWebauthnLabel(createLabel);
      if (!labelResult.valid) throw new Error(t('profile.mfa.webauthn.validation.label_required'));

      const beginRes = await beginWebauthnRegistration();
      const begin = parseWebauthnRegistrationBegin(beginRes.data);
      if (!begin) throw new Error(t('profile.mfa.webauthn.validation.bad_begin'));

      const options = creationOptionsFromJson(begin.optionsJson);

      let credential: PublicKeyCredential | null = null;
      try {
        credential = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential | null;
      } catch (error) {
        // User cancellation typically rejects with NotAllowedError.
        if (isNamedDomError(error, 'NotAllowedError')) {
          throw new Error(t('profile.mfa.webauthn.validation.cancelled'));
        }
        throw error;
      }

      if (!credential) throw new Error(t('profile.mfa.webauthn.validation.cancelled'));

      const credentialJson = await credentialToJson(credential);

      await finishWebauthnRegistration({
        challenge_token: begin.challengeToken,
        label: labelResult.label,
        public_key_credential: credentialJson,
      });
    },
    onSuccess: async () => {
      await invalidateWebauthnState();
      closeCreate();
    },
  });

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

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.webauthn.card`}>
        <CardHeader
          title={t('profile.mfa.webauthn.title')}
          subtitle={props.allowRegistration ? t('profile.mfa.webauthn.subtitle') : t('profile.mfa.webauthn.subtitle_admin')}
          actions={
            props.allowRegistration ? (
              <Button onClick={() => setCreateOpen(true)} disabled={!canRegister} testId={`${prefix}.webauthn.add`}>
                {t('profile.mfa.webauthn.add')}
              </Button>
            ) : null
          }
        />

        <CardBody>
          {props.allowRegistration && !canRegister ? (
            <Alert variant="warn" title={t('profile.mfa.webauthn.unsupported.title')}>
              {t('profile.mfa.webauthn.unsupported.body')}
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
              onDelete={setDeleteId}
            />
          )}
        </CardBody>
      </Card>

      <UserWebauthnCreateModal
        open={createOpen}
        label={createLabel}
        canRegister={canRegister}
        pending={registerM.isPending}
        isError={registerM.isError}
        error={registerM.error}
        testIdPrefix={prefix}
        onLabelChange={setCreateLabel}
        onClose={closeCreate}
        onSubmit={() => registerM.mutate()}
      />

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
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return;
          delM.mutate(deleteId);
        }}
      />
    </>
  );
}

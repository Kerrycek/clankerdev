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

import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { SwitchRow } from '../ui/SwitchRow';
import { Table } from '../ui/Table';

function sortByIdDesc<T extends { id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

function badgeForCred(c: UserWebauthnCredential): { variant: 'ok' | 'neutral'; label: string } {
  return c.enabled ? { variant: 'ok', label: 'enabled' } : { variant: 'neutral', label: 'disabled' };
}

function secureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as LegacyAny).isSecureContext);
}

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

  // Edit modal
  const [editing, setEditing] = useState<UserWebauthnCredential | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');

  const canRegister = props.allowRegistration && isWebauthnSupported() && secureContext();

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateLabel('');
  };

  const openEdit = (c: UserWebauthnCredential) => {
    setEditing(c);
    setEditLabel(String(c.label ?? ''));
    setEditEnabled(Boolean(c.enabled));
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

  const credsSorted = useMemo(() => sortByIdDesc(credsQ.data ?? []), [credsQ.data]);

  const registerM = useMutation({
    mutationFn: async () => {
      if (!canRegister) throw new Error(t('profile.mfa.webauthn.validation.not_supported'));
      const label = createLabel.trim();
      if (!label) throw new Error(t('profile.mfa.webauthn.validation.label_required'));

      const beginRes = await beginWebauthnRegistration();
      const challengeToken = (beginRes.data as LegacyAny)?.challenge_token;
      const optionsJson = (beginRes.data as LegacyAny)?.options;

      if (!challengeToken || !optionsJson) {
        throw new Error(t('profile.mfa.webauthn.validation.bad_begin'));
      }

      const options = creationOptionsFromJson(optionsJson);

      let cred: PublicKeyCredential | null = null;
      try {
        cred = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential | null;
      } catch (e) {
        // User cancellation typically rejects with NotAllowedError.
        const name = (e as LegacyAny)?.name;
        if (name === 'NotAllowedError') {
          throw new Error(t('profile.mfa.webauthn.validation.cancelled'));
        }
        throw e;
      }

      if (!cred) {
        throw new Error(t('profile.mfa.webauthn.validation.cancelled'));
      }

      const credJson = await credentialToJson(cred);

      await finishWebauthnRegistration({
        challenge_token: String(challengeToken),
        label,
        public_key_credential: credJson,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      closeCreate();
    },
  });

  const saveEditM = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const label = editLabel.trim();
      if (!label) throw new Error(t('profile.mfa.webauthn.validation.label_required'));
      return updateUserWebauthnCredential(props.userId, editing.id, { label, enabled: editEnabled });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      closeEdit();
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteUserWebauthnCredential(props.userId, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'webauthn_credentials'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
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
              <Button
                onClick={() => setCreateOpen(true)}
                disabled={!canRegister}
                testId={`${prefix}.webauthn.add`}
              >
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
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {credsSorted.map((c) => {
                  const b = badgeForCred(c);
                  return (
                    <div
                      key={c.id}
                      data-testid={`${prefix}.webauthn.row.${c.id}`}
                      className="rounded-md border border-border bg-surface-2 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{c.label ?? `#${c.id}`}</div>
                          <div className="mt-0.5 text-xs text-faint">#{c.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={b.variant}>{t(`profile.mfa.webauthn.badge.${b.label}`)}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted">
                        <div>
                          {t('profile.mfa.webauthn.field.last_use')}: {c.last_use_at ? formatDateTime(c.last_use_at) : '—'}
                        </div>
                        <div>
                          {t('profile.mfa.webauthn.field.use_count')}: {typeof c.use_count === 'number' ? String(c.use_count) : '—'}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(c)}
                          testId={`${prefix}.webauthn.row.${c.id}.edit`}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteId(c.id)}
                          testId={`${prefix}.webauthn.row.${c.id}.delete`}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table minWidth="md" testId={`${prefix}.webauthn.table`}>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('profile.mfa.webauthn.table.label')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.webauthn.table.status')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.webauthn.table.last_use')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.webauthn.table.use_count')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.webauthn.table.created')}</th>
                      <th className="px-4 py-2 text-right">{t('profile.mfa.webauthn.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credsSorted.map((c) => {
                      const b = badgeForCred(c);
                      return (
                        <tr
                          key={c.id}
                          className="border-b border-border/60 last:border-b-0"
                          data-testid={`${prefix}.webauthn.row.${c.id}`}
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-fg">{c.label ?? `#${c.id}`}</div>
                            <div className="text-xs text-faint">#{c.id}</div>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={b.variant}>{t(`profile.mfa.webauthn.badge.${b.label}`)}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {c.last_use_at ? formatDateTime(c.last_use_at) : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {typeof c.use_count === 'number' ? String(c.use_count) : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {c.created_at ? formatDateTime(c.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEdit(c)}
                                testId={`${prefix}.webauthn.row.${c.id}.edit`}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setDeleteId(c.id)}
                                testId={`${prefix}.webauthn.row.${c.id}.delete`}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (registerM.isPending) return;
          closeCreate();
        }}
        title={t('profile.mfa.webauthn.create.title')}
        testId={`${prefix}.webauthn.create`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={registerM.isPending}
              testId={`${prefix}.webauthn.create.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => registerM.mutate()}
              loading={registerM.isPending}
              disabled={!canRegister}
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
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder={t('profile.mfa.webauthn.placeholder.label')}
                testId={`${prefix}.webauthn.create.label`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('profile.mfa.webauthn.hint.label')}</div>
          </div>

          {registerM.isError ? (
            <Alert variant="danger" title={t('profile.mfa.webauthn.create.failed')}>
              {formatErrorMessage(registerM.error)}
            </Alert>
          ) : null}
        </div>
      </Modal>

      {/* Edit */}
      <Modal
        open={editing !== null}
        onClose={() => {
          if (saveEditM.isPending) return;
          closeEdit();
        }}
        title={t('profile.mfa.webauthn.edit.title')}
        testId={`${prefix}.webauthn.edit`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeEdit}
              disabled={saveEditM.isPending}
              testId={`${prefix}.webauthn.edit.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveEditM.mutate()}
              loading={saveEditM.isPending}
              testId={`${prefix}.webauthn.edit.save`}
            >
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
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder={t('profile.mfa.webauthn.placeholder.label')}
                testId={`${prefix}.webauthn.edit.label`}
              />
            </div>
          </div>

          <SwitchRow
            label={t('profile.mfa.webauthn.field.enabled')}
            checked={editEnabled}
            onChange={(v) => setEditEnabled(v)}
            testId={`${prefix}.webauthn.edit.enabled`}
          />

          {saveEditM.isError ? (
            <Alert variant="danger" title={t('profile.mfa.webauthn.edit.save_failed')}>
              {formatErrorMessage(saveEditM.error)}
            </Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t('profile.mfa.webauthn.delete.title')}
        description={t('profile.mfa.webauthn.delete.body')}
        confirmLabel={t('common.delete')}
        danger
        confirmLoading={delM.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return;
          delM.mutate(deleteId);
        }}
        testId={`${prefix}.webauthn.delete.confirm`}
      >
        {delM.isError ? (
          <div className="mt-2">
            <Alert variant="danger">{formatErrorMessage(delM.error)}</Alert>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

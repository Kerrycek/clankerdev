import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  createUserPublicKey,
  deleteUserPublicKey,
  fetchUserPublicKeys,
  updateUserPublicKey,
  type UserPublicKey,
} from '../../lib/api/userDossier';

import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';
import { keyFingerprint } from '../../lib/ssh';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { SwitchRow } from '../ui/SwitchRow';

function sortKeys(keys: UserPublicKey[]): UserPublicKey[] {
  return [...keys].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

export function UserPublicKeysPanel(props: {
  userId: number;
  /** Test id prefix, e.g. "profile.keys" or "admin.user.keys" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [editingKey, setEditingKey] = useState<UserPublicKey | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<number | null>(null);

  const [formLabel, setFormLabel] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formAutoAdd, setFormAutoAdd] = useState(true);

  const openCreate = () => {
    setEditingKey(null);
    setFormLabel('');
    setFormKey('');
    setFormAutoAdd(true);
    setModalOpen(true);
  };

  const openEdit = (k: UserPublicKey) => {
    setEditingKey(k);
    setFormLabel(String(k.label ?? ''));
    setFormKey('');
    setFormAutoAdd(Boolean(k.auto_add));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingKey(null);
    setFormLabel('');
    setFormKey('');
    setFormAutoAdd(true);
  };

  const keysQ = useQuery({
    queryKey: ['user_public_keys', props.userId],
    queryFn: async () => (await fetchUserPublicKeys(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const keysSorted = useMemo(() => sortKeys(keysQ.data ?? []), [keysQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      const label = formLabel.trim();
      if (!label) throw new Error(t('profile.keys.validation.label_required'));

      if (!editingKey) {
        const body = formKey.trim();
        if (!body) throw new Error(t('profile.keys.validation.key_required'));

        return createUserPublicKey(props.userId, {
          label,
          key: body,
          auto_add: formAutoAdd,
        });
      }

      // Update
      const payload: { label?: string; key?: string; auto_add?: boolean } = {
        label,
        auto_add: formAutoAdd,
      };

      const body = formKey.trim();
      if (body) payload.key = body;

      return updateUserPublicKey(props.userId, editingKey.id, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user_public_keys', props.userId] });
      closeModal();
    },
  });

  const delM = useMutation({
    mutationFn: async (keyId: number) => deleteUserPublicKey(props.userId, keyId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user_public_keys', props.userId] });
      setDeleteKeyId(null);
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.card`}>
        <CardHeader
          title={t('profile.keys.title')}
          subtitle={t('profile.keys.subtitle')}
          actions={
            <Button onClick={openCreate} testId={`${prefix}.add`}>
              {t('profile.keys.add')}
            </Button>
          }
        />

        <CardBody>
          {keysQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : keysQ.isError ? (
            <Alert variant="danger" title={t('profile.keys.load_failed')}>
              {formatErrorMessage(keysQ.error)}
            </Alert>
          ) : keysSorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.empty`}>
              {t('profile.keys.empty')}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {keysSorted.map((k) => (
                  <div
                    key={k.id}
                    data-testid={`${prefix}.row.${k.id}`}
                    className="rounded-md border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{k.label ?? `#${k.id}`}</div>
                        <div className="mt-0.5 text-xs text-faint">#{k.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {k.auto_add ? <Badge variant="neutral">{t('profile.keys.badge.auto_add')}</Badge> : null}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted">
                      {keyFingerprint(k) ? (
                        <span className="break-all">{keyFingerprint(k)}</span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(k)}
                        testId={`${prefix}.row.${k.id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteKeyId(k.id)}
                        testId={`${prefix}.row.${k.id}.delete`}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table minWidth="md" testId={`${prefix}.table`}>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('profile.keys.table.label')}</th>
                      <th className="px-4 py-2">{t('profile.keys.table.fingerprint')}</th>
                      <th className="px-4 py-2">{t('profile.keys.table.auto_add')}</th>
                      <th className="px-4 py-2">{t('profile.keys.table.created')}</th>
                      <th className="px-4 py-2 text-right">{t('profile.keys.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keysSorted.map((k) => (
                      <tr
                        key={k.id}
                        className="border-b border-border/60 last:border-b-0"
                        data-testid={`${prefix}.row.${k.id}`}
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium text-fg">{k.label ?? `#${k.id}`}</div>
                          <div className="text-xs text-faint">#{k.id}</div>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">
                          {keyFingerprint(k) ? (
                            <span className="break-all">{keyFingerprint(k)}</span>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {k.auto_add ? (
                            <Badge variant="neutral">{t('profile.keys.badge.auto_add')}</Badge>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">
                          {k.created_at ? formatDateTime(k.created_at) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEdit(k)}
                              testId={`${prefix}.row.${k.id}.edit`}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setDeleteKeyId(k.id)}
                              testId={`${prefix}.row.${k.id}.delete`}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (saveM.isPending) return;
          closeModal();
        }}
        title={editingKey ? t('profile.keys.modal.edit_title') : t('profile.keys.modal.create_title')}
        testId={`${prefix}.modal`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (saveM.isPending) return;
                closeModal();
              }}
              testId={`${prefix}.modal.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveM.mutate()}
              loading={saveM.isPending}
              testId={`${prefix}.modal.save`}
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {saveM.isError ? (
          <Alert variant="danger" title={t('profile.keys.modal.save_failed')}>
            {formatErrorMessage(saveM.error)}
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium">{t('profile.keys.field.label')}</div>
            <div className="mt-1">
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={t('profile.keys.field.label.placeholder')}
                testId={`${prefix}.modal.label`}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">{t('profile.keys.field.key')}</div>
            <div className="mt-1 text-xs text-muted">
              {t('profile.keys.field.key.help')}
              {editingKey ? ` ${t('profile.keys.field.key.keep_existing')}` : null}
            </div>
            <div className="mt-2">
              <Textarea
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder={t('profile.keys.field.key.placeholder')}
                rows={4}
                testId={`${prefix}.modal.key`}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <SwitchRow
            checked={formAutoAdd}
            onChange={setFormAutoAdd}
            label={t('profile.keys.field.auto_add.label')}
            description={t('profile.keys.field.auto_add.help')}
            testId={`${prefix}.modal.auto_add`}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteKeyId !== null}
        onCancel={() => {
          if (delM.isPending) return;
          setDeleteKeyId(null);
        }}
        title={t('profile.keys.delete.title')}
        description={t('profile.keys.delete.description')}
        confirmLabel={t('common.delete')}
        danger
        confirmLoading={delM.isPending}
        onConfirm={() => {
          if (!deleteKeyId) return;
          delM.mutate(deleteKeyId);
        }}
        testId={`${prefix}.delete_dialog`}
      />
    </>
  );
}

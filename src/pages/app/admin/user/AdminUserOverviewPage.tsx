import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../../components/ui/Drawer';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { LifecyclePanel } from '../../../../components/lifetimes/LifecyclePanel';

import { deleteUser, updateUser } from '../../../../lib/api/users';
import { formatDateTime } from '../../../../lib/format';

import { useAdminUserContext } from './AdminUserLayout';

interface EditUserDraft {
  fullName: string;
  email: string;
  address: string;
  level: string;
  info: string;
  mailerEnabled: boolean;
}

function makeEditDraft(u: Record<string, unknown>): EditUserDraft {
  return {
    fullName: typeof u['full_name'] === 'string' ? u['full_name'] : '',
    email: typeof u['email'] === 'string' ? u['email'] : '',
    address: typeof u['address'] === 'string' ? u['address'] : '',
    level: typeof u['level'] === 'number' && Number.isFinite(u['level']) ? String(u['level']) : '',
    info: typeof u['info'] === 'string' ? u['info'] : '',
    mailerEnabled: u['mailer_enabled'] !== false,
  };
}

export function AdminUserOverviewPage() {
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();
  const { user: u, refetch } = useAdminUserContext();
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EditUserDraft>(() => makeEditDraft(u));
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteState, setDeleteState] = useState('deleted');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openEdit = () => {
    setEditDraft(makeEditDraft(u));
    setEditError(null);
    setEditOpen(true);
  };

  const setEditField = <K extends keyof EditUserDraft>(key: K, value: EditUserDraft[K]) => {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
    if (editError) setEditError(null);
  };

  const buildEditPayload = (): Record<string, unknown> | null => {
    const level = Number(editDraft.level);
    if (!Number.isFinite(level) || level < 0) {
      setEditError(t('admin.user.edit.validation.level'));
      return null;
    }

    return {
      full_name: editDraft.fullName.trim() || undefined,
      email: editDraft.email.trim() || undefined,
      address: editDraft.address.trim() || undefined,
      level,
      info: editDraft.info.trim() || undefined,
      mailer_enabled: editDraft.mailerEnabled,
    };
  };

  const editM = useMutation({
    mutationFn: async () => {
      const payload = buildEditPayload();
      if (!payload) throw new Error('validation');
      return updateUser(u.id, payload);
    },
    onSuccess: async () => {
      setEditOpen(false);
      setEditError(null);
      toasts.pushToast({ variant: 'ok', title: t('admin.user.edit.toast.saved') });
      await refetch();
    },
    onError: (err: any) => {
      if (String(err?.message ?? '') === 'validation') return;
      setEditError(String(err?.message ?? err));
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => deleteUser(u.id, { object_state: deleteState || undefined }),
    onMutate: () => setDeleteError(null),
    onSuccess: () => {
      setDeleteOpen(false);
      setDeleteError(null);
      navigate('/admin/users');
    },
    onError: (err: any) => setDeleteError(String(err?.message ?? err)),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card testId="admin.user.details.card">
        <CardHeader
          title={t('common.details')}
          actions={
            <Button variant="secondary" size="sm" onClick={openEdit} testId="admin.user.edit.open">
              {t('admin.user.edit.open')}
            </Button>
          }
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">{t('requests.field.full_name')}</div>
              <div className="text-sm">{u.full_name ?? t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.email')}</div>
              <div className="text-sm">{u.email ?? t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.level')}</div>
              <div className="text-sm">{u.level}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.edit.field.mailer_enabled')}</div>
              <div className="text-sm">{u.mailer_enabled === false ? t('common.disabled') : t('common.enabled')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.created')}</div>
              <div className="text-sm">{u.created_at ? formatDateTime(u.created_at) : t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.last_activity')}</div>
              <div className="text-sm">{u.last_activity_at ? formatDateTime(u.last_activity_at) : t('common.na')}</div>
            </div>
            {u.address ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-muted">{t('admin.user.field.address')}</div>
                <div className="text-sm whitespace-pre-wrap">{u.address}</div>
              </div>
            ) : null}
            {typeof (u as any).info === 'string' && String((u as any).info).trim() ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-muted">{t('admin.user.edit.field.info')}</div>
                <div className="text-sm whitespace-pre-wrap">{String((u as any).info)}</div>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <LifecyclePanel
        kind="user"
        id={u.id}
        objectLabel={u.login}
        objectState={(u as any).object_state as any}
        expirationDate={(u as any).expiration_date as any}
        remindAfterDate={(u as any).remind_after_date as any}
        onUpdated={refetch}
        testId="admin.user.lifecycle"
      />

      <Card testId="admin.user.danger.card" className="lg:col-span-2">
        <CardHeader title={t('admin.user.danger.title')} subtitle={t('admin.user.danger.subtitle')} />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)} testId="admin.user.delete.open">
            {t('admin.user.delete.open')}
          </Button>
        </CardBody>
      </Card>

      <Drawer
        open={editOpen}
        onClose={() => {
          if (editM.isPending) return;
          setEditOpen(false);
          setEditError(null);
        }}
        title={t('admin.user.edit.title')}
        width="lg"
        side="right"
        testId="admin.user.edit.drawer"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditError(null);
              }}
              disabled={editM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => editM.mutate()}
              loading={editM.isPending}
              testId="admin.user.edit.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {editError ? (
            <Alert variant="danger" title={t('admin.user.edit.error')}>
              {editError}
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">{t('requests.field.full_name')}</span>
              <Input
                value={editDraft.fullName}
                onChange={(e) => setEditField('fullName', e.target.value)}
                testId="admin.user.edit.full_name"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">{t('admin.user.field.email')}</span>
              <Input
                type="email"
                value={editDraft.email}
                onChange={(e) => setEditField('email', e.target.value)}
                testId="admin.user.edit.email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">{t('admin.user.field.level')}</span>
              <Input
                value={editDraft.level}
                onChange={(e) => setEditField('level', e.target.value)}
                inputMode="numeric"
                testId="admin.user.edit.level"
              />
            </label>

            <SwitchRow
              checked={editDraft.mailerEnabled}
              onChange={(checked) => setEditField('mailerEnabled', checked)}
              label={t('admin.user.edit.field.mailer_enabled')}
              description={t('admin.user.edit.field.mailer_enabled.help')}
              testId="admin.user.edit.mailer_enabled"
            />

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('admin.user.field.address')}</span>
              <Input
                value={editDraft.address}
                onChange={(e) => setEditField('address', e.target.value)}
                testId="admin.user.edit.address"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('admin.user.edit.field.info')}</span>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                value={editDraft.info}
                onChange={(e) => setEditField('info', e.target.value)}
                data-testid="admin.user.edit.info"
              />
            </label>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title={t('admin.user.delete.title')}
        description={t('admin.user.delete.description', { login: u.login })}
        danger
        confirmLabel={t('admin.user.delete.confirm')}
        confirmLoading={deleteM.isPending}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => deleteM.mutate()}
        testId="admin.user.delete.confirm"
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">{t('admin.user.delete.field.object_state')}</span>
            <Select
              value={deleteState}
              onChange={(e) => setDeleteState(e.target.value)}
              options={[
                { value: 'deleted', label: t('admin.user.delete.object_state.deleted') },
                { value: 'suspended', label: t('admin.user.delete.object_state.suspended') },
              ]}
              testId="admin.user.delete.object_state"
            />
          </label>
          {deleteError ? (
            <Alert variant="danger" title={t('admin.user.delete.error')}>
              {deleteError}
            </Alert>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}

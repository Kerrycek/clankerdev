import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';

import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Select } from '../../../../components/ui/Select';
import { LifecyclePanel } from '../../../../components/lifetimes/LifecyclePanel';

import { deleteUser } from '../../../../lib/api/users';
import { formatDateTime } from '../../../../lib/format';

import { useAdminUserContext } from './AdminUserLayout';

export function AdminUserOverviewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user: u, refetch } = useAdminUserContext();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteState, setDeleteState] = useState('deleted');
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        <CardHeader title={t('common.details')} />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.email')}</div>
              <div className="text-sm">{u.email ?? t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t('admin.user.field.level')}</div>
              <div className="text-sm">{u.level}</div>
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

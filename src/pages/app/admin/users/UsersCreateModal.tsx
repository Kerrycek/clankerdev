import React from 'react';

import { Button } from '../../../../components/ui/Button';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

import type { CreateUserDraft } from './UsersModel';
import type { UsersPageTranslator } from './userListSemantics';

export type UpdateCreateUserDraft = <K extends keyof CreateUserDraft>(key: K, value: CreateUserDraft[K]) => void;

interface UsersCreateModalProps {
  open: boolean;
  draft: CreateUserDraft;
  error: string | null;
  pending: boolean;
  t: UsersPageTranslator;
  onChange: UpdateCreateUserDraft;
  onClose: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function UsersCreateModal({
  open,
  draft,
  error,
  pending,
  t,
  onChange,
  onClose,
  onCancel,
  onSubmit,
}: UsersCreateModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (pending) return;
        onClose();
      }}
      title={t('admin.users.create.title')}
      size="lg"
      testId="admin.users.create.modal"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={pending} testId="admin.users.create.submit">
            {t('admin.users.create.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.login')}</span>
            <Input
              value={draft.login}
              onChange={(e) => onChange('login', e.target.value)}
              autoComplete="off"
              testId="admin.users.create.login"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.level')}</span>
            <Input
              value={draft.level}
              onChange={(e) => onChange('level', e.target.value)}
              inputMode="numeric"
              testId="admin.users.create.level"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.password')}</span>
            <Input
              type="password"
              value={draft.password}
              onChange={(e) => onChange('password', e.target.value)}
              autoComplete="new-password"
              testId="admin.users.create.password"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.password2')}</span>
            <Input
              type="password"
              value={draft.password2}
              onChange={(e) => onChange('password2', e.target.value)}
              autoComplete="new-password"
              testId="admin.users.create.password2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.full_name')}</span>
            <Input
              value={draft.fullName}
              onChange={(e) => onChange('fullName', e.target.value)}
              testId="admin.users.create.full_name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.email')}</span>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => onChange('email', e.target.value)}
              testId="admin.users.create.email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('admin.users.create.field.monthly_payment')}</span>
            <Input
              value={draft.monthlyPayment}
              onChange={(e) => onChange('monthlyPayment', e.target.value)}
              inputMode="decimal"
              testId="admin.users.create.monthly_payment"
            />
          </label>

          <Checkbox
            checked={draft.mailerEnabled}
            onChange={(checked) => onChange('mailerEnabled', checked)}
            label={t('admin.users.create.field.mailer_enabled')}
            testId="admin.users.create.mailer_enabled"
          />

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">{t('admin.users.create.field.address')}</span>
            <Input
              value={draft.address}
              onChange={(e) => onChange('address', e.target.value)}
              testId="admin.users.create.address"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">{t('admin.users.create.field.info')}</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
              value={draft.info}
              onChange={(e) => onChange('info', e.target.value)}
              data-testid="admin.users.create.info"
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}

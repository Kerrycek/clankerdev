import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  confirmUserTotpDevice,
  createUserTotpDevice,
  deleteUserTotpDevice,
  fetchUserTotpDevices,
  updateUserTotpDevice,
  type UserTotpDevice,
  type UserTotpDeviceCreateResponse,
} from '../../lib/api/userDossier';

import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SecretField } from '../ui/SecretField';
import { Spinner } from '../ui/Spinner';
import { SwitchRow } from '../ui/SwitchRow';
import { Table } from '../ui/Table';

function sortByIdDesc<T extends { id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

function badgeForDevice(d: UserTotpDevice): { label: string; variant: 'ok' | 'warn' | 'neutral' } {
  if (d.confirmed && d.enabled) return { label: 'active', variant: 'ok' };
  if (!d.confirmed) return { label: 'unconfirmed', variant: 'warn' };
  return { label: 'disabled', variant: 'neutral' };
}

function looksLikeTotpCode(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  return /^\d{6}$/.test(s);
}

export function UserTotpDevicesPanel(props: {
  userId: number;
  /** Allow the user to create+confirm new TOTP devices (only makes sense for the current user). */
  allowCreate: boolean;
  /** Test id prefix, e.g. "profile.mfa" or "admin.user.mfa" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<UserTotpDevice | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  // Create wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardLabel, setWizardLabel] = useState('');
  const [wizardCreated, setWizardCreated] = useState<UserTotpDeviceCreateResponse | null>(null);
  const [wizardCode, setWizardCode] = useState('');
  const [wizardRecovery, setWizardRecovery] = useState<string | null>(null);
  const [wizardAckRecovery, setWizardAckRecovery] = useState(false);

  // Confirm an existing (unconfirmed) device
  const [confirming, setConfirming] = useState<null | { id: number; label: string }>(null);
  const [confirmExistingStep, setConfirmExistingStep] = useState<'code' | 'recovery'>('code');
  const [confirmExistingCode, setConfirmExistingCode] = useState('');
  const [confirmExistingRecovery, setConfirmExistingRecovery] = useState<string | null>(null);
  const [confirmExistingAck, setConfirmExistingAck] = useState(false);


  const confirmExistingM = useMutation({
    mutationFn: async () => {
      if (!confirming) throw new Error(t('profile.mfa.totp.confirm_existing.no_device'));
      if (!looksLikeTotpCode(confirmExistingCode)) {
        throw new Error(t('profile.mfa.totp.validation.code_invalid'));
      }

      const res = await confirmUserTotpDevice(props.userId, confirming.id, { code: confirmExistingCode.trim() });
      const recovery = (res.data as any)?.recovery_code;
      if (!recovery) throw new Error(t('profile.mfa.totp.validation.recovery_missing'));
      return String(recovery);
    },
    onSuccess: async (recovery) => {
      setConfirmExistingRecovery(recovery);
      setConfirmExistingStep('recovery');
      setConfirmExistingAck(false);

      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
    },
  });

  const closeConfirmExisting = () => {
    setConfirming(null);
    setConfirmExistingStep('code');
    setConfirmExistingCode('');
    setConfirmExistingRecovery(null);
    setConfirmExistingAck(false);
    confirmExistingM.reset();
  };

  const openConfirmExisting = (d: any) => {
    setConfirming({ id: Number(d.id), label: String(d.label ?? '') });
    setConfirmExistingStep('code');
    setConfirmExistingCode('');
    setConfirmExistingRecovery(null);
    setConfirmExistingAck(false);
    confirmExistingM.reset();
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setWizardLabel('');
    setWizardCreated(null);
    setWizardCode('');
    setWizardRecovery(null);
    setWizardAckRecovery(false);
  };

  const openCreate = () => {
    setWizardOpen(true);
    setWizardStep(1);
    setWizardLabel('');
    setWizardCreated(null);
    setWizardCode('');
    setWizardRecovery(null);
    setWizardAckRecovery(false);
  };

  const openEdit = (d: UserTotpDevice) => {
    setEditing(d);
    setEditLabel(String(d.label ?? ''));
    setEditEnabled(Boolean(d.enabled));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditLabel('');
    setEditEnabled(true);
  };

  const devicesQ = useQuery({
    queryKey: ['users', props.userId, 'totp_devices'],
    queryFn: async () => (await fetchUserTotpDevices(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const devicesSorted = useMemo(() => sortByIdDesc(devicesQ.data ?? []), [devicesQ.data]);

  const createM = useMutation({
    mutationFn: async () => {
      const label = wizardLabel.trim();
      if (!label) throw new Error(t('profile.mfa.totp.validation.label_required'));
      return createUserTotpDevice(props.userId, { label });
    },
    onSuccess: (res) => {
      setWizardCreated(res.data);
      setWizardStep(2);
    },
  });

  const confirmM = useMutation({
    mutationFn: async () => {
      if (!wizardCreated) throw new Error('Missing wizard device');
      const code = wizardCode.trim();
      if (!looksLikeTotpCode(code)) throw new Error(t('profile.mfa.totp.validation.code_invalid'));
      return confirmUserTotpDevice(props.userId, wizardCreated.id, { code });
    },
    onSuccess: async (res) => {
      setWizardRecovery(String(res.data ?? ''));
      setWizardStep(3);
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
    },
  });

  const saveEditM = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const label = editLabel.trim();
      if (!label) throw new Error(t('profile.mfa.totp.validation.label_required'));
      return updateUserTotpDevice(props.userId, editing.id, { label, enabled: editEnabled });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      closeEdit();
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteUserTotpDevice(props.userId, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      setDeleteId(null);
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.totp.card`}>
        <CardHeader
          title={t('profile.mfa.totp.title')}
          subtitle={props.allowCreate ? t('profile.mfa.totp.subtitle') : t('profile.mfa.totp.subtitle_admin')}
          actions={
            props.allowCreate ? (
              <Button onClick={openCreate} testId={`${prefix}.totp.add`}>
                {t('profile.mfa.totp.add')}
              </Button>
            ) : null
          }
        />

        <CardBody>
          {devicesQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : devicesQ.isError ? (
            <Alert variant="danger" title={t('profile.mfa.totp.load_failed')}>
              {formatErrorMessage(devicesQ.error)}
            </Alert>
          ) : devicesSorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.totp.empty`}>
              {t('profile.mfa.totp.empty')}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {devicesSorted.map((d) => {
                  const b = badgeForDevice(d);
                  return (
                    <div
                      key={d.id}
                      data-testid={`${prefix}.totp.row.${d.id}`}
                      className="rounded-md border border-border bg-surface-2 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{d.label ?? `#${d.id}`}</div>
                          <div className="mt-0.5 text-xs text-faint">#{d.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={b.variant}>{t(`profile.mfa.totp.badge.${b.label}`)}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted">
                        <div>
                          {t('profile.mfa.totp.field.last_use')}: {d.last_use_at ? formatDateTime(d.last_use_at) : '—'}
                        </div>
                        <div>
                          {t('profile.mfa.totp.field.use_count')}: {typeof d.use_count === 'number' ? String(d.use_count) : '—'}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {!d.confirmed ? (
                          <Button
                            variant="warn"
                            size="sm"
                            onClick={() => openConfirmExisting(d)}
                            testId={`${prefix}.totp.row.${d.id}.confirm`}
                          >
                            {t('profile.mfa.totp.wizard.confirm')}
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(d)}
                          testId={`${prefix}.totp.row.${d.id}.edit`}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteId(d.id)}
                          testId={`${prefix}.totp.row.${d.id}.delete`}
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
                <Table minWidth="md" testId={`${prefix}.totp.table`}>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('profile.mfa.totp.table.label')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.totp.table.status')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.totp.table.last_use')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.totp.table.use_count')}</th>
                      <th className="px-4 py-2">{t('profile.mfa.totp.table.created')}</th>
                      <th className="px-4 py-2 text-right">{t('profile.mfa.totp.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devicesSorted.map((d) => {
                      const b = badgeForDevice(d);
                      return (
                        <tr
                          key={d.id}
                          className="border-b border-border/60 last:border-b-0"
                          data-testid={`${prefix}.totp.row.${d.id}`}
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-fg">{d.label ?? `#${d.id}`}</div>
                            <div className="text-xs text-faint">#{d.id}</div>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={b.variant}>{t(`profile.mfa.totp.badge.${b.label}`)}</Badge>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {d.last_use_at ? formatDateTime(d.last_use_at) : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {typeof d.use_count === 'number' ? String(d.use_count) : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted tabular-nums">
                            {d.created_at ? formatDateTime(d.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              {!d.confirmed ? (
                                <Button
                                  variant="warn"
                                  size="sm"
                                  onClick={() => openConfirmExisting(d)}
                                  testId={`${prefix}.totp.row.${d.id}.confirm`}
                                >
                                  {t('profile.mfa.totp.wizard.confirm')}
                                </Button>
                              ) : null}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEdit(d)}
                                testId={`${prefix}.totp.row.${d.id}.edit`}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setDeleteId(d.id)}
                                testId={`${prefix}.totp.row.${d.id}.delete`}
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

      {/* Create wizard */}
      <Modal
        open={wizardOpen}
        onClose={() => {
          if (createM.isPending || confirmM.isPending) return;
          if (wizardStep === 3 && !wizardAckRecovery) return;
          closeWizard();
        }}
        title={t('profile.mfa.totp.wizard.title')}
        testId={`${prefix}.totp.wizard`}
        footer={
          wizardStep === 1 ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={closeWizard}
                disabled={createM.isPending}
                testId={`${prefix}.totp.wizard.cancel`}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => createM.mutate()}
                loading={createM.isPending}
                testId={`${prefix}.totp.wizard.create`}
              >
                {t('common.continue')}
              </Button>
            </div>
          ) : wizardStep === 2 ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={closeWizard}
                disabled={confirmM.isPending}
                testId={`${prefix}.totp.wizard.close`}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => confirmM.mutate()}
                loading={confirmM.isPending}
                testId={`${prefix}.totp.wizard.confirm`}
              >
                {t('profile.mfa.totp.wizard.confirm')}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  if (!wizardAckRecovery) return;
                  closeWizard();
                }}
                disabled={!wizardAckRecovery}
                testId={`${prefix}.totp.wizard.done`}
              >
                {t('common.done')}
              </Button>
            </div>
          )
        }
      >
        {wizardStep === 1 ? (
          <div className="space-y-3">
            <div className="text-sm text-muted">{t('profile.mfa.totp.wizard.step1.help')}</div>
            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.field.label')}</div>
              <div className="mt-1">
                <Input
                  value={wizardLabel}
                  onChange={(e) => setWizardLabel(e.target.value)}
                  placeholder={t('profile.mfa.totp.placeholder.label')}
                  testId={`${prefix}.totp.wizard.label`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.hint.label')}</div>
            </div>
            {createM.isError ? (
              <Alert variant="danger" title={t('profile.mfa.totp.wizard.create_failed')}>
                {formatErrorMessage(createM.error)}
              </Alert>
            ) : null}
          </div>
        ) : wizardStep === 2 ? (
          <div className="space-y-4">
            <div className="text-sm text-muted">{t('profile.mfa.totp.wizard.step2.help')}</div>

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.provisioning_uri')}</div>
              <div className="mt-1">
                <SecretField
                  value={String(wizardCreated?.provisioning_uri ?? '')}
                  testId={`${prefix}.totp.wizard.uri`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.provisioning_uri_hint')}</div>
              {wizardCreated?.provisioning_uri ? (
                <div className="mt-2 text-xs">
                  <a
                    className="underline text-accent"
                    href={String(wizardCreated.provisioning_uri)}
                    data-testid={`${prefix}.totp.wizard.uri_link`}
                  >
                    {t('profile.mfa.totp.wizard.open_in_authenticator')}
                  </a>
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.secret')}</div>
              <div className="mt-1">
                <SecretField value={String(wizardCreated?.secret ?? '')} testId={`${prefix}.totp.wizard.secret`} />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.secret_hint')}</div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.code')}</div>
              <div className="mt-1">
                <Input
                  value={wizardCode}
                  onChange={(e) => setWizardCode(e.target.value)}
                  placeholder={t('profile.mfa.totp.placeholder.code')}
                  testId={`${prefix}.totp.wizard.code`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.code_hint')}</div>
            </div>

            {confirmM.isError ? (
              <Alert variant="danger" title={t('profile.mfa.totp.wizard.confirm_failed')}>
                {formatErrorMessage(confirmM.error)}
              </Alert>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="neutral" title={t('profile.mfa.totp.wizard.done_title')}>
              {t('profile.mfa.totp.wizard.done_body')}
            </Alert>

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.recovery_code')}</div>
              <div className="mt-1">
                <SecretField value={String(wizardRecovery ?? '')} testId={`${prefix}.totp.wizard.recovery`} />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.recovery_hint')}</div>
            </div>

            <SwitchRow
              label={t('profile.mfa.totp.wizard.ack_recovery')}
              checked={wizardAckRecovery}
              onChange={(v) => setWizardAckRecovery(v)}
              testId={`${prefix}.totp.wizard.ack`}
            />
          </div>
        )}
      </Modal>



      <Modal
        open={confirming !== null}
        title={t('profile.mfa.totp.confirm_existing.title')}
        onClose={() => {
          if (confirmExistingM.isPending) return;
          if (confirmExistingStep === 'recovery' && !confirmExistingAck) return;
          closeConfirmExisting();
        }}
        testId={`${prefix}.totp.confirm_existing`}
      >
        {confirmExistingStep === 'code' ? (
          <div className="space-y-4">
            <div className="text-sm text-muted">{t('profile.mfa.totp.confirm_existing.help')}</div>

            {confirming ? (
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted">{t('profile.mfa.totp.confirm_existing.device')}</div>
                <Badge variant="neutral">{confirming.label || `#${confirming.id}`}</Badge>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.code')}</div>
              <div className="mt-1">
                <Input
                  value={confirmExistingCode}
                  onChange={(e) => setConfirmExistingCode(e.target.value)}
                  placeholder={t('profile.mfa.totp.placeholder.code')}
                  testId={`${prefix}.totp.confirm_existing.code`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.code_hint')}</div>
            </div>

            {confirmExistingM.isError ? (
              <Alert variant="danger" title={t('profile.mfa.totp.wizard.confirm_failed')}>
                {formatErrorMessage(confirmExistingM.error)}
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={closeConfirmExisting}
                disabled={confirmExistingM.isPending}
                testId={`${prefix}.totp.confirm_existing.cancel`}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="warn"
                size="sm"
                onClick={() => confirmExistingM.mutate()}
                disabled={confirmExistingM.isPending || !looksLikeTotpCode(confirmExistingCode)}
                loading={confirmExistingM.isPending}
                testId={`${prefix}.totp.confirm_existing.confirm`}
              >
                {t('profile.mfa.totp.wizard.confirm')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="neutral" title={t('profile.mfa.totp.wizard.done_title')}>
              {t('profile.mfa.totp.wizard.done_body')}
            </Alert>

            <div>
              <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.wizard.recovery_code')}</div>
              <div className="mt-1">
                <SecretField
                  value={String(confirmExistingRecovery ?? '')}
                  testId={`${prefix}.totp.confirm_existing.recovery`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.mfa.totp.wizard.recovery_hint')}</div>
            </div>

            <SwitchRow
              label={t('profile.mfa.totp.wizard.ack_recovery')}
              checked={confirmExistingAck}
              onChange={(v) => setConfirmExistingAck(v)}
              testId={`${prefix}.totp.confirm_existing.ack`}
            />

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  if (!confirmExistingAck) return;
                  closeConfirmExisting();
                }}
                disabled={!confirmExistingAck}
                testId={`${prefix}.totp.confirm_existing.done`}
              >
                {t('common.done')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => {
          if (saveEditM.isPending) return;
          closeEdit();
        }}
        title={t('profile.mfa.totp.edit.title')}
        testId={`${prefix}.totp.edit`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeEdit}
              disabled={saveEditM.isPending}
              testId={`${prefix}.totp.edit.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveEditM.mutate()}
              loading={saveEditM.isPending}
              testId={`${prefix}.totp.edit.save`}
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-muted">{t('profile.mfa.totp.field.label')}</div>
            <div className="mt-1">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder={t('profile.mfa.totp.placeholder.label')}
                testId={`${prefix}.totp.edit.label`}
              />
            </div>
          </div>

          <SwitchRow
            label={t('profile.mfa.totp.field.enabled')}
            checked={editEnabled}
            onChange={(v) => setEditEnabled(v)}
            testId={`${prefix}.totp.edit.enabled`}
          />

          {saveEditM.isError ? (
            <Alert variant="danger" title={t('profile.mfa.totp.edit.save_failed')}>
              {formatErrorMessage(saveEditM.error)}
            </Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t('profile.mfa.totp.delete.title')}
        description={t('profile.mfa.totp.delete.body')}
        confirmLabel={t('common.delete')}
        danger
        confirmLoading={delM.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return;
          delM.mutate(deleteId);
        }}
        testId={`${prefix}.totp.delete.confirm`}
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

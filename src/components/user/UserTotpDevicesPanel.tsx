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

import { UserTotpDevicesCard } from './UserTotpDevicesCard';
import {
  UserTotpConfirmExistingModal,
  UserTotpCreateWizardModal,
  UserTotpDeleteConfirmDialog,
  UserTotpEditModal,
} from './UserTotpDeviceModals';
import { deviceLabel, looksLikeTotpCode, sortByIdDesc, type TotpConfirmExistingStep, type TotpWizardStep } from './UserTotpDevicesModel';

export function UserTotpDevicesPanel(props: {
  userId: number;
  /** Allow the user to create+confirm new TOTP devices (only makes sense for the current user). */
  allowCreate: boolean;
  /** Test id prefix, e.g. "profile.mfa" or "admin.user.mfa" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const prefix = props.testIdPrefix;

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<UserTotpDevice | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<TotpWizardStep>(1);
  const [wizardLabel, setWizardLabel] = useState('');
  const [wizardCreated, setWizardCreated] = useState<UserTotpDeviceCreateResponse | null>(null);
  const [wizardCode, setWizardCode] = useState('');
  const [wizardRecovery, setWizardRecovery] = useState<string | null>(null);
  const [wizardAckRecovery, setWizardAckRecovery] = useState(false);

  const [confirming, setConfirming] = useState<null | { id: number; label: string }>(null);
  const [confirmExistingStep, setConfirmExistingStep] = useState<TotpConfirmExistingStep>('code');
  const [confirmExistingCode, setConfirmExistingCode] = useState('');
  const [confirmExistingRecovery, setConfirmExistingRecovery] = useState<string | null>(null);
  const [confirmExistingAck, setConfirmExistingAck] = useState(false);

  const devicesQ = useQuery({
    queryKey: ['users', props.userId, 'totp_devices'],
    queryFn: async () => (await fetchUserTotpDevices(props.userId, { limit: 200 })).data,
    staleTime: 30_000,
  });

  const devicesSorted = useMemo(() => sortByIdDesc(devicesQ.data ?? []), [devicesQ.data]);

  const invalidateTotpQueries = async () => {
    await qc.invalidateQueries({ queryKey: ['users', props.userId, 'totp_devices'] });
    await qc.invalidateQueries({ queryKey: ['users', props.userId] });
    await qc.invalidateQueries({ queryKey: ['user', 'current'] });
  };

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
      await invalidateTotpQueries();
    },
  });

  const confirmExistingM = useMutation({
    mutationFn: async () => {
      if (!confirming) throw new Error(t('profile.mfa.totp.confirm_existing.no_device'));
      if (!looksLikeTotpCode(confirmExistingCode)) throw new Error(t('profile.mfa.totp.validation.code_invalid'));

      const res = await confirmUserTotpDevice(props.userId, confirming.id, { code: confirmExistingCode.trim() });
      const recovery = String(res.data ?? '');
      if (!recovery) throw new Error(t('profile.mfa.totp.validation.recovery_missing'));
      return recovery;
    },
    onSuccess: async (recovery) => {
      setConfirmExistingRecovery(recovery);
      setConfirmExistingStep('recovery');
      setConfirmExistingAck(false);
      await invalidateTotpQueries();
    },
  });

  const resetEditState = () => {
    setEditing(null);
    setEditLabel('');
    setEditEnabled(true);
  };

  const saveEditM = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const label = editLabel.trim();
      if (!label) throw new Error(t('profile.mfa.totp.validation.label_required'));
      return updateUserTotpDevice(props.userId, editing.id, { label, enabled: editEnabled });
    },
    onSuccess: async () => {
      await invalidateTotpQueries();
      resetEditState();
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => deleteUserTotpDevice(props.userId, id),
    onSuccess: async () => {
      await invalidateTotpQueries();
      setDeleteId(null);
    },
  });

  const resetConfirmExistingState = () => {
    setConfirming(null);
    setConfirmExistingStep('code');
    setConfirmExistingCode('');
    setConfirmExistingRecovery(null);
    setConfirmExistingAck(false);
  };

  const closeConfirmExisting = () => {
    resetConfirmExistingState();
    confirmExistingM.reset();
  };

  const openConfirmExisting = (device: UserTotpDevice) => {
    setConfirming({ id: device.id, label: deviceLabel(device) });
    setConfirmExistingStep('code');
    setConfirmExistingCode('');
    setConfirmExistingRecovery(null);
    setConfirmExistingAck(false);
    confirmExistingM.reset();
  };

  const resetWizardState = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setWizardLabel('');
    setWizardCreated(null);
    setWizardCode('');
    setWizardRecovery(null);
    setWizardAckRecovery(false);
  };

  const closeWizard = () => {
    resetWizardState();
    createM.reset();
    confirmM.reset();
  };

  const openCreate = () => {
    resetWizardState();
    setWizardOpen(true);
    createM.reset();
    confirmM.reset();
  };

  const openEdit = (device: UserTotpDevice) => {
    setEditing(device);
    setEditLabel(String(device.label ?? ''));
    setEditEnabled(device.enabled !== false);
    saveEditM.reset();
  };

  function closeEdit() {
    resetEditState();
    saveEditM.reset();
  }

  return (
    <>
      <UserTotpDevicesCard
        prefix={prefix}
        allowCreate={props.allowCreate}
        devices={devicesSorted}
        isLoading={devicesQ.isLoading}
        isError={devicesQ.isError}
        error={devicesQ.error}
        onCreate={openCreate}
        onConfirm={openConfirmExisting}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />

      <UserTotpCreateWizardModal
        prefix={prefix}
        open={wizardOpen}
        step={wizardStep}
        label={wizardLabel}
        onLabelChange={setWizardLabel}
        created={wizardCreated}
        code={wizardCode}
        onCodeChange={setWizardCode}
        recovery={wizardRecovery}
        ackRecovery={wizardAckRecovery}
        onAckRecoveryChange={setWizardAckRecovery}
        createPending={createM.isPending}
        createError={createM.error}
        createIsError={createM.isError}
        confirmPending={confirmM.isPending}
        confirmError={confirmM.error}
        confirmIsError={confirmM.isError}
        onCreate={() => createM.mutate()}
        onConfirm={() => confirmM.mutate()}
        onClose={closeWizard}
      />

      <UserTotpConfirmExistingModal
        prefix={prefix}
        confirming={confirming}
        step={confirmExistingStep}
        code={confirmExistingCode}
        onCodeChange={setConfirmExistingCode}
        recovery={confirmExistingRecovery}
        ackRecovery={confirmExistingAck}
        onAckRecoveryChange={setConfirmExistingAck}
        pending={confirmExistingM.isPending}
        isError={confirmExistingM.isError}
        error={confirmExistingM.error}
        onConfirm={() => confirmExistingM.mutate()}
        onClose={closeConfirmExisting}
      />

      <UserTotpEditModal
        prefix={prefix}
        open={editing !== null}
        label={editLabel}
        onLabelChange={setEditLabel}
        enabled={editEnabled}
        onEnabledChange={setEditEnabled}
        pending={saveEditM.isPending}
        isError={saveEditM.isError}
        error={saveEditM.error}
        onSave={() => saveEditM.mutate()}
        onClose={closeEdit}
      />

      <UserTotpDeleteConfirmDialog
        prefix={prefix}
        deleteId={deleteId}
        pending={delM.isPending}
        isError={delM.isError}
        error={delM.error}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId === null) return;
          delM.mutate(deleteId);
        }}
      />
    </>
  );
}

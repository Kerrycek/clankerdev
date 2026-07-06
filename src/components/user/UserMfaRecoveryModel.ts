import type {
  UserKnownDevice,
  UserTotpDevice,
  UserWebauthnCredential,
} from '../../lib/api/userDossier';
import type { User } from '../../lib/api/users';

import { isKnownDeviceMfaTrusted } from './UserKnownDevicesModel';
import { userBooleanField } from './UserSecurityModel';

export type MfaRecoveryStatus = 'disabled' | 'staged' | 'ready' | 'needs_factor' | 'single_path' | 'setup_pending';
export type MfaRecoveryChecklistKey = 'mfa_required' | 'active_factor' | 'backup_factor' | 'trusted_devices' | 'unfinished_setup';
export type MfaRecoveryTone = 'ok' | 'neutral' | 'info' | 'warn' | 'danger';

export interface MfaRecoveryCounts {
  enabledTotp: number;
  pendingTotp: number;
  disabledTotp: number;
  enabledPasskeys: number;
  disabledPasskeys: number;
  activeTrustedDevices: number;
  totalKnownDevices: number;
  activeFactors: number;
  recoveryPaths: number;
}

export interface MfaRecoveryChecklistItem {
  key: MfaRecoveryChecklistKey;
  tone: MfaRecoveryTone;
  messageKey: string;
}

export interface MfaRecoverySummary {
  mfaRequired: boolean;
  status: MfaRecoveryStatus;
  statusTone: MfaRecoveryTone;
  counts: MfaRecoveryCounts;
  checklist: MfaRecoveryChecklistItem[];
}

export interface MfaRecoveryInput {
  user?: User;
  totpDevices?: readonly UserTotpDevice[];
  webauthnCredentials?: readonly UserWebauthnCredential[];
  knownDevices?: readonly UserKnownDevice[];
  nowMs?: number;
}

function isConfirmedEnabledTotp(device: UserTotpDevice): boolean {
  return Boolean(device.confirmed && device.enabled);
}

function isPendingTotp(device: UserTotpDevice): boolean {
  return !device.confirmed;
}

function isDisabledTotp(device: UserTotpDevice): boolean {
  return Boolean(device.confirmed && !device.enabled);
}

function isEnabledPasskey(credential: UserWebauthnCredential): boolean {
  return Boolean(credential.enabled);
}

export function buildMfaRecoverySummary(input: MfaRecoveryInput): MfaRecoverySummary {
  const nowMs = input.nowMs ?? Date.now();
  const mfaRequired = userBooleanField(input.user, 'enable_multi_factor_auth', false);
  const totpDevices = input.totpDevices ?? [];
  const webauthnCredentials = input.webauthnCredentials ?? [];
  const knownDevices = input.knownDevices ?? [];

  const enabledTotp = totpDevices.filter(isConfirmedEnabledTotp).length;
  const pendingTotp = totpDevices.filter(isPendingTotp).length;
  const disabledTotp = totpDevices.filter(isDisabledTotp).length;
  const enabledPasskeys = webauthnCredentials.filter(isEnabledPasskey).length;
  const disabledPasskeys = webauthnCredentials.length - enabledPasskeys;
  const activeTrustedDevices = knownDevices.filter((device) => isKnownDeviceMfaTrusted(device, nowMs)).length;
  const activeFactors = enabledTotp + enabledPasskeys;
  const recoveryPaths = activeFactors;

  let status: MfaRecoveryStatus;
  if (!mfaRequired && activeFactors === 0) status = 'disabled';
  else if (!mfaRequired) status = 'staged';
  else if (activeFactors === 0 && pendingTotp > 0) status = 'setup_pending';
  else if (activeFactors === 0) status = 'needs_factor';
  else if (recoveryPaths < 2) status = 'single_path';
  else status = 'ready';

  const statusTone: MfaRecoveryTone =
    status === 'ready'
      ? 'ok'
      : status === 'disabled'
        ? 'neutral'
        : status === 'staged'
          ? 'info'
          : status === 'needs_factor'
            ? 'danger'
            : 'warn';

  const checklist: MfaRecoveryChecklistItem[] = [
    {
      key: 'mfa_required',
      tone: mfaRequired ? 'ok' : 'info',
      messageKey: mfaRequired ? 'profile.mfa.recovery.check.mfa_required.on' : 'profile.mfa.recovery.check.mfa_required.off',
    },
    {
      key: 'active_factor',
      tone: activeFactors > 0 ? 'ok' : 'danger',
      messageKey: activeFactors > 0 ? 'profile.mfa.recovery.check.active_factor.ok' : 'profile.mfa.recovery.check.active_factor.missing',
    },
    {
      key: 'backup_factor',
      tone: recoveryPaths >= 2 ? 'ok' : activeFactors > 0 ? 'warn' : 'neutral',
      messageKey:
        recoveryPaths >= 2
          ? 'profile.mfa.recovery.check.backup_factor.ok'
          : activeFactors > 0
            ? 'profile.mfa.recovery.check.backup_factor.single'
            : 'profile.mfa.recovery.check.backup_factor.missing',
    },
    {
      key: 'trusted_devices',
      tone: activeTrustedDevices > 0 ? 'info' : 'ok',
      messageKey:
        activeTrustedDevices > 0
          ? 'profile.mfa.recovery.check.trusted_devices.present'
          : 'profile.mfa.recovery.check.trusted_devices.none',
    },
    {
      key: 'unfinished_setup',
      tone: pendingTotp > 0 ? 'warn' : 'ok',
      messageKey:
        pendingTotp > 0
          ? 'profile.mfa.recovery.check.unfinished_setup.present'
          : 'profile.mfa.recovery.check.unfinished_setup.none',
    },
  ];

  return {
    mfaRequired,
    status,
    statusTone,
    counts: {
      enabledTotp,
      pendingTotp,
      disabledTotp,
      enabledPasskeys,
      disabledPasskeys,
      activeTrustedDevices,
      totalKnownDevices: knownDevices.length,
      activeFactors,
      recoveryPaths,
    },
    checklist,
  };
}

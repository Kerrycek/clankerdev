import { describe, expect, it } from 'vitest';

import type { UserKnownDevice, UserTotpDevice, UserWebauthnCredential } from '../../lib/api/userDossier';
import type { User } from '../../lib/api/users';

import { buildMfaRecoverySummary } from './UserMfaRecoveryModel';

const user = (mfa: boolean): User => ({ id: 1, login: 'alice', level: 1, enable_multi_factor_auth: mfa });
const nowMs = Date.parse('2026-07-04T12:00:00Z');

describe('UserMfaRecoveryModel', () => {
  it('detects disabled and setup-pending MFA states', () => {
    expect(buildMfaRecoverySummary({ user: user(false), nowMs })).toMatchObject({
      mfaRequired: false,
      status: 'disabled',
      statusTone: 'neutral',
      counts: { activeFactors: 0, recoveryPaths: 0 },
    });

    const pendingTotp: UserTotpDevice[] = [{ id: 7, confirmed: false, enabled: true }];
    expect(buildMfaRecoverySummary({ user: user(true), totpDevices: pendingTotp, nowMs })).toMatchObject({
      status: 'setup_pending',
      statusTone: 'warn',
      counts: { activeFactors: 0, pendingTotp: 1 },
    });
  });

  it('warns when required MFA has only one recovery path', () => {
    const totp: UserTotpDevice[] = [{ id: 1, confirmed: true, enabled: true }];

    const summary = buildMfaRecoverySummary({ user: user(true), totpDevices: totp, nowMs });

    expect(summary).toMatchObject({
      status: 'single_path',
      counts: { enabledTotp: 1, enabledPasskeys: 0, recoveryPaths: 1 },
    });
    expect(summary.checklist.find((item) => item.key === 'backup_factor')).toMatchObject({ tone: 'warn' });
  });

  it('marks MFA ready with two active factors and counts trusted devices', () => {
    const totp: UserTotpDevice[] = [{ id: 1, confirmed: true, enabled: true }];
    const passkeys: UserWebauthnCredential[] = [{ id: 2, enabled: true }];
    const knownDevices: UserKnownDevice[] = [
      { id: 3, skip_multi_factor_auth_until: '2026-07-05T12:00:00Z' },
      { id: 4, skip_multi_factor_auth_until: '2026-07-01T12:00:00Z' },
    ];

    expect(buildMfaRecoverySummary({ user: user(true), totpDevices: totp, webauthnCredentials: passkeys, knownDevices, nowMs })).toMatchObject({
      status: 'ready',
      statusTone: 'ok',
      counts: {
        activeFactors: 2,
        recoveryPaths: 2,
        activeTrustedDevices: 1,
        totalKnownDevices: 2,
      },
    });
  });
});

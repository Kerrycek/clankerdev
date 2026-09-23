// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserTotpCreateWizardModal } from './UserTotpDeviceModals';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

function renderProvisioningUri(provisioningUri: string) {
  return render(
    <UserTotpCreateWizardModal
      prefix="profile.mfa"
      open
      step={2}
      label="Phone"
      onLabelChange={() => undefined}
      created={{ id: 7, secret: 'SECRET123', provisioning_uri: provisioningUri }}
      code=""
      onCodeChange={() => undefined}
      recovery={null}
      ackRecovery={false}
      onAckRecoveryChange={() => undefined}
      createPending={false}
      createError={null}
      createIsError={false}
      confirmPending={false}
      confirmError={null}
      confirmIsError={false}
      onCreate={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
    />,
  );
}

describe('UserTotpCreateWizardModal provisioning URI', () => {
  it('opens a standard otpauth TOTP link', () => {
    const uri = 'otpauth://totp/alice?secret=SECRET123';
    renderProvisioningUri(uri);

    expect(screen.getByTestId('profile.mfa.totp.wizard.uri_link')).toHaveAttribute('href', uri);
    expect(screen.queryByTestId('profile.mfa.totp.wizard.uri_invalid')).not.toBeInTheDocument();
  });

  it('keeps an unexpected API URI visible for manual inspection without making it clickable', () => {
    renderProvisioningUri('javascript:alert(document.domain)');

    expect(screen.queryByTestId('profile.mfa.totp.wizard.uri_link')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile.mfa.totp.wizard.uri_invalid')).toBeVisible();
    expect(screen.getByTestId('profile.mfa.totp.wizard.uri')).toBeVisible();
  });
});

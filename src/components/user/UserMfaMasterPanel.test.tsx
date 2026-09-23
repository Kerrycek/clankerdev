// i18n-ignore-file
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../lib/api/users';
import { UserMfaMasterPanel } from './UserMfaMasterPanel';

const mocks = vi.hoisted(() => ({
  pushToast: vi.fn(),
  updateUser: vi.fn(),
  fetchTotpDevices: vi.fn(),
  fetchWebauthnCredentials: vi.fn(),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../lib/api/users', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/api/users')>();
  return {
    ...original,
    updateUser: mocks.updateUser,
  };
});

vi.mock('../../lib/api/userDossier', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/api/userDossier')>();
  return {
    ...original,
    fetchUserTotpDevices: mocks.fetchTotpDevices,
    fetchUserWebauthnCredentials: mocks.fetchWebauthnCredentials,
  };
});

const enabledUser: User = {
  id: 9,
  login: 'member',
  level: 1,
  enable_multi_factor_auth: true,
};

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserMfaMasterPanel
        userId={enabledUser.id}
        user={enabledUser}
        testIdPrefix="profile.mfa"
      />
    </QueryClientProvider>
  );
}

describe('UserMfaMasterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchTotpDevices.mockResolvedValue({ data: [] });
    mocks.fetchWebauthnCredentials.mockResolvedValue({ data: [] });
    mocks.updateUser.mockResolvedValue({ data: enabledUser });
  });

  it('does not disable MFA until the destructive confirmation is accepted', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByTestId('profile.mfa.mfa_master.disable_confirm')).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('profile.mfa.mfa_master.disable_confirm.cancel'));

    expect(screen.queryByTestId('profile.mfa.mfa_master.disable_confirm')).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('disables MFA only after confirmation and closes the dialog on success', async () => {
    renderPanel();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('profile.mfa.mfa_master.disable_confirm.confirm'));

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith(9, { enable_multi_factor_auth: false });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('profile.mfa.mfa_master.disable_confirm')).not.toBeInTheDocument();
    });
  });

  it('keeps a failed disable attempt in the dialog for retry', async () => {
    mocks.updateUser.mockRejectedValueOnce(new Error('request failed'));
    renderPanel();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('profile.mfa.mfa_master.disable_confirm.confirm'));

    expect(await screen.findByText('request failed')).toBeVisible();
    expect(screen.getByTestId('profile.mfa.mfa_master.disable_confirm')).toBeVisible();
    expect(screen.getByTestId('profile.mfa.mfa_master.disable_confirm.confirm')).toBeEnabled();
  });
});

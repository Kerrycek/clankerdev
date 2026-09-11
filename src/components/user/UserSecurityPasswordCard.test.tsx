// i18n-ignore-file
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserSecurityPasswordCard } from './UserSecurityPasswordCard';

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  generate: vi.fn(),
  pushToast: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../lib/api/users', () => ({
  updateUser: mocks.updateUser,
}));

vi.mock('../../lib/clipboard', () => ({
  copyTextToClipboard: mocks.copy,
}));

vi.mock('../../lib/passwordGeneration', () => ({
  generateSecurePassword: mocks.generate,
}));

const GENERATED_PASSWORD = 'aB2!cD3@eF4#gH5$iJ6%';

function renderCard(variant: 'admin' | 'profile' = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserSecurityPasswordCard
        userId={42}
        variant={variant}
        testIdPrefix={variant === 'admin' ? 'admin.user.security' : 'profile.security'}
      />
    </QueryClientProvider>
  );
}

describe('UserSecurityPasswordCard password generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReturnValue(GENERATED_PASSWORD);
    mocks.copy.mockResolvedValue(true);
    mocks.updateUser.mockResolvedValue({ data: { id: 42 } });
  });

  it('fills both admin password fields and immediately copies the generated password', async () => {
    renderCard();

    expect(screen.getByTestId('admin.user.security.password.save')).toBeDisabled();
    fireEvent.click(screen.getByTestId('admin.user.security.password.generate'));

    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(GENERATED_PASSWORD));
    expect(screen.getByTestId('admin.user.security.password.new')).toHaveValue(GENERATED_PASSWORD);
    expect(screen.getByTestId('admin.user.security.password.new2')).toHaveValue(GENERATED_PASSWORD);
    expect(screen.getByTestId('admin.user.security.password.save')).toBeEnabled();
    expect(screen.getByTestId('admin.user.security.password.copy')).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();

    const toast = mocks.pushToast.mock.calls.at(-1)?.[0];
    expect(toast).toEqual({
      variant: 'ok',
      title: 'security.password.generated.copied.title',
      body: 'security.password.generated.copied.body',
    });
    expect(JSON.stringify(toast)).not.toContain(GENERATED_PASSWORD);

    fireEvent.click(screen.getByTestId('admin.user.security.password.copy'));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledTimes(2));
    expect(mocks.copy).toHaveBeenLastCalledWith(GENERATED_PASSWORD);
  });

  it('keeps the generated password usable when clipboard copying fails', async () => {
    mocks.copy.mockResolvedValueOnce(false);
    renderCard();

    fireEvent.click(screen.getByTestId('admin.user.security.password.generate'));

    await waitFor(() => {
      expect(mocks.pushToast).toHaveBeenCalledWith({
        variant: 'warn',
        title: 'security.password.generated.copy_failed.title',
        body: 'security.password.generated.copy_failed.body',
      });
    });
    expect(screen.getByTestId('admin.user.security.password.new')).toHaveValue(GENERATED_PASSWORD);
    expect(screen.getByTestId('admin.user.security.password.new2')).toHaveValue(GENERATED_PASSWORD);
    expect(screen.getByTestId('admin.user.security.password.save')).toBeEnabled();
    expect(screen.getByTestId('admin.user.security.password.copy')).toBeVisible();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('fails closed when secure randomness is unavailable', async () => {
    mocks.generate.mockImplementationOnce(() => {
      throw new Error('crypto unavailable');
    });
    renderCard();

    fireEvent.click(screen.getByTestId('admin.user.security.password.generate'));

    await waitFor(() => {
      expect(mocks.pushToast).toHaveBeenCalledWith({
        variant: 'danger',
        title: 'security.password.generated.failed.title',
        body: 'security.password.generated.failed.body',
      });
    });
    expect(screen.getByTestId('admin.user.security.password.new')).toHaveValue('');
    expect(screen.getByTestId('admin.user.security.password.new2')).toHaveValue('');
    expect(screen.queryByTestId('admin.user.security.password.copy')).not.toBeInTheDocument();
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it('still requires the current password for a self-service password change', async () => {
    renderCard('profile');

    fireEvent.click(screen.getByTestId('profile.security.password.generate'));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(GENERATED_PASSWORD));

    expect(screen.getByTestId('profile.security.password.save')).toBeDisabled();
    fireEvent.change(screen.getByTestId('profile.security.password.current'), {
      target: { value: 'current-password' },
    });
    expect(screen.getByTestId('profile.security.password.save')).toBeEnabled();
  });
});

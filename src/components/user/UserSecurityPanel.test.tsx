// i18n-ignore-file
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserSecurityPanel } from './UserSecurityPanel';

const mocks = vi.hoisted(() => ({
  pushToast: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('../../app/config', () => ({
  getRuntimeConfig: () => ({ auth: { kind: 'basic' }, routerBasename: '/' }),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../app/appMode', () => ({
  useAppMode: () => ({ mode: 'admin' }),
}));

vi.mock('../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../lib/api/users', () => ({
  updateUser: mocks.updateUser,
}));

vi.mock('../../lib/auth/impersonation', () => ({
  clearImpersonationState: vi.fn(),
  isImpersonating: () => false,
  writeImpersonationState: vi.fn(),
}));

vi.mock('./UserSecurityPasswordCard', () => ({ UserSecurityPasswordCard: () => null }));
vi.mock('./UserSecurityPostureCard', () => ({ UserSecurityPostureCard: () => null }));
vi.mock('./UserSecuritySettingsCard', () => ({ UserSecuritySettingsCard: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function renderPanel(user: { id: number; login: string; level: number; lockout: boolean; password_reset: boolean }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <UserSecurityPanel userId={user.id} user={user} variant="admin" testIdPrefix="admin.user.security" />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('UserSecurityPanel account flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls an optimistic password-reset switch back when the API rejects the update', async () => {
    const request = deferred<{ data: { id: number } }>();
    mocks.updateUser.mockReturnValueOnce(request.promise);
    renderPanel({ id: 42, login: 'member', level: 20, lockout: false, password_reset: false });

    const passwordReset = screen.getByRole('checkbox', { name: /security\.flags\.password_reset\.label/ });
    expect(passwordReset).not.toBeChecked();

    fireEvent.click(passwordReset);
    await waitFor(() => expect(passwordReset).toBeChecked());
    expect(mocks.updateUser).toHaveBeenCalledWith(42, { password_reset: true });

    await act(async () => {
      request.reject(new Error('API rejected the flag'));
    });

    await waitFor(() => expect(passwordReset).not.toBeChecked());
    expect(mocks.pushToast).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'security.flags.toast.failed.title',
      body: 'API rejected the flag',
    });
  });

  it('keeps a rejected account lockout in its confirmation and allows an immediate retry', async () => {
    const rejectedRequest = deferred<{ data: { id: number } }>();
    const retryRequest = deferred<{ data: { id: number } }>();
    mocks.updateUser
      .mockReturnValueOnce(rejectedRequest.promise)
      .mockReturnValueOnce(retryRequest.promise);
    renderPanel({ id: 42, login: 'member', level: 20, lockout: false, password_reset: false });

    const lockout = screen.getByRole('checkbox', { name: /security\.flags\.lockout\.label/ });
    fireEvent.click(lockout);
    const dialog = screen.getByTestId('admin.user.security.flags.lockout.confirm');
    expect(dialog).toBeVisible();

    fireEvent.click(screen.getByTestId('admin.user.security.flags.lockout.confirm.confirm'));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith(42, { lockout: true }));

    await act(async () => {
      rejectedRequest.reject(new Error('Account is protected'));
    });

    await waitFor(() => expect(lockout).not.toBeChecked());
    expect(dialog).toBeVisible();
    expect(screen.getByTestId('admin.user.security.flags.lockout.confirm.error')).toHaveTextContent(
      'Account is protected'
    );

    fireEvent.click(screen.getByTestId('admin.user.security.flags.lockout.confirm.confirm'));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(2));

    await act(async () => {
      retryRequest.resolve({ data: { id: 42 } });
    });

    await waitFor(() => expect(screen.queryByTestId('admin.user.security.flags.lockout.confirm')).not.toBeInTheDocument());
    expect(lockout).toBeChecked();
  });
});

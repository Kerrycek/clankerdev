// i18n-ignore-file

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppShell } from './AppShell';

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authenticated' as 'anonymous' | 'expired' | 'loading' | 'authenticated' | 'forbidden' | 'error',
    user: { id: 1, login: 'alice', level: 1 },
    role: 'user',
    canUseAdminUi: false,
    loginUrl: '/login',
    logoutUrl: '/logout',
    error: undefined as unknown,
  },
}));

vi.mock('../../app/auth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      let out = key;
      for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, String(v));
      return out;
    },
  }),
}));

vi.mock('../../app/config', () => ({
  getRuntimeConfig: () => ({
    routerBasename: '',
    logoutUrl: undefined,
  }),
}));

vi.mock('./AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="mock.app-layout">{children}</div>,
}));

vi.mock('./SessionTokenKeepalive', () => ({
  SessionTokenKeepalive: () => <div data-testid="mock.session-keepalive" />,
}));

function setAuth(next: Partial<typeof mocks.auth>) {
  Object.assign(mocks.auth, next);
}

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app" element={<AppShell mode="user" />}>
          <Route index element={<div data-testid="route.app.dashboard" />} />
          <Route path="vps" element={<div data-testid="route.app.vps" />} />
        </Route>
        <Route path="/admin" element={<AppShell mode="admin" />}>
          <Route index element={<div data-testid="route.admin.dashboard" />} />
          <Route path="users" element={<div data-testid="route.admin.users" />} />
        </Route>
        <Route path="/" element={<div data-testid="route.public.status" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  setAuth({
    status: 'authenticated',
    user: { id: 1, login: 'alice', level: 1 },
    role: 'user',
    canUseAdminUi: false,
    loginUrl: '/login',
    logoutUrl: '/logout',
    error: undefined,
  });
});

describe('AppShell access gates', () => {
  test('blocks admin shell deep links for authenticated non-admin users before mounting app chrome', () => {
    renderShell('/admin/users');

    expect(screen.getByTestId('auth.admin-required')).toBeVisible();
    expect(screen.queryByTestId('mock.app-layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('route.admin.users')).not.toBeInTheDocument();
  });

  test('allows admin shell deep links for users with admin UI access', () => {
    setAuth({
      user: { id: 2, login: 'root', level: 5 },
      role: 'admin',
      canUseAdminUi: true,
    });

    renderShell('/admin/users');

    expect(screen.getByTestId('mock.session-keepalive')).toBeVisible();
    expect(screen.getByTestId('mock.app-layout')).toBeVisible();
    expect(screen.getByTestId('route.admin.users')).toBeVisible();
    expect(screen.queryByTestId('auth.admin-required')).not.toBeInTheDocument();
  });

  test('allows normal authenticated users into the user shell', () => {
    renderShell('/app/vps');

    expect(screen.getByTestId('mock.app-layout')).toBeVisible();
    expect(screen.getByTestId('route.app.vps')).toBeVisible();
    expect(screen.queryByTestId('auth.admin-required')).not.toBeInTheDocument();
  });

  test('shows the login-required state before either user or admin shell content mounts', () => {
    setAuth({
      status: 'anonymous',
      user: undefined,
      role: 'unknown',
      canUseAdminUi: false,
    });

    renderShell('/admin/users');

    expect(screen.getByTestId('auth.login-required')).toBeVisible();
    expect(screen.queryByTestId('mock.app-layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('route.admin.users')).not.toBeInTheDocument();
  });
});

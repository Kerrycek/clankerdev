import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const runtimeConfig = vi.hoisted(() => ({
  routerBasename: '',
}));

const authProviderProps = vi.hoisted(() => ({
  nextPath: '',
}));

vi.mock('../app/config', () => ({
  getRuntimeConfig: () => runtimeConfig,
}));

vi.mock('../app/auth', () => ({
  AuthProvider: ({ children, nextPath }: { children: React.ReactNode; nextPath: string }) => {
    authProviderProps.nextPath = nextPath;
    return <>{children}</>;
  },
}));

vi.mock('../app/uiSettings', () => ({
  UiSettingsProvider: ({
    children,
    serverSyncEnabled,
  }: {
    children: React.ReactNode;
    serverSyncEnabled?: boolean;
  }) => (
    <div data-testid="ui-settings-provider" data-server-sync={String(serverSyncEnabled)}>
      {children}
    </div>
  ),
}));

vi.mock('../app/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../app/i18n', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../app/toasts', () => ({
  ToastsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/layout/DocumentTitleManager', () => ({
  DocumentTitleManager: () => null,
}));

import { RouteProvidersLayout } from './RouteProvidersLayout';

function renderAt(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<RouteProvidersLayout />}>
          <Route path="*" element={<div data-testid="route.child" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RouteProvidersLayout', () => {
  it('does not use the expired-session status URL as the post-login target', () => {
    runtimeConfig.routerBasename = '';

    renderAt('/?session=expired');
    expect(authProviderProps.nextPath).toBe('/app');
  });

  it('keeps normal deep links as the post-login target', () => {
    runtimeConfig.routerBasename = '';

    renderAt('/admin/users?limit=50');
    expect(authProviderProps.nextPath).toBe('/admin/users?limit=50');
  });

  it('enables settings server sync for authenticated app routes', () => {
    runtimeConfig.routerBasename = '';

    renderAt('/app/vps');
    expect(screen.getByTestId('ui-settings-provider')).toHaveAttribute('data-server-sync', 'true');
  });

  it('enables settings server sync for authenticated admin routes', () => {
    runtimeConfig.routerBasename = '';

    renderAt('/admin/users');
    expect(screen.getByTestId('ui-settings-provider')).toHaveAttribute('data-server-sync', 'true');
  });

  it('disables settings server sync for public routes', () => {
    runtimeConfig.routerBasename = '';

    renderAt('/outages');
    expect(screen.getByTestId('ui-settings-provider')).toHaveAttribute('data-server-sync', 'false');
  });

  it('keeps the public route gate correct when a router basename is configured', () => {
    runtimeConfig.routerBasename = '/ui-next';

    renderAt('/ui-next/registration/correction');
    expect(screen.getByTestId('ui-settings-provider')).toHaveAttribute('data-server-sync', 'false');
  });
});

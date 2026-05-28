// i18n-ignore-file

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRuntimeConfig, type RuntimeConfig } from '../../app/config';
import { clearImpersonationState } from '../../lib/auth/impersonation';
import { completeOAuth2Login, startOAuth2Login } from '../../lib/auth/oauth2Client';
import { hardReplace } from '../../lib/browserNavigation';
import { clearStoredOAuthToken } from '../../lib/auth/tokenStore';
import { OAuthCallbackPage } from './OAuthCallbackPage';
import { OAuthLoginPage } from './OAuthLoginPage';
import { OAuthLogoutPage } from './OAuthLogoutPage';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tc: (key: string, count: number) => `${key}:${count}`,
    preferredLanguageCodes: ['en', 'cs'],
  }),
}));

vi.mock('../../app/config', () => ({
  getRuntimeConfig: vi.fn(),
}));

vi.mock('../../lib/auth/oauth2Client', () => ({
  startOAuth2Login: vi.fn(),
  completeOAuth2Login: vi.fn(),
}));

vi.mock('../../lib/browserNavigation', () => ({
  hardReplace: vi.fn(),
}));

vi.mock('../../lib/auth/tokenStore', () => ({
  clearStoredOAuthToken: vi.fn(),
}));

vi.mock('../../lib/auth/impersonation', () => ({
  clearImpersonationState: vi.fn(),
}));

function createRuntimeConfig(): RuntimeConfig {
  return {
    apiUrl: 'https://api.example.test',
    apiVersion: '7.0',
    apiBaseUrl: 'https://api.example.test/v7.0',
    routerBasename: '/ui-next',
    loginUrl: '/ui-next/oauth/login',
    logoutUrl: '/ui-next/oauth/logout',
    auth: { kind: 'none' },
    oauth2: {
      authorizeUrl: 'https://auth.example.test/oauth2/authorize',
      tokenUrl: 'https://auth.example.test/oauth2/token',
      clientId: 'webui-next-test-client',
      scope: 'all',
      redirectPath: '/ui-next/oauth/callback',
      type: 'web_server',
      flow: 'pkce',
      storage: 'session',
    },
    publicStatus: {
      ipv4Warn: 64,
      ipv4Critical: 16,
    },
    uiSettings: {
      persistence: 'local',
      server: {
        path: '/user_sessions/current/ui_setting',
        namespace: 'ui_setting',
        field: 'settings',
      },
    },
    haveApi: {},
  };
}

function renderRoute(pathname: string) {
  render(
    <MemoryRouter basename="/ui-next" initialEntries={[`/ui-next${pathname}`]}>
      <Routes>
        <Route path="/" element={<div data-testid="status.route" />} />
        <Route path="/app" element={<div data-testid="app.route" />} />
        <Route path="/oauth/login" element={<OAuthLoginPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/oauth/logout" element={<OAuthLogoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findVisibleText(text: string) {
  const els = await screen.findAllByText(text);
  const visible = els.find((el) => {
    try {
      expect(el).toBeVisible();
      return true;
    } catch {
      return false;
    }
  });
  expect(visible).toBeTruthy();
  return visible as HTMLElement;
}

describe('OAuth auth flow pages', () => {
  beforeEach(() => {
    vi.mocked(getRuntimeConfig).mockReturnValue(createRuntimeConfig());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('sanitizes login next targets and falls back to the basename-aware app root', async () => {
    vi.mocked(startOAuth2Login).mockResolvedValue(undefined);

    renderRoute('/oauth/login?next=https://evil.test/session-steal');

    await waitFor(() => {
      expect(startOAuth2Login).toHaveBeenCalledWith(createRuntimeConfig(), '/ui-next/app');
    });

    expect(screen.getByTestId('oauth.login.page')).toBeVisible();
  });

  it('renders the login error state with a basename-aware public link', async () => {
    vi.mocked(startOAuth2Login).mockRejectedValue(new Error('SSO unavailable'));

    renderRoute('/oauth/login?next=/ui-next/admin/users');

    expect(await findVisibleText('oauth.login.error.title')).toBeVisible();
    expect(startOAuth2Login).toHaveBeenCalledWith(createRuntimeConfig(), '/ui-next/admin/users');
    expect(screen.getByRole('link', { name: /nav.status/i })).toHaveAttribute('href', '/ui-next');
  });

  it('sanitizes callback redirects before performing the hard navigation', async () => {
    vi.mocked(completeOAuth2Login).mockResolvedValue({
      nextPath: 'https://evil.test/redirect',
    });

    renderRoute('/oauth/callback?code=abc&state=def');

    await waitFor(() => {
      expect(completeOAuth2Login).toHaveBeenCalledWith(createRuntimeConfig(), expect.any(String));
    });

    await waitFor(() => {
      expect(hardReplace).toHaveBeenCalledWith('/ui-next/app');
    });
  });

  it('renders the callback retry action with basename-aware login href', async () => {
    vi.mocked(completeOAuth2Login).mockRejectedValue(new Error('OAuth2 state mismatch'));

    renderRoute('/oauth/callback?code=abc&state=def');

    expect(await findVisibleText('oauth.callback.error.title')).toBeVisible();
    expect(screen.getByRole('link', { name: /oauth.callback.action.sign_in_again/i })).toHaveAttribute(
      'href',
      '/ui-next/oauth/login?next=%2Fui-next%2Fapp',
    );
  });

  it('clears auth state and falls back to the basename-aware public root on logout', async () => {
    renderRoute('/oauth/logout?next=https://evil.test/logout');

    await waitFor(() => {
      expect(clearStoredOAuthToken).toHaveBeenCalledWith('session');
    });

    expect(clearImpersonationState).toHaveBeenCalledWith(window.sessionStorage);
    expect(hardReplace).toHaveBeenCalledWith('/ui-next/');
  });

  it('shows the logout error state when local auth cleanup throws', async () => {
    vi.mocked(clearStoredOAuthToken).mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });

    renderRoute('/oauth/logout');

    expect(await findVisibleText('oauth.logout.error.title')).toBeVisible();
    expect(clearImpersonationState).not.toHaveBeenCalled();
    expect(hardReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /nav.status/i })).toHaveAttribute('href', '/ui-next');
  });
});

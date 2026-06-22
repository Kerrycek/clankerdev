import { beforeEach, describe, expect, test } from 'vitest';

import type { RuntimeConfig } from '../../app/config';
import { readStoredOAuthToken } from './tokenStore';
import { completeOAuth2Login } from './oauth2Client';

const LOGIN_STATE_KEY = 'vpsadmin_ui_next.oauth2.login_state';

function createRuntimeConfig(): RuntimeConfig {
  return {
    apiUrl: 'https://api.example.test',
    apiVersion: '7.0',
    apiBaseUrl: 'https://api.example.test/v7.0',
    routerBasename: '',
    auth: { kind: 'none' },
    oauth2: {
      authorizeUrl: 'https://auth.example.test/oauth2/authorize',
      tokenUrl: 'https://auth.example.test/oauth2/token',
      clientId: 'ui-next-test',
      scope: 'all',
      redirectPath: '/oauth/callback',
      type: 'web_server',
      flow: 'implicit',
      storage: 'session',
    },
    publicStatus: { ipv4Warn: 128, ipv4Critical: 32 },
    uiSettings: {
      persistence: 'local',
      server: { path: '/webui_user_settings', namespace: 'general', field: 'settings' },
    },
    haveApi: {},
  };
}

function writeLoginState(overrides: Record<string, unknown> = {}): void {
  window.sessionStorage.setItem(
    LOGIN_STATE_KEY,
    JSON.stringify({
      createdAt: Date.now(),
      state: 'state-1',
      nextPath: '/app/profile',
      flow: 'implicit',
      ...overrides,
    })
  );
}

describe('oauth2Client security hardening', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  test('accepts implicit-flow state from the callback hash and stores the token', async () => {
    writeLoginState();

    await expect(
      completeOAuth2Login(
        createRuntimeConfig(),
        `${window.location.origin}/oauth/callback#access_token=TOKEN&token_type=Bearer&state=state-1`
      )
    ).resolves.toEqual({ nextPath: '/app/profile' });

    expect(readStoredOAuthToken('session')).toMatchObject({ accessToken: 'TOKEN', tokenType: 'Bearer' });
    expect(window.sessionStorage.getItem(LOGIN_STATE_KEY)).toBeNull();
  });

  test('rejects stale OAuth2 login state before accepting a callback', async () => {
    writeLoginState({ createdAt: Date.now() - 11 * 60 * 1000 });

    await expect(
      completeOAuth2Login(
        createRuntimeConfig(),
        `${window.location.origin}/oauth/callback#access_token=TOKEN&state=state-1`
      )
    ).rejects.toThrow('OAuth2 state mismatch');

    expect(readStoredOAuthToken('session')).toBeNull();
    expect(window.sessionStorage.getItem(LOGIN_STATE_KEY)).toBeNull();
  });

  test('sanitizes a stored next path before redirecting after login', async () => {
    writeLoginState({ nextPath: 'https://evil.example/phish' });

    await expect(
      completeOAuth2Login(
        createRuntimeConfig(),
        `${window.location.origin}/oauth/callback#access_token=TOKEN&state=state-1`
      )
    ).resolves.toEqual({ nextPath: '/app' });
  });
});

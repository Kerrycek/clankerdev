import { readStoredOAuthToken, type StorageKind } from '../lib/auth/tokenStore';
import { readImpersonationState } from '../lib/auth/impersonation';

export type AuthConfig =
  | { kind: 'oauth2'; accessToken: string }
  | { kind: 'token'; sessionToken: string }
  | { kind: 'none' };

export type OAuth2Flow = 'pkce' | 'implicit';

export interface OAuth2Config {
  /** OAuth2 authorization endpoint */
  authorizeUrl: string;
  /** OAuth2 token endpoint */
  tokenUrl: string;
  /** OAuth2 client_id */
  clientId: string;
  /** OAuth2 scope (default: 'all') */
  scope: string;
  /** OAuth2 redirect path within this SPA's origin */
  redirectPath: string;
  /** Optional vpsFree auth server `type` parameter (default: 'web_server') */
  type: string;
  /** OAuth2 flow used by the SPA */
  flow: OAuth2Flow;
  /** Where the SPA stores the access token */
  storage: StorageKind;
}

export interface PublicStatusConfig {
  /** Warn threshold for remaining IPv4 addresses on the public status landing. */
  ipv4Warn: number;
  /** Critical threshold for remaining IPv4 addresses on the public status landing. */
  ipv4Critical: number;
}

export interface RuntimeConfig {
  apiUrl: string;
  apiVersion: string;
  apiBaseUrl: string;
  webuiUrl?: string;
  /** Optional absolute/relative URL for the login endpoint (overrides legacy /?page=login). */
  loginUrl?: string;
  /** Optional absolute/relative URL for the logout endpoint (overrides legacy /?page=logout). */
  logoutUrl?: string;
  /** React Router basename for sub-path deployments (e.g. '/ui-next'). Empty means root. */
  routerBasename: string;
  auth: AuthConfig;
  oauth2: OAuth2Config;
  publicStatus: PublicStatusConfig;
  uiSettings: UiSettingsConfig;
  haveApi: HaveApiClientConfig;
}

export interface HaveApiClientConfig {
  /** Force auth header name (useful when API description bootstrap is not available). */
  authHeader?: string;
  /** Force meta namespace (defaults to `_meta`). */
  metaNamespace?: string;
}

export type UiSettingsPersistence = 'local' | 'server';

export interface UiSettingsServerConfig {
  /**
   * HaveAPI path used to fetch and update UI settings for the current user session.
   *
   * Default (planned API extension):
   *   GET/PUT /v{apiVersion}/user_sessions/current/ui_setting
   */
  path: string;

  /** HaveAPI input namespace used when updating settings */
  namespace: string;

  /** Attribute name that contains JSON settings */
  field: string;
}

export interface UiSettingsConfig {
  /**
   * Where UI settings are persisted.
   * - local: localStorage only
   * - server: localStorage + best-effort sync to API
   */
  persistence: UiSettingsPersistence;

  /** Server sync configuration (used only when persistence === 'server'). */
  server: UiSettingsServerConfig;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeApiVersion(version: string): string {
  // Legacy configs sometimes pass "v7.0" while the app expects just "7.0".
  return version.startsWith('v') ? version.slice(1) : version;
}

function normalizeBasename(value: string | undefined): string {
  if (!value) return '';
  let v = value.trim();
  if (!v || v === '/') return '';
  if (!v.startsWith('/')) v = `/${v}`;
  v = v.replace(/\/+$/, '');
  return v === '/' ? '' : v;
}

export function getRuntimeConfig(): RuntimeConfig {
  const win = typeof window !== 'undefined' ? window : undefined;

  const viteEnv = import.meta.env as Record<string, string | undefined>;
  const nodeEnv =
    typeof process !== 'undefined' && typeof (process as LegacyAny).env === 'object'
      ? ((process as LegacyAny).env as Record<string, string | undefined>)
      : undefined;

  const env = (key: string): string | undefined => viteEnv[key] ?? nodeEnv?.[key];

  const apiUrl = trimTrailingSlash(
    win?.vpsAdmin?.api?.url ?? env('VITE_API_URL') ?? 'https://api.vpsfree.cz'
  );

  const apiVersion = normalizeApiVersion(
    win?.vpsAdmin?.api?.version ?? env('VITE_API_VERSION') ?? '7.0'
  );

  const apiBaseUrl = `${apiUrl}/v${apiVersion}`;

  // Router basename is used to support sub-path deployments (e.g. /ui-next).
  const routerBasename = normalizeBasename(
    win?.vpsAdmin?.webuiNext?.basePath ??
      env('VITE_ROUTER_BASENAME') ??
      env('VITE_BASE_PATH')
  );

  // OAuth2 client config (used by the SPA for login).
  // Defaults are tuned for vpsFree's SSO.
  const oauthFromWindow = (win as LegacyAny)?.vpsAdmin?.webuiNext?.oauth2 as Partial<OAuth2Config> | undefined;

  const oauthAuthorizeUrl = trimTrailingSlash(
    (oauthFromWindow?.authorizeUrl as string | undefined) ??
      env('VITE_OAUTH2_AUTHORIZE_URL') ??
      'https://auth.vpsfree.cz/_auth/oauth2/authorize'
  );

  const oauthTokenUrl = trimTrailingSlash(
    (oauthFromWindow?.tokenUrl as string | undefined) ??
      env('VITE_OAUTH2_TOKEN_URL') ??
      'https://auth.vpsfree.cz/_auth/oauth2/token'
  );

  const oauthClientId =
    (oauthFromWindow?.clientId as string | undefined) ??
    env('VITE_OAUTH2_CLIENT_ID') ??
    (typeof window !== 'undefined' ? window.location.hostname : '');

  const oauthScope =
    (oauthFromWindow?.scope as string | undefined) ??
    env('VITE_OAUTH2_SCOPE') ??
    'all';

  const oauthType =
    (oauthFromWindow?.type as string | undefined) ??
    env('VITE_OAUTH2_TYPE') ??
    'web_server';

  const oauthFlowCandidate =
    (oauthFromWindow?.flow as OAuth2Flow | undefined) ??
    (env('VITE_OAUTH2_FLOW') as OAuth2Flow | undefined);
  const oauthFlow: OAuth2Flow = oauthFlowCandidate === 'implicit' ? 'implicit' : 'pkce';

  const oauthStorageCandidate =
    (oauthFromWindow?.storage as StorageKind | undefined) ??
    (env('VITE_OAUTH2_STORAGE') as StorageKind | undefined);
  const oauthStorage: StorageKind = oauthStorageCandidate === 'local' ? 'local' : 'session';

  const oauthRedirectPathCandidate =
    (oauthFromWindow?.redirectPath as string | undefined) ??
    env('VITE_OAUTH2_REDIRECT_PATH');
  const oauthRedirectPath = oauthRedirectPathCandidate
    ? oauthRedirectPathCandidate.trim()
    : `${routerBasename}/oauth/callback`;

  const oauth2: OAuth2Config = {
    authorizeUrl: oauthAuthorizeUrl,
    tokenUrl: oauthTokenUrl,
    clientId: oauthClientId,
    scope: oauthScope,
    redirectPath: oauthRedirectPath.startsWith('/') ? oauthRedirectPath : `/${oauthRedirectPath}`,
    type: oauthType,
    flow: oauthFlow,
    storage: oauthStorage,
  };

  // Auth: prefer runtime tokens provided by the integrated webui (window.vpsAdmin).
  // For standalone deployments, we persist the OAuth2 access token in web storage.
  const windowAccessToken = win?.vpsAdmin?.accessToken;
  const windowSessionToken = win?.vpsAdmin?.sessionToken;

  const impersonation = typeof window !== 'undefined' ? readImpersonationState(window.sessionStorage) : null;

  const stored = readStoredOAuthToken(oauth2.storage);

  const auth: AuthConfig = impersonation?.sessionToken
    ? { kind: 'token', sessionToken: impersonation.sessionToken }
    : windowAccessToken
      ? { kind: 'oauth2', accessToken: windowAccessToken }
      : windowSessionToken
        ? { kind: 'token', sessionToken: windowSessionToken }
        : stored?.accessToken
          ? { kind: 'oauth2', accessToken: stored.accessToken }
          : { kind: 'none' };

  // UI settings persistence config is optional; default is local-only.
  const uiSettingsFromWindow = win?.vpsAdmin?.webuiNext?.uiSettings ?? win?.vpsAdmin?.uiSettings;

  const persistenceEnv = env('VITE_UI_SETTINGS_PERSISTENCE');
  const persistenceCandidate =
    uiSettingsFromWindow?.persistence ?? uiSettingsFromWindow?.mode ?? persistenceEnv;

  const persistence: UiSettingsPersistence = persistenceCandidate === 'server' ? 'server' : 'local';

  const serverPath =
    uiSettingsFromWindow?.server?.path ??
    uiSettingsFromWindow?.path ??
    env('VITE_UI_SETTINGS_SERVER_PATH') ??
    '/user_sessions/current/ui_setting';

  const serverNamespace =
    uiSettingsFromWindow?.server?.namespace ??
    uiSettingsFromWindow?.namespace ??
    env('VITE_UI_SETTINGS_NAMESPACE') ??
    'ui_setting';

  const serverField =
    uiSettingsFromWindow?.server?.field ??
    uiSettingsFromWindow?.field ??
    env('VITE_UI_SETTINGS_FIELD') ??
    'settings';

  const webuiUrlCandidate = win?.vpsAdmin?.webui?.url ?? env('VITE_WEBUI_URL');
  const webuiUrl = webuiUrlCandidate ? trimTrailingSlash(webuiUrlCandidate) : undefined;

  // Optional explicit auth endpoints.
  const loginUrlCandidate = win?.vpsAdmin?.webuiNext?.loginUrl ?? env('VITE_LOGIN_URL');
  const logoutUrlCandidate = win?.vpsAdmin?.webuiNext?.logoutUrl ?? env('VITE_LOGOUT_URL');
  const loginUrl = loginUrlCandidate ? loginUrlCandidate.trim() : `${routerBasename}/oauth/login`;
  const logoutUrl = logoutUrlCandidate ? logoutUrlCandidate.trim() : `${routerBasename}/oauth/logout`;

  const haveApiAuthHeader =
    win?.vpsAdmin?.webuiNext?.haveApi?.authHeader ?? env('VITE_HAVEAPI_AUTH_HEADER');

  const haveApiMetaNamespace =
    win?.vpsAdmin?.webuiNext?.haveApi?.metaNamespace ?? env('VITE_HAVEAPI_META_NAMESPACE');

  // Public status landing tuning.
  // Allow runtime overrides from window and optional env variables.
  const publicStatusFromWindow = (win as LegacyAny)?.vpsAdmin?.webuiNext?.publicStatus as
    | Partial<PublicStatusConfig>
    | undefined;

  let ipv4Warn = readNumber(publicStatusFromWindow?.ipv4Warn ?? env('VITE_PUBLIC_IPV4_WARN'), 64);
  let ipv4Critical = readNumber(
    publicStatusFromWindow?.ipv4Critical ?? env('VITE_PUBLIC_IPV4_CRITICAL'),
    16
  );

  // Normalize thresholds.
  ipv4Warn = Math.max(0, Math.round(ipv4Warn));
  ipv4Critical = Math.max(0, Math.round(ipv4Critical));
  if (ipv4Critical > ipv4Warn) ipv4Critical = ipv4Warn;

  const publicStatus: PublicStatusConfig = {
    ipv4Warn,
    ipv4Critical,
  };

  return {
    apiUrl,
    apiVersion,
    apiBaseUrl,
    webuiUrl,
    loginUrl,
    logoutUrl,
    routerBasename,
    auth,
    oauth2,
    publicStatus,
    uiSettings: {
      persistence,
      server: {
        path: serverPath,
        namespace: serverNamespace,
        field: serverField,
      },
    },
    haveApi: {
      authHeader: haveApiAuthHeader,
      metaNamespace: haveApiMetaNamespace,
    },
  };
}

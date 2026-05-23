import type { RuntimeConfig } from '../../app/config';
import { clearStoredOAuthToken, writeStoredOAuthToken } from './tokenStore';

interface LoginState {
  createdAt: number;
  state: string;
  codeVerifier?: string;
  nextPath: string;
  flow: 'pkce' | 'implicit';
}

const LOGIN_STATE_KEY = 'vpsadmin_ui_next.oauth2.login_state';

function getSessionStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    binary += String.fromCharCode(byte);
  }

  // btoa expects binary string
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBase64Url(bytesLen: number): string {
  const bytes = new Uint8Array(bytesLen);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Very old environments only; fall back to Math.random.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return base64UrlEncodeBytes(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);

  if (!crypto?.subtle?.digest) {
    throw new Error('WebCrypto (crypto.subtle) is required for PKCE');
  }

  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

function getRedirectUri(cfg: RuntimeConfig): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot compute redirect URI outside of the browser');
  }
  // cfg.oauth2.redirectPath is an absolute path (starts with "/").
  return `${window.location.origin}${cfg.oauth2.redirectPath}`;
}

function loadLoginState(): LoginState | null {
  const st = getSessionStorage();
  if (!st) return null;

  const raw = st.getItem(LOGIN_STATE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LoginState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.state !== 'string' || !parsed.state) return null;
    if (typeof parsed.nextPath !== 'string' || !parsed.nextPath) return null;
    if (parsed.flow !== 'pkce' && parsed.flow !== 'implicit') return null;
    if (parsed.flow === 'pkce' && (!parsed.codeVerifier || typeof parsed.codeVerifier !== 'string')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLoginState(state: LoginState): void {
  const st = getSessionStorage();
  if (!st) return;
  try {
    st.setItem(LOGIN_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function clearLoginState(): void {
  const st = getSessionStorage();
  if (!st) return;
  try {
    st.removeItem(LOGIN_STATE_KEY);
  } catch {
    // ignore
  }
}

function buildAuthorizeUrl(cfg: RuntimeConfig, state: LoginState, codeChallenge?: string): string {
  const u = new URL(cfg.oauth2.authorizeUrl);
  u.searchParams.set('type', cfg.oauth2.type);
  u.searchParams.set('client_id', cfg.oauth2.clientId);
  u.searchParams.set('redirect_uri', getRedirectUri(cfg));
  u.searchParams.set('scope', cfg.oauth2.scope);
  u.searchParams.set('state', state.state);

  if (state.flow === 'implicit') {
    u.searchParams.set('response_type', 'token');
  } else {
    u.searchParams.set('response_type', 'code');
  }

  if (state.flow === 'pkce') {
    if (!codeChallenge) {
      throw new Error('PKCE code_challenge missing');
    }
    u.searchParams.set('code_challenge', codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
  }

  return u.toString();
}

export async function startOAuth2Login(cfg: RuntimeConfig, nextPath: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('startOAuth2Login must run in the browser');
  }

  // Defensive: avoid getting stuck with a broken token.
  clearStoredOAuthToken(cfg.oauth2.storage);

  const state: LoginState = {
    createdAt: Date.now(),
    state: randomBase64Url(24),
    nextPath: nextPath || '/app',
    flow: cfg.oauth2.flow,
  };

  let codeChallenge: string | undefined;

  if (cfg.oauth2.flow === 'pkce') {
    state.codeVerifier = randomBase64Url(48);
    codeChallenge = await sha256Base64Url(state.codeVerifier);
  }

  saveLoginState(state);

  const authorizeUrl = buildAuthorizeUrl(cfg, state, codeChallenge);
  window.location.assign(authorizeUrl);
}

function parseHashParams(hash: string): URLSearchParams {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(h);
}

async function exchangeCodeForToken(cfg: RuntimeConfig, code: string, verifier: string): Promise<{ accessToken: string; tokenType?: string; scope?: string; expiresAt?: number }> {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', cfg.oauth2.clientId);
  body.set('redirect_uri', getRedirectUri(cfg));
  body.set('code', code);
  body.set('code_verifier', verifier);

  const res = await fetch(cfg.oauth2.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => null)) as any;

  if (!res.ok) {
    const msg = json?.error_description || json?.error || `Token request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const accessToken = json?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('OAuth2 token response missing access_token');
  }

  const tokenType = typeof json?.token_type === 'string' ? json.token_type : undefined;
  const scope = typeof json?.scope === 'string' ? json.scope : undefined;

  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : undefined;
  const expiresAt = expiresIn ? Date.now() + Math.max(0, expiresIn - 30) * 1000 : undefined;

  return { accessToken, tokenType, scope, expiresAt };
}

export async function completeOAuth2Login(cfg: RuntimeConfig, currentUrl: string): Promise<{ nextPath: string }> {
  if (typeof window === 'undefined') {
    throw new Error('completeOAuth2Login must run in the browser');
  }

  const u = new URL(currentUrl);

  const error = u.searchParams.get('error');
  const errorDescription = u.searchParams.get('error_description');
  if (error) {
    clearLoginState();
    throw new Error(errorDescription || error);
  }

  const stateParam = u.searchParams.get('state') ?? undefined;
  if (!stateParam) {
    clearLoginState();
    throw new Error('Missing OAuth2 state parameter');
  }

  const storedState = loadLoginState();
  if (!storedState || storedState.state !== stateParam) {
    clearLoginState();
    throw new Error('OAuth2 state mismatch');
  }

  const nextPath = storedState.nextPath || '/app';

  // Implicit flow: access_token in the URL hash.
  if (storedState.flow === 'implicit') {
    const hash = parseHashParams(u.hash);
    const accessToken = hash.get('access_token');
    const tokenType = hash.get('token_type') ?? undefined;
    const scope = hash.get('scope') ?? undefined;
    const expiresInRaw = hash.get('expires_in');
    const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined;
    const expiresAt = expiresIn && Number.isFinite(expiresIn) ? Date.now() + Math.max(0, expiresIn - 30) * 1000 : undefined;

    if (!accessToken) {
      clearLoginState();
      throw new Error('OAuth2 callback missing access_token');
    }

    writeStoredOAuthToken(cfg.oauth2.storage, { accessToken, tokenType, scope, expiresAt });
    clearLoginState();
    return { nextPath };
  }

  // PKCE flow: code in the query string.
  const code = u.searchParams.get('code');
  if (!code) {
    clearLoginState();
    throw new Error('OAuth2 callback missing code');
  }

  const verifier = storedState.codeVerifier;
  if (!verifier) {
    clearLoginState();
    throw new Error('OAuth2 login state missing PKCE verifier');
  }

  const token = await exchangeCodeForToken(cfg, code, verifier);
  writeStoredOAuthToken(cfg.oauth2.storage, token);
  clearLoginState();

  return { nextPath };
}

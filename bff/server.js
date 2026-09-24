/* Minimal OAuth2 BFF for WebUI Next (vpsAdmin).
 *
 * Responsibilities:
 * - Perform OAuth2 authorization-code exchange server-side (keeps client_secret secret).
 * - Store per-user access/refresh tokens in a server-side session.
 * - Expose public runtime config and same-origin session JSON to the SPA.
 *
 * This service does NOT proxy HaveAPI calls. The SPA calls https://api.vpsfree.cz directly.
 */

const express = require('express');
const { passkeyDestinations, renderPasskeyPage, setPasskeyHeaders } = require('./passkey-page');
const session = require('express-session');
const { createSessionQueue } = require('./session-queue');
const FileStoreFactory = require('session-file-store');
const {
  preferredLanguage,
  renderOAuthErrorPage,
  setOAuthRecoverySecurityHeaders,
} = require('./oauth-error-page');
const {
  consumeOAuthState,
  createFixedWindowRateLimiter,
  createOAuthState,
  clearSessionCookie,
  destroySession,
  fetchLimitedResponseText,
  isSameOriginRequest,
  regenerateSession,
  sanitizeNext,
  saveSession,
  setRuntimeConfigSecurityHeaders,
  setRuntimeSessionSecurityHeaders,
  validateSessionSecret,
  validateOAuthTokenResponse,
} = require('./security');

const FileStore = FileStoreFactory(session);

// ---- Config ----
function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const PORT = parseInt(process.env.PORT || process.env.BFF_PORT || '3001', 10);

const DOMAIN = process.env.DOMAIN || 'clankerdev.vpsfree.cz';

const API_URL = process.env.API_URL || 'https://api.vpsfree.cz';
const API_VERSION = process.env.API_VERSION || '7.0';

const HAVEAPI_AUTH_HEADER = process.env.HAVEAPI_AUTH_HEADER || 'X-HaveAPI-OAuth2-Token';
const HAVEAPI_META_NAMESPACE = process.env.HAVEAPI_META_NAMESPACE || '_meta';

const OAUTH_AUTHORIZE_URL = required('OAUTH_AUTHORIZE_URL');
const OAUTH_TOKEN_URL = required('OAUTH_TOKEN_URL');
const OAUTH_REVOKE_URL = process.env.OAUTH_REVOKE_URL || '';

const OAUTH_CLIENT_ID = required('OAUTH_CLIENT_ID');
const OAUTH_CLIENT_SECRET = required('OAUTH_CLIENT_SECRET');
const OAUTH_SCOPE = process.env.OAUTH_SCOPE || 'all';
const OAUTH_TYPE = process.env.OAUTH_TYPE || 'web_server';

function passwordRecoveryUrl() {
  const configured = process.env.PASSWORD_RECOVERY_URL || '/oauth2/password-reset';
  const url = new URL(configured, OAUTH_AUTHORIZE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PASSWORD_RECOVERY_URL must use HTTP(S)');
  }
  if (!url.searchParams.has('client_id')) url.searchParams.set('client_id', OAUTH_CLIENT_ID);
  return url.toString();
}

const PASSWORD_RECOVERY_URL = passwordRecoveryUrl();

// Must match the OAuth client registration exactly
const OAUTH_REDIRECT_URI =
  process.env.OAUTH_REDIRECT_URI || `https://${DOMAIN}/oauth/callback`;

const PASSKEY_DESTINATIONS = passkeyDestinations(OAUTH_AUTHORIZE_URL, OAUTH_REDIRECT_URI);

const SESSION_SECRET = validateSessionSecret(required('SESSION_SECRET'));
const SESSION_STORE_PATH = process.env.SESSION_STORE_PATH || '/var/lib/webui-next-bff/sessions';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'webui_next_sess';

// Refresh access token when it will expire within this window
const REFRESH_SKEW_MS = parseInt(process.env.REFRESH_SKEW_MS || '60000', 10); // 60s

// Session lifetime
const SESSION_MAX_AGE_MS = parseInt(process.env.SESSION_MAX_AGE_MS || String(30 * 24 * 60 * 60 * 1000), 10); // 30d

// OAuth authorization responses must be completed shortly after login starts.
const OAUTH_STATE_MAX_AGE_MS = parseInt(process.env.OAUTH_STATE_MAX_AGE_MS || String(10 * 60 * 1000), 10); // 10m

// Pre-auth sessions contain no useful long-lived state. Keeping them short and
// rate-limiting login starts prevents anonymous requests from filling the
// file-backed session store.
const PREAUTH_SESSION_MAX_AGE_MS = parseInt(
  process.env.PREAUTH_SESSION_MAX_AGE_MS || String(10 * 60 * 1000),
  10,
);
const LOGIN_RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS || String(10 * 60 * 1000),
  10,
);
const LOGIN_RATE_LIMIT_MAX = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20', 10);

const OAUTH_FETCH_TIMEOUT_MS = parseInt(process.env.OAUTH_FETCH_TIMEOUT_MS || '10000', 10);
const OAUTH_RESPONSE_MAX_BYTES = parseInt(process.env.OAUTH_RESPONSE_MAX_BYTES || String(64 * 1024), 10);

async function oauthTokenRequest(params) {
  const body = new URLSearchParams(params);

  const { response: res, text } = await fetchLimitedResponseText(
    OAUTH_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
    },
    {
      timeoutMs: OAUTH_FETCH_TIMEOUT_MS,
      maxBytes: OAUTH_RESPONSE_MAX_BYTES,
    },
  );
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = typeof data === 'object' && data && data.error_description
      ? `${data.error}: ${data.error_description}`
      : text;
    const err = new Error(`OAuth token request failed (${res.status}): ${msg}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return validateOAuthTokenResponse(data);
}

async function oauthRevokeToken(token) {
  if (!OAUTH_REVOKE_URL) return;
  if (!token) return;

  try {
    const body = new URLSearchParams({
      token,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });

    await fetchLimitedResponseText(
      OAUTH_REVOKE_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body,
      },
      {
        timeoutMs: OAUTH_FETCH_TIMEOUT_MS,
        maxBytes: OAUTH_RESPONSE_MAX_BYTES,
      },
    );
  } catch {
    // best-effort
  }
}

function computeExpiresAt(expiresIn) {
  const n = typeof expiresIn === 'number' ? expiresIn : parseInt(String(expiresIn || '0'), 10);
  return Date.now() + Math.max(0, n) * 1000;
}

function currentSessionExpiresAt(req) {
  const cookie = req.session?.cookie;
  if (!cookie) return null;

  const expires = cookie.expires;
  if (expires instanceof Date && Number.isFinite(expires.getTime())) {
    return expires.getTime();
  }

  const maxAge = cookie.maxAge;
  if (typeof maxAge === 'number' && Number.isFinite(maxAge)) {
    return Date.now() + maxAge;
  }

  return null;
}

async function ensureFreshToken(req) {
  const oauth = req.session.oauth;
  if (!oauth || !oauth.access_token) return undefined;

  // If we have no refresh token or no expiry, just return what we have
  if (!oauth.refresh_token || !oauth.expires_at) return oauth;

  const now = Date.now();
  if (now < oauth.expires_at - REFRESH_SKEW_MS) return oauth;

  // refresh
  try {
    const data = await oauthTokenRequest({
      grant_type: 'refresh_token',
      refresh_token: oauth.refresh_token,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });

    const nextOauth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || oauth.refresh_token,
      scope: data.scope || oauth.scope,
      token_type: data.token_type || oauth.token_type,
      expires_in: data.expires_in,
      expires_at: computeExpiresAt(data.expires_in),
    };

    req.session.oauth = nextOauth;
    return nextOauth;
  } catch {
    // If refresh fails, drop tokens and force re-login
    req.session.oauth = undefined;
    return undefined;
  }
}

// ---- App ----
const app = express();
app.disable('x-powered-by');

// We're behind nginx, so trust X-Forwarded-* for secure cookies & redirect building if needed
app.set('trust proxy', 1);

// Serialize before loading session snapshots, through the final store write.
app.use(createSessionQueue({ name: SESSION_COOKIE_NAME, secret: SESSION_SECRET }));

// sessions
app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS,
    },
    store: new FileStore({
      path: SESSION_STORE_PATH,
      retries: 0,
      ttl: Math.floor(SESSION_MAX_AGE_MS / 1000),
    }),
  })
);

// health
app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

// config bootstrap for SPA
app.get('/config.js', (_req, res) => {
  // Always set login/logout URLs so the SPA doesn't fall back to legacy /?page=login
  const cfg = {
    api: { url: API_URL, version: API_VERSION },
    webuiNext: {
      loginUrl: '/oauth/login',
      logoutUrl: '/oauth/logout',
      passwordRecoveryUrl: PASSWORD_RECOVERY_URL,
      passkeyRegistrationUrl: '/oauth/passkey',
      basePath: '',
      haveApi: {
        authHeader: HAVEAPI_AUTH_HEADER,
        metaNamespace: HAVEAPI_META_NAMESPACE,
      },
    },
  };

  const js = [
    'window.vpsAdmin = window.vpsAdmin || {};',
    `window.vpsAdmin.api = ${JSON.stringify(cfg.api)};`,
    'window.vpsAdmin.webuiNext = window.vpsAdmin.webuiNext || {};',
    `Object.assign(window.vpsAdmin.webuiNext, ${JSON.stringify(cfg.webuiNext)});`,
  ].join('\n');

  setRuntimeConfigSecurityHeaders(res);
  res.send(js);
});

// The API validates WebAuthn against its authentication origin, not the SPA.
app.get('/oauth/passkey', async (req, res) => {
  setPasskeyHeaders(res, PASSKEY_DESTINATIONS.origin);
  if (!isSameOriginRequest(req, new URL(OAUTH_REDIRECT_URI).origin)) {
    return res.status(403).type('text/plain').send('Forbidden');
  }
  const oauth = await ensureFreshToken(req);
  if (!oauth) return res.redirect(303, '/oauth/login?next=%2Fapp%2Fprofile%2Fmfa');
  const language = ['cs', 'en'].includes(req.query.lang)
    ? req.query.lang : preferredLanguage(req.get('accept-language'));
  res.type('html').send(renderPasskeyPage(language, oauth.access_token, PASSKEY_DESTINATIONS));
});

// Same-origin JSON is deliberately separate from executable runtime config.
// This prevents a sibling origin from stealing the token with a script tag.
app.get('/session.json', async (req, res) => {
  const webOrigin = new URL(OAUTH_REDIRECT_URI).origin;
  if (!isSameOriginRequest(req, webOrigin)) {
    setRuntimeSessionSecurityHeaders(res);
    return res.status(403).send(JSON.stringify({ error: 'same_origin_required' }));
  }

  const oauth = await ensureFreshToken(req);
  setRuntimeSessionSecurityHeaders(res);
  return res.send(JSON.stringify({
    accessToken: oauth?.access_token || null,
    sessionExpiresAt: oauth?.access_token ? currentSessionExpiresAt(req) : null,
  }));
});

function clearPendingOAuthAttempt(req) {
  if (!req.session) return;

  req.session.next = undefined;
  req.session.oauth_state = undefined;
  req.session.oauth_state_issued_at = undefined;
}

function redirectOAuthFailure(req, res) {
  clearPendingOAuthAttempt(req);
  setOAuthRecoverySecurityHeaders(res);
  return res.redirect(303, '/oauth/error');
}

app.get('/oauth/error', (req, res) => {
  const language = preferredLanguage(req.get('accept-language'));
  setOAuthRecoverySecurityHeaders(res);
  res.setHeader('content-language', language);
  res.vary('Accept-Language');
  return res.status(400).type('html').send(renderOAuthErrorPage(language));
});

// start login
const loginRateLimit = createFixedWindowRateLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
});

app.get('/oauth/login', loginRateLimit, (req, res) => {
  const nextPath = sanitizeNext(req.query.next);
  req.session.next = nextPath;
  req.session.cookie.maxAge = PREAUTH_SESSION_MAX_AGE_MS;

  const state = createOAuthState();
  req.session.oauth_state = state.value;
  req.session.oauth_state_issued_at = state.issuedAt;

  const u = new URL(OAUTH_AUTHORIZE_URL);
  u.searchParams.set('client_id', OAUTH_CLIENT_ID);
  u.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', OAUTH_SCOPE);
  u.searchParams.set('state', state.value);
  if (OAUTH_TYPE) u.searchParams.set('type', OAUTH_TYPE);

  res.redirect(u.toString());
});

// oauth callback
app.get('/oauth/callback', async (req, res) => {
  const q = req.query;

  if (typeof q.error === 'string') {
    return redirectOAuthFailure(req, res);
  }

  const code = typeof q.code === 'string' ? q.code : '';
  const state = typeof q.state === 'string' ? q.state : '';

  if (!code) {
    return redirectOAuthFailure(req, res);
  }

  const nextPath = sanitizeNext(req.session.next);
  req.session.next = undefined;

  if (!consumeOAuthState(req.session, state, { maxAgeMs: OAUTH_STATE_MAX_AGE_MS })) {
    return redirectOAuthFailure(req, res);
  }

  try {
    // Persist state consumption before contacting the provider so a callback
    // cannot be replayed concurrently with the same authorization response.
    await saveSession(req);

    const data = await oauthTokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });

    // Rotate the session id after authentication to prevent session fixation.
    await regenerateSession(req);
    req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

    req.session.oauth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      scope: data.scope,
      token_type: data.token_type,
      expires_in: data.expires_in,
      expires_at: computeExpiresAt(data.expires_in),
    };

    res.redirect(nextPath);
  } catch (e) {
    const status = e && Number.isInteger(e.status) ? e.status : undefined;
    console.error('[webui-next-bff] OAuth callback failed', { status });
    return redirectOAuthFailure(req, res);
  }
});

// logout
app.get('/oauth/logout', async (req, res) => {
  const webOrigin = new URL(OAUTH_REDIRECT_URI).origin;
  if (!isSameOriginRequest(req, webOrigin)) {
    res.setHeader('cache-control', 'no-store');
    return res.status(403).type('text/plain').send('Same-origin request required.');
  }

  const nextPath = sanitizeNext(req.query.next) || '/';

  const oauth = req.session.oauth;
  const access = oauth?.access_token;
  const refresh = oauth?.refresh_token;

  let destroyError;
  try {
    await destroySession(req);
  } catch (error) {
    destroyError = error;
  }

  // Always expire the browser cookie, even if the backing store could not
  // remove its server-side record. Revocation remains bounded and best-effort.
  clearSessionCookie(res, SESSION_COOKIE_NAME);
  res.setHeader('cache-control', 'no-store');
  await Promise.all([oauthRevokeToken(access), oauthRevokeToken(refresh)]);

  if (destroyError) {
    console.error('[webui-next-bff] Session destruction failed during logout');
    return res.status(500).type('text/plain').send('Logout failed. Please try again.');
  }

  return res.redirect(nextPath || '/');
});

if (require.main === module) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[webui-next-bff] listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { app };

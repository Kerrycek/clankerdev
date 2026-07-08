/* Minimal OAuth2 BFF for WebUI Next (vpsAdmin).
 *
 * Responsibilities:
 * - Perform OAuth2 authorization-code exchange server-side (keeps client_secret secret).
 * - Store per-user access/refresh tokens in a server-side session.
 * - Expose /config.js for the SPA to read runtime config and access token.
 *
 * This service does NOT proxy HaveAPI calls. The SPA calls https://api.vpsfree.cz directly.
 */

const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');

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

// Must match the OAuth client registration exactly
const OAUTH_REDIRECT_URI =
  process.env.OAUTH_REDIRECT_URI || `https://${DOMAIN}/oauth/callback`;

const SESSION_SECRET = required('SESSION_SECRET');
const SESSION_STORE_PATH = process.env.SESSION_STORE_PATH || '/var/lib/webui-next-bff/sessions';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'webui_next_sess';

// Refresh access token when it will expire within this window
const REFRESH_SKEW_MS = parseInt(process.env.REFRESH_SKEW_MS || '60000', 10); // 60s

// Session lifetime
const SESSION_MAX_AGE_MS = parseInt(process.env.SESSION_MAX_AGE_MS || String(30 * 24 * 60 * 60 * 1000), 10); // 30d

// ---- Helpers ----
function randomState() {
  return crypto.randomBytes(24).toString('base64url');
}

function sanitizeNext(next) {
  if (!next || typeof next !== 'string') return '/app';

  // Only allow same-origin *paths* to avoid open redirects
  try {
    const u = new URL(next, 'http://local.invalid');
    const path = `${u.pathname}${u.search}${u.hash}`;
    if (!path.startsWith('/')) return '/app';
    // avoid protocol-relative weirdness
    if (path.startsWith('//')) return '/app';
    if (u.searchParams.get('session') === 'expired') return '/app';
    return path;
  } catch {
    return '/app';
  }
}

async function oauthTokenRequest(params) {
  const body = new URLSearchParams(params);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  const text = await res.text();
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

  return data;
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

    await fetch(OAUTH_REVOKE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
    });
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

// We're behind nginx, so trust X-Forwarded-* for secure cookies & redirect building if needed
app.set('trust proxy', 1);

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
app.get('/config.js', async (req, res) => {
  const oauth = await ensureFreshToken(req);

  // Always set login/logout URLs so the SPA doesn't fall back to legacy /?page=login
  const cfg = {
    api: { url: API_URL, version: API_VERSION },
    accessToken: oauth?.access_token || null,
    sessionToken: null,
    webuiNext: {
      loginUrl: '/oauth/login',
      logoutUrl: '/oauth/logout',
      basePath: '',
      sessionExpiresAt: oauth?.access_token ? currentSessionExpiresAt(req) : null,
      haveApi: {
        authHeader: HAVEAPI_AUTH_HEADER,
        metaNamespace: HAVEAPI_META_NAMESPACE,
      },
    },
  };

  const js = [
    'window.vpsAdmin = window.vpsAdmin || {};',
    `window.vpsAdmin.api = ${JSON.stringify(cfg.api)};`,
    `window.vpsAdmin.accessToken = ${cfg.accessToken ? JSON.stringify(cfg.accessToken) : 'undefined'};`,
    `window.vpsAdmin.sessionToken = undefined;`,
    'window.vpsAdmin.webuiNext = window.vpsAdmin.webuiNext || {};',
    `Object.assign(window.vpsAdmin.webuiNext, ${JSON.stringify(cfg.webuiNext)});`,
  ].join('\n');

  res.setHeader('content-type', 'application/javascript; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.send(js);
});

// start login
app.get('/oauth/login', (req, res) => {
  const nextPath = sanitizeNext(req.query.next);
  req.session.next = nextPath;

  const state = randomState();
  req.session.oauth_state = state;

  const u = new URL(OAUTH_AUTHORIZE_URL);
  u.searchParams.set('client_id', OAUTH_CLIENT_ID);
  u.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', OAUTH_SCOPE);
  u.searchParams.set('state', state);
  if (OAUTH_TYPE) u.searchParams.set('type', OAUTH_TYPE);

  res.redirect(u.toString());
});

// oauth callback
app.get('/oauth/callback', async (req, res) => {
  const q = req.query;

  if (typeof q.error === 'string') {
    const desc = typeof q.error_description === 'string' ? q.error_description : '';
    return res
      .status(400)
      .type('text/html')
      .send(
        `<h1>OAuth error</h1><p>${escapeHtml(q.error)}</p><p>${escapeHtml(desc)}</p>`
      );
  }

  const code = typeof q.code === 'string' ? q.code : '';
  const state = typeof q.state === 'string' ? q.state : '';

  if (!code) {
    return res.status(400).type('text/html').send('<h1>Missing code</h1>');
  }

  if (!state || state !== req.session.oauth_state) {
    return res.status(400).type('text/html').send('<h1>Invalid state</h1>');
  }

  // clear state
  req.session.oauth_state = undefined;

  try {
    const data = await oauthTokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
    });

    req.session.oauth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      scope: data.scope,
      token_type: data.token_type,
      expires_in: data.expires_in,
      expires_at: computeExpiresAt(data.expires_in),
    };

    const nextPath = req.session.next || '/app';
    req.session.next = undefined;

    res.redirect(nextPath);
  } catch (e) {
    const msg = e && typeof e.message === 'string' ? e.message : 'Token exchange failed';
    res.status(500).type('text/html').send(`<h1>OAuth token exchange failed</h1><pre>${escapeHtml(msg)}</pre>`);
  }
});

// logout
app.get('/oauth/logout', async (req, res) => {
  const nextPath = sanitizeNext(req.query.next) || '/';

  const oauth = req.session.oauth;
  const access = oauth?.access_token;
  const refresh = oauth?.refresh_token;

  // destroy session first (to clear cookies) then revoke best-effort
  req.session.destroy(async () => {
    // revoke best-effort in background-ish
    await oauthRevokeToken(access);
    await oauthRevokeToken(refresh);
    res.redirect(nextPath || '/');
  });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[webui-next-bff] listening on http://127.0.0.1:${PORT}`);
});

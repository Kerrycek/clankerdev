'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

let bffOrigin;
let bffServer;
let providerServer;
let sessionDirectory;
const tokenRequests = [];

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function secureHeaders(cookie) {
  return {
    'x-forwarded-proto': 'https',
    ...(cookie ? { cookie } : {}),
  };
}

function responseCookie(response) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, 'expected a session cookie');
  assert.match(header, /; Path=\//);
  assert.match(header, /; HttpOnly/i);
  assert.match(header, /; Secure/i);
  assert.match(header, /; SameSite=Lax/i);
  return header.split(';', 1)[0];
}

async function request(path, { cookie, acceptLanguage } = {}) {
  return fetch(`${bffOrigin}${path}`, {
    redirect: 'manual',
    headers: {
      ...secureHeaders(cookie),
      ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {}),
    },
  });
}

async function startLogin(next = '/app', existingCookie) {
  const response = await request(
    `/oauth/login?next=${encodeURIComponent(next)}`,
    { cookie: existingCookie },
  );
  assert.equal(response.status, 302);

  const authorizationUrl = new URL(response.headers.get('location'));
  const state = authorizationUrl.searchParams.get('state');
  assert.ok(state, 'authorization redirect must include state');

  const cookie = responseCookie(response);
  await response.arrayBuffer();
  const sessionId = decodeURIComponent(cookie.split('=', 2)[1]).slice(2).split('.', 1)[0];
  const storedSession = JSON.parse(
    readFileSync(join(sessionDirectory, `${sessionId}.json`), 'utf8'),
  );
  assert.equal(storedSession.oauth_state, state);
  assert.equal(storedSession.next, next);

  return { cookie, state };
}

function assertCleanRecoveryRedirect(response, body, secrets = []) {
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/oauth/error');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'none'/);

  const serialized = `${response.headers.get('location')}\n${body}`;
  for (const secret of secrets) assert.equal(serialized.includes(secret), false);
}

test.before(async () => {
  providerServer = createServer(async (request_, response) => {
    const chunks = [];
    for await (const chunk of request_) chunks.push(chunk);
    const parameters = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    tokenRequests.push(Object.fromEntries(parameters));

    if (parameters.get('code') === 'provider-rejected-code') {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        error: 'temporarily_unavailable',
        error_description: 'provider-detail-must-stay-private',
      }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      scope: 'all',
    }));
  });
  providerServer.listen(0, '127.0.0.1');
  await once(providerServer, 'listening');
  const providerAddress = providerServer.address();
  assert.ok(providerAddress && typeof providerAddress === 'object');

  sessionDirectory = mkdtempSync(join(tmpdir(), 'webui-next-bff-test-'));
  Object.assign(process.env, {
    DOMAIN: 'webui.test',
    OAUTH_AUTHORIZE_URL: 'https://identity.test/authorize',
    OAUTH_TOKEN_URL: `http://127.0.0.1:${providerAddress.port}/token`,
    OAUTH_CLIENT_ID: 'test-client',
    OAUTH_CLIENT_SECRET: 'test-client-secret',
    OAUTH_REDIRECT_URI: 'https://webui.test/oauth/callback',
    SESSION_SECRET: 'test-session-secret-with-enough-entropy',
    SESSION_STORE_PATH: sessionDirectory,
    LOGIN_RATE_LIMIT_MAX: '100',
  });

  const { app } = require('./server');
  bffServer = app.listen(0, '127.0.0.1');
  await once(bffServer, 'listening');
  const bffAddress = bffServer.address();
  assert.ok(bffAddress && typeof bffAddress === 'object');
  bffOrigin = `http://127.0.0.1:${bffAddress.port}`;
});

test.after(async () => {
  await Promise.all([closeServer(bffServer), closeServer(providerServer)]);
  if (sessionDirectory) rmSync(sessionDirectory, { force: true, recursive: true });
});

test('runtime config exposes the OAuth provider password recovery entry point', async () => {
  const response = await request('/config.js');
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.match(
    body,
    /"passwordRecoveryUrl":"https:\/\/identity\.test\/oauth2\/password-reset\?client_id=test-client"/,
  );
});

test('provider callback errors redirect without reflecting details and clear the pending attempt', async () => {
  const { cookie, state } = await startLogin('/app/vps/42');
  const error = 'access_denied_private';
  const description = 'provider-description-private';
  const response = await request(
    `/oauth/callback?error=${error}&error_description=${description}&state=${state}`,
    { cookie },
  );
  const body = await response.text();
  assertCleanRecoveryRedirect(response, body, [error, description, state]);

  const requestCount = tokenRequests.length;
  const replay = await request(`/oauth/callback?code=replay-after-provider-error&state=${state}`, { cookie });
  assert.equal(replay.status, 303);
  await replay.arrayBuffer();
  assert.equal(tokenRequests.length, requestCount, 'cleared state must not reach the token provider');

  const retry = await startLogin('/app', cookie);
  assert.notEqual(retry.state, state, 'retry must issue a fresh OAuth state');
});

test('a callback without a code redirects cleanly and clears the pending attempt', async () => {
  const { cookie, state } = await startLogin('/app');
  const response = await request(`/oauth/callback?state=${state}`, { cookie });
  const body = await response.text();
  assertCleanRecoveryRedirect(response, body, [state]);

  const requestCount = tokenRequests.length;
  const replay = await request(`/oauth/callback?code=replay-after-missing-code&state=${state}`, { cookie });
  assert.equal(replay.status, 303);
  assert.equal(tokenRequests.length, requestCount);
});

test('an invalid state is single-use and never reaches the token provider', async () => {
  const { cookie, state } = await startLogin('/app');
  const invalidState = 'invalid-state-private';
  const requestCount = tokenRequests.length;
  const response = await request(`/oauth/callback?code=unused-code&state=${invalidState}`, { cookie });
  const body = await response.text();
  assertCleanRecoveryRedirect(response, body, [invalidState, 'unused-code']);
  assert.equal(tokenRequests.length, requestCount);

  const replay = await request(`/oauth/callback?code=unused-replay&state=${state}`, { cookie });
  assert.equal(replay.status, 303);
  assert.equal(tokenRequests.length, requestCount, 'state mismatch must consume the original state');
});

test('token exchange failures use the clean recovery route and cannot be replayed', async () => {
  const { cookie, state } = await startLogin('/app');
  const code = 'provider-rejected-code';
  const response = await request(`/oauth/callback?code=${code}&state=${state}`, { cookie });
  const body = await response.text();
  assertCleanRecoveryRedirect(response, body, [code, state, 'provider-detail-must-stay-private']);

  const requestCount = tokenRequests.length;
  assert.equal(tokenRequests.at(-1).code, code);
  const replay = await request(`/oauth/callback?code=${code}&state=${state}`, { cookie });
  assert.equal(replay.status, 303);
  assert.equal(tokenRequests.length, requestCount, 'consumed callbacks must not exchange a code twice');
});

test('successful callbacks preserve a validated next path and establish the session', async () => {
  const next = '/app/vps/42?tab=network#routes';
  const { cookie, state } = await startLogin(next);
  const response = await request(`/oauth/callback?code=successful-code&state=${state}`, { cookie });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), next);
  const authenticatedCookie = responseCookie(response);
  await response.arrayBuffer();

  const sessionResponse = await fetch(`${bffOrigin}/session.json`, {
    redirect: 'manual',
    headers: {
      ...secureHeaders(authenticatedCookie),
      'sec-fetch-site': 'same-origin',
    },
  });
  assert.equal(sessionResponse.status, 200);
  const payload = await sessionResponse.json();
  assert.equal(payload.accessToken, 'test-access-token');
  assert.equal(typeof payload.sessionExpiresAt, 'number');
});

test('session fingerprints survive reads but change at a fresh login', async () => {
  const read = async (cookie) => {
    const res = await fetch(`${bffOrigin}/session.json`, {
      headers: { ...secureHeaders(cookie), 'sec-fetch-site': 'same-origin' },
    });
    assert.equal(res.status, 200);
    return res.json();
  };
  const authenticate = async () => {
    const { cookie, state } = await startLogin('/app');
    const res = await request(`/oauth/callback?code=successful-code&state=${state}`, { cookie });
    const authenticated = responseCookie(res); await res.text();
    return authenticated;
  };
  const cookie = await authenticate();
  const first = await read(cookie);
  assert.match(first.sessionKey, /^[a-f0-9]{64}$/);
  assert.equal((await read(cookie)).sessionKey, first.sessionKey);
  assert.notEqual((await read(await authenticate())).sessionKey, first.sessionKey);
  assert.equal((await read(undefined)).sessionKey, null);
});

test('OAuth error page is bilingual, actionable, defensive and never reflects its query', async () => {
  const querySecret = 'callback-query-secret';
  const czechResponse = await request(
    `/oauth/error?code=${querySecret}&state=state-secret&error_description=description-secret`,
    { acceptLanguage: 'en;q=0.4, cs-CZ;q=0.9' },
  );
  const czechBody = await czechResponse.text();

  assert.equal(czechResponse.status, 400);
  assert.equal(czechResponse.headers.get('content-language'), 'cs');
  assert.equal(czechResponse.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(czechResponse.headers.get('pragma'), 'no-cache');
  assert.equal(czechResponse.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(czechResponse.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(czechResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(czechResponse.headers.get('x-frame-options'), 'DENY');
  assert.match(czechResponse.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.match(czechResponse.headers.get('vary') || '', /Accept-Language/i);
  assert.match(czechBody, /<html lang="cs">/);
  assert.match(czechBody, /Přihlášení se nezdařilo/);
  assert.match(czechBody, /href="\/oauth\/login\?next=%2Fapp"/);
  assert.match(czechBody, /href="\/"/);
  for (const secret of [querySecret, 'state-secret', 'description-secret']) {
    assert.equal(czechBody.includes(secret), false);
  }

  const englishResponse = await request('/oauth/error', { acceptLanguage: 'en-US' });
  assert.equal(englishResponse.headers.get('content-language'), 'en');
  assert.match(await englishResponse.text(), /Sign-in failed/);
});

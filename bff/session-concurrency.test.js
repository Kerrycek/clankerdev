'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

let origin, server, provider, directory, gate;
let sequence = 0;
const refreshes = [], revoked = [], used = new Set();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
function holdRefresh(fail = false) {
  const entered = deferred(), release = deferred();
  gate = { entered, release, fail };
  return gate;
}
const cookieOf = (response) => response.headers.get('set-cookie').split(';', 1)[0];
const request = (path, cookie, signal) => fetch(origin + path, {
  redirect: 'manual', signal,
  headers: { 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
});
async function login() {
  const start = await request('/oauth/login');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = cookieOf(start); await start.text();
  const callback = await request(`/oauth/callback?code=fixture-${++sequence}&state=${state}`, cookie);
  assert.equal(callback.status, 302);
  const authenticated = cookieOf(callback); await callback.text();
  return authenticated;
}
async function session(cookie, suffix = '', signal) {
  const response = await request('/session.json' + suffix, cookie, signal);
  assert.equal(response.status, 200);
  return response.json();
}

test.before(async () => {
  provider = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const params = new URLSearchParams(Buffer.concat(chunks).toString());
    res.setHeader('content-type', 'application/json');
    if (req.url === '/revoke') { revoked.push(params.get('token')); return res.end('{}'); }
    if (params.get('grant_type') === 'authorization_code') {
      return res.end(JSON.stringify({ access_token: params.get('code'), refresh_token: params.get('code'), expires_in: 1 }));
    }
    const token = params.get('refresh_token'); refreshes.push(token);
    const currentGate = gate;
    if (currentGate) { currentGate.entered.resolve(); await currentGate.release.promise; }
    if (used.has(token) || currentGate?.fail) {
      res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid_grant' }));
    }
    used.add(token);
    res.end(JSON.stringify({ access_token: `renewed-${token}`, refresh_token: `rotated-${token}`, expires_in: 3600 }));
  });
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const providerOrigin = `http://127.0.0.1:${provider.address().port}`;
  directory = mkdtempSync(join(tmpdir(), 'bff-concurrency-'));
  Object.assign(process.env, {
    OAUTH_AUTHORIZE_URL: 'https://auth.example.test/authorize',
    OAUTH_TOKEN_URL: providerOrigin + '/token', OAUTH_REVOKE_URL: providerOrigin + '/revoke',
    OAUTH_REDIRECT_URI: 'https://ui.example.test/oauth/callback',
    OAUTH_CLIENT_ID: 'fixture-client', OAUTH_CLIENT_SECRET: 'fixture-secret',
    SESSION_SECRET: 'fixture-session-signing-secret-long-enough', SESSION_STORE_PATH: directory,
    LOGIN_RATE_LIMIT_MAX: '100',
  });
  server = require('./server').app.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  gate?.release.resolve();
  await Promise.all([server, provider].map((s) => new Promise((resolve) => s.close(resolve))));
  rmSync(directory, { force: true, recursive: true });
});
test.afterEach(() => { gate?.release.resolve(); gate = undefined; });

test('overlapping bootstraps exchange once and all read the persisted rotation', async () => {
  const cookie = await login(), held = holdRefresh(), before = refreshes.length;
  const first = session(cookie, '?first'); await held.entered.promise;
  const others = Array.from({ length: 7 }, (_, i) => session(cookie, `?other=${i}`));
  await pause(80); held.release.resolve();
  const results = await Promise.all([first, ...others]);
  assert.equal(refreshes.length - before, 1);
  assert.ok(results[0].accessToken);
  assert.ok(results.every((r) => r.accessToken === results[0].accessToken));
  assert.equal((await session(cookie)).accessToken, results[0].accessToken);
});

test('logout waits for rotation, revokes the new tokens and cannot be resurrected', async () => {
  const cookie = await login(), held = holdRefresh();
  const first = session(cookie); await held.entered.promise;
  const logout = request('/oauth/logout', cookie);
  await pause(40); held.release.resolve();
  const refreshed = await first, response = await logout; await response.text();
  assert.equal(response.status, 302);
  assert.ok(revoked.includes(refreshed.accessToken));
  assert.ok(revoked.includes(refreshed.accessToken.replace('renewed-', 'rotated-')));
  assert.equal((await session(cookie)).accessToken, null);
});

test('failed refresh is persisted once and queued readers stay anonymous', async () => {
  const cookie = await login(), held = holdRefresh(true), before = refreshes.length;
  const first = session(cookie); await held.entered.promise;
  const second = session(cookie, '?second'); await pause(40); held.release.resolve();
  for (const result of await Promise.all([first, second])) assert.equal(result.accessToken, null);
  assert.equal(refreshes.length - before, 1);
  assert.equal((await session(cookie)).accessToken, null);
});

test('disconnect during refresh does not unlock before saving; queued logout still wins', async () => {
  const cookie = await login(), held = holdRefresh();
  const controller = new AbortController();
  const first = session(cookie, '?abort', controller.signal).catch((e) => e);
  await held.entered.promise; controller.abort(); await first;
  const logout = request('/oauth/logout', cookie);
  await pause(40); held.release.resolve();
  const response = await logout; assert.equal(response.status, 302); await response.text();
  assert.equal((await session(cookie)).accessToken, null);
});

test('a blocked refresh does not serialize another user', async () => {
  const a = await login(), b = await login();
  const ready = await session(b);
  const held = holdRefresh(); const blocked = session(a); await held.entered.promise;
  try { assert.equal((await session(b)).accessToken, ready.accessToken); }
  finally { held.release.resolve(); await blocked; }
});

test('a disconnected queued reader is skipped without blocking later requests', async () => {
  const cookie = await login(), held = holdRefresh();
  const first = session(cookie); await held.entered.promise;
  const controller = new AbortController();
  const skipped = session(cookie, '?queued-abort', controller.signal).catch((e) => e);
  await pause(40); controller.abort(); await skipped;
  const third = session(cookie, '?third');
  held.release.resolve();
  assert.equal((await third).accessToken, (await first).accessToken);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configUrl = new URL('../deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf', import.meta.url);

function sha256Source(source) {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

function authLocation(config) {
  const match = config.match(/location \^~ \/_auth \{([\s\S]*?)\n    \}/);
  assert.ok(match, 'the dev nginx config must contain the /_auth location');
  return match[1];
}

function authPolicy(location) {
  const match = location.match(/add_header Content-Security-Policy "([^"]+)" always;/);
  assert.ok(match, 'the /_auth location must set a CSP header');
  return match[1];
}

test('OAuth CSP nonces localized and per-session inline scripts', async () => {
  const config = await readFile(configUrl, 'utf8');
  const location = authLocation(config);
  const policyTemplate = authPolicy(location);

  assert.match(
    location,
    /sub_filter '<script type="text\/javascript">' '<script type="text\/javascript" nonce="\$request_id">';/,
    'nginx must inject the same request id used by the CSP nonce',
  );
  assert.match(policyTemplate, /script-src [^;]*'nonce-\$request_id'/);
  assert.doesNotMatch(
    policyTemplate.match(/script-src ([^;]+)/)?.[1] ?? '',
    /'unsafe-inline'/,
    'OAuth scripts must not require unsafe-inline',
  );

  // The upstream template interpolates all of these values into the script.
  // Its exact response hash therefore changes even when the JavaScript logic
  // does not; the nonce contract must work for every variant.
  const renderedScripts = [
    'button.value = "Signing in..."; const authToken = "session-a";',
    'button.value = "Přihlašování..."; const authToken = "session-b";',
    'button.value = "Anmeldung..."; const authToken = "session-c";',
  ];

  for (const [index, script] of renderedScripts.entries()) {
    const requestId = `${index + 1}`.repeat(32);
    const html = `<script type="text/javascript">${script}</script>`;
    const rewritten = html.replaceAll(
      '<script type="text/javascript">',
      `<script type="text/javascript" nonce="${requestId}">`,
    );
    const policy = policyTemplate.replaceAll('$request_id', requestId);

    assert.match(rewritten, new RegExp(`<script type="text/javascript" nonce="${requestId}"`));
    assert.match(policy, new RegExp(`'nonce-${requestId}'`));
    assert.equal(policy.includes(sha256Source(script)), false);
  }
});

test('OAuth CSP hash-pins every static inline form handler', async () => {
  const config = await readFile(configUrl, 'utf8');
  const policy = authPolicy(authLocation(config));
  const handlers = [
    'togglePasswords();',
    'onLoginFormSubmit();',
    'webAuthn(event);',
  ];

  assert.match(policy, /script-src [^;]*'unsafe-hashes'/);
  for (const handler of handlers) {
    assert.ok(policy.includes(sha256Source(handler)), `missing CSP hash for ${handler}`);
  }

  assert.doesNotMatch(policy, /IkX1IFP3nW742T5xQGJ\+bE0F5BrGSV46aX9UMFfVYqo/);
  assert.doesNotMatch(policy, /Cs\+fcN6ebPyf\+wJSG2nwqeW5mLZ6A2vzGS53hFjHa38/);
});

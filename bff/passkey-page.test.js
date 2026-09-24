'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { passkeyDestinations, renderPasskeyPage } = require('./passkey-page');

test('destinations use configured HTTPS origins and fixed paths', () => {
  assert.deepEqual(passkeyDestinations('https://auth.test:444/oauth/authorize?next=evil', 'https://ui.test/oauth/callback?next=evil'), {
    origin: 'https://auth.test:444', action: 'https://auth.test:444/webauthn/registration/new',
    returnUrl: 'https://ui.test/app/profile/mfa',
  });
  for (const invalid of ['http://auth.test', 'javascript:alert(1)', 'not a URL']) {
    assert.throws(() => passkeyDestinations(invalid, 'https://ui.test'));
    assert.throws(() => passkeyDestinations('https://auth.test', invalid));
  }
});

test('tokens are escaped in a hidden POST field, never a script or destination', () => {
  const token = '\"><script>alert(1)</script>&\'';
  const html = renderPasskeyPage('cs', token, passkeyDestinations('https://auth.test', 'https://ui.test'));
  assert.ok(!html.includes(token));
  assert.ok(!html.includes('<script'));
  assert.match(html, /name="access_token" value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;&amp;&#39;"/);
  assert.match(html, /<html lang="cs">/);
  assert.match(html, /method="post" action="https:\/\/auth.test\/webauthn\/registration\/new"/);
});

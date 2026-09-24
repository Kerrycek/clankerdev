import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

for (const [path, count] of [
  ['deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf', 1],
  ['deploy/kra.crucio.cz/nginx-kra.crucio.cz.conf', 1],
  ['deploy/deploy-clankerdev-ubuntu24.sh', 2],
]) {
  test(`${path}: only the exact handoff location delegates its policy to BFF`, () => {
    const source = fs.readFileSync(path, 'utf8');
    const blocks = [...source.matchAll(/location = \/oauth\/passkey \{([\s\S]*?)\n\s*\}/g)];
    assert.equal(blocks.length, count);
    for (const [, body] of blocks) {
      assert.match(body, /proxy_pass http:\/\/127\.0\.0\.1:/);
      assert.match(body, /proxy_set_header X-Forwarded-Proto/);
      // Local add_header prevents inheriting the server's self-only CSP.
      assert.match(body, /add_header Strict-Transport-Security "max-age=31536000" always;/);
      assert.match(body, /add_header Permissions-Policy/);
      assert.doesNotMatch(body, /proxy_hide_header|Content-Security-Policy|Referrer-Policy/);
    }
    assert.match(source, /form-action 'self'/);
  });
}

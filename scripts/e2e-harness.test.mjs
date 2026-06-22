import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  buildPlaywrightEnvironment,
  expandPlaywrightShortcuts,
  findBlockingChromiumPolicyFiles,
  normalizePlaywrightArgs,
  relaxChromiumUrlBlocklist,
  sanitizeChromiumUrlPolicy,
} from './e2e-harness.mjs';

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpsadmin-e2e-harness-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('e2e harness argument normalization', () => {
  it('keeps Playwright grep shortcuts and consumes local runner flags', () => {
    const normalized = normalizePlaywrightArgs([
      '--container',
      '--smoke',
      '--project=chromium',
      'e2e/specs/app/dashboard.spec.ts',
    ]);

    assert.equal(normalized.options.container, true);
    assert.equal(normalized.options.autoSystemChromium, true);
    assert.equal(normalized.options.noArtifacts, true);
    assert.equal(normalized.options.relaxChromiumPolicy, true);
    assert.deepEqual(normalized.playwrightArgs, [
      '--grep',
      '(^|\\s)@smoke(\\s|$)',
      '--project=chromium',
      'e2e/specs/app/dashboard.spec.ts',
    ]);
  });

  it('expands PR/mobile shortcuts without changing ordinary arguments', () => {
    assert.deepEqual(expandPlaywrightShortcuts(['--pr-smoke-mobile', '--workers=1']), [
      '--grep',
      '(^|\\s)@pr-smoke-mobile(\\s|$)',
      '--workers=1',
    ]);
  });
});

describe('e2e harness environment preparation', () => {
  it('sets system Chromium and disables artifacts for container runs', () => {
    withTempDir((dir) => {
      const chromium = path.join(dir, 'chromium');
      fs.writeFileSync(chromium, '#!/bin/sh\nexit 0\n');
      fs.chmodSync(chromium, 0o755);

      const prepared = buildPlaywrightEnvironment({
        action: 'test',
        args: ['--container'],
        env: { E2E_CHROMIUM_CANDIDATES: chromium },
      });

      assert.equal(prepared.env.E2E_CHROMIUM_EXECUTABLE_PATH, chromium);
      assert.equal(prepared.env.E2E_RECORD_ARTIFACTS, '0');
      assert.match(prepared.notes.join('\n'), /Using system Chromium/);
    });
  });

  it('does not override explicit executable or artifact settings', () => {
    const prepared = buildPlaywrightEnvironment({
      action: 'test',
      args: ['--container'],
      env: {
        E2E_CHROMIUM_EXECUTABLE_PATH: '/custom/chrome',
        E2E_RECORD_ARTIFACTS: '1',
      },
    });

    assert.equal(prepared.env.E2E_CHROMIUM_EXECUTABLE_PATH, '/custom/chrome');
    assert.equal(prepared.env.E2E_RECORD_ARTIFACTS, '1');
  });
});

describe('Chromium URLBlocklist policy relaxation', () => {
  it('removes only blocking URL policy entries and preserves unrelated policies', () => {
    const sanitized = sanitizeChromiumUrlPolicy({
      ExtensionInstallBlocklist: ['*'],
      URLBlocklist: ['*', 'https://blocked.example.test/*'],
      URLBlacklist: ['*'],
      DownloadRestrictions: 1,
    });

    assert.equal(sanitized.changed, true);
    assert.deepEqual(sanitized.policy.ExtensionInstallBlocklist, ['*']);
    assert.deepEqual(sanitized.policy.URLBlocklist, ['https://blocked.example.test/*']);
    assert.equal('URLBlacklist' in sanitized.policy, false);
    assert.ok(sanitized.policy.URLAllowlist.includes('http://127.0.0.1:*'));
    assert.equal(sanitized.policy.DownloadRestrictions, 1);
  });

  it('finds, relaxes, and restores blocking policy files', () => {
    withTempDir((dir) => {
      const policyFile = path.join(dir, '000_policy_merge.json');
      const nestedDir = path.join(dir, '.policy_merge');
      const nestedPolicyFile = path.join(nestedDir, '001_base_url_blocklist.json');
      fs.mkdirSync(nestedDir);
      const originalPolicy = {
        ExtensionInstallBlocklist: ['*'],
        URLBlocklist: ['*'],
        BrowserGuestModeEnabled: false,
      };
      const nestedPolicy = { URLBlocklist: ['*'] };
      fs.writeFileSync(policyFile, `${JSON.stringify(originalPolicy, null, 2)}\n`);
      fs.writeFileSync(nestedPolicyFile, `${JSON.stringify(nestedPolicy, null, 2)}\n`);

      assert.equal(findBlockingChromiumPolicyFiles({ dirs: [dir] }).length, 2);

      const relaxed = relaxChromiumUrlBlocklist({ dirs: [dir], pid: 12345 });
      assert.equal(relaxed.changed, 2);
      assert.match(relaxed.notes.join('\n'), /Temporarily relaxed Chromium URLBlocklist/);

      const duringRun = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
      assert.equal('URLBlocklist' in duringRun, false);
      assert.ok(duringRun.URLAllowlist.includes('http://127.0.0.1:*'));
      assert.deepEqual(duringRun.ExtensionInstallBlocklist, ['*']);
      const nestedDuringRun = JSON.parse(fs.readFileSync(nestedPolicyFile, 'utf8'));
      assert.equal('URLBlocklist' in nestedDuringRun, false);
      assert.ok(nestedDuringRun.URLAllowlist.includes('http://127.0.0.1:*'));
      assert.equal(fs.existsSync(`${policyFile}.vpsadmin-e2e-backup-12345`), false);
      assert.equal(fs.existsSync(`${nestedPolicyFile}.vpsadmin-e2e-backup-12345`), false);
      assert.ok(relaxed.backupDir);
      assert.equal(fs.readdirSync(relaxed.backupDir).length, 2);

      assert.deepEqual(relaxed.restore(), []);
      const restored = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
      const nestedRestored = JSON.parse(fs.readFileSync(nestedPolicyFile, 'utf8'));
      assert.deepEqual(restored, originalPolicy);
      assert.deepEqual(nestedRestored, nestedPolicy);
      assert.equal(fs.existsSync(`${policyFile}.vpsadmin-e2e-backup-12345`), false);
      assert.equal(fs.existsSync(`${nestedPolicyFile}.vpsadmin-e2e-backup-12345`), false);
      assert.equal(fs.existsSync(relaxed.backupDir), false);
      assert.deepEqual(relaxed.restore(), []);
    });
  });
});

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { atomicSwitchReleaseLink } from './dev-deploy-release-link.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(repoRoot, 'deploy', 'dev.crucio.cz', 'deploy-dev-crucio-clankerdev.sh');

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-deploy-contract-'));
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  git(source, ['init', '--quiet']);
  git(source, ['config', 'user.name', 'Deploy Test']);
  git(source, ['config', 'user.email', 'deploy-test@example.invalid']);
  fs.writeFileSync(path.join(source, '.gitignore'), 'dist/\nnode_modules/\noutput/\n');
  fs.mkdirSync(path.join(source, 'bff'));
  fs.writeFileSync(path.join(source, 'bff', 'server.js'), 'console.log("old bff");\n');
  fs.writeFileSync(path.join(source, 'bff', 'package.json'), '{"dependencies":{}}\n');
  copy(
    path.join(repoRoot, 'deploy', 'dev.crucio.cz', 'nginx-dev.crucio.cz.conf'),
    path.join(source, 'deploy', 'dev.crucio.cz', 'nginx-dev.crucio.cz.conf'),
  );
  copy(
    path.join(repoRoot, 'deploy', 'dev.crucio.cz', 'webui-next-bff.service'),
    path.join(source, 'deploy', 'dev.crucio.cz', 'webui-next-bff.service'),
  );
  copy(
    path.join(repoRoot, 'scripts', 'dev-deploy-provenance.mjs'),
    path.join(source, 'scripts', 'dev-deploy-provenance.mjs'),
  );
  copy(
    path.join(repoRoot, 'scripts', 'dev-deploy-release-link.mjs'),
    path.join(source, 'scripts', 'dev-deploy-release-link.mjs'),
  );
  git(source, ['add', '.']);
  git(source, ['commit', '--quiet', '-m', 'old release']);
  const oldCommit = git(source, ['rev-parse', 'HEAD']);

  const releaseRoot = path.join(root, 'release');
  const oldRelease = path.join(releaseRoot, 'releases', oldCommit);
  fs.mkdirSync(path.dirname(oldRelease), { recursive: true });
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', source, oldRelease]);
  git(oldRelease, ['checkout', '--quiet', '--detach', oldCommit]);
  const current = path.join(releaseRoot, 'current');
  atomicSwitchReleaseLink({ releaseRoot, current, target: oldRelease });

  fs.writeFileSync(path.join(source, 'bff', 'server.js'), 'console.log("new bff");\n');
  git(source, ['add', 'bff/server.js']);
  git(source, ['commit', '--quiet', '-m', 'new release']);
  const newCommit = git(source, ['rev-parse', 'HEAD']);

  const webroot = path.join(root, 'webroot', 'current');
  fs.mkdirSync(webroot, { recursive: true });
  fs.writeFileSync(path.join(webroot, 'index.html'), 'old frontend\n');
  fs.writeFileSync(path.join(webroot, 'build-info.json'), `${JSON.stringify({
    schemaVersion: 1,
    commit: oldCommit,
    shortCommit: oldCommit.slice(0, 12),
    dirty: false,
    source: 'git',
  })}\n`);

  const unit = path.join(root, 'etc', 'systemd', 'system', 'webui-next-bff.service');
  const nginxConfig = path.join(root, 'etc', 'nginx', 'sites-available', 'dev.crucio.cz');
  const nginxLink = path.join(root, 'etc', 'nginx', 'sites-enabled', 'dev.crucio.cz');
  fs.mkdirSync(path.dirname(unit), { recursive: true });
  fs.mkdirSync(path.dirname(nginxConfig), { recursive: true });
  fs.mkdirSync(path.dirname(nginxLink), { recursive: true });
  fs.writeFileSync(unit, 'legacy release unit\n');
  fs.writeFileSync(nginxConfig, 'legacy nginx config\n');
  fs.symlinkSync(nginxConfig, nginxLink);

  return {
    root,
    source,
    releaseRoot,
    oldRelease,
    oldCommit,
    newCommit,
    current,
    webroot,
    unit,
    nginxConfig,
    nginxLink,
  };
}

function runInjectedFailure(fixture, failure, options = {}) {
  const args = options.restrictiveUmask
    ? ['-c', 'umask 077; exec bash "$1" "$2"', 'dev-deploy-test', helper, fixture.source]
    : [helper, fixture.source];
  return spawnSync('bash', args, {
    cwd: fixture.source,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}`,
      DEV_DEPLOY_TEST_ROOT: fixture.root,
      DEV_DEPLOY_TEST_FAILURE: failure,
    },
  });
}

function assertRestored(fixture, result, expectedStatus) {
  assert.equal(result.status, expectedStatus, result.stderr);
  assert.equal(fs.realpathSync(fixture.current), fs.realpathSync(fixture.oldRelease));
  assert.equal(fs.readFileSync(path.join(fixture.webroot, 'index.html'), 'utf8'), 'old frontend\n');
  assert.equal(fs.readFileSync(fixture.unit, 'utf8'), 'legacy release unit\n');
  assert.equal(fs.readFileSync(fixture.nginxConfig, 'utf8'), 'legacy nginx config\n');
  assert.equal(fs.readlinkSync(fixture.nginxLink), fixture.nginxConfig);
  assert.match(result.stderr, /Rollback completed successfully/);
  const events = fs.readFileSync(path.join(fixture.root, 'events.log'), 'utf8').trim().split('\n');
  assert(events.filter((event) => event === 'restart-bff').length >= 1);
  assert.equal(events.at(-1), 'smoke-auth-endpoints');
  assert.equal(fs.existsSync(path.join(fixture.root, 'unit-state.json')), true);
  assert.equal(fs.existsSync(path.join(fixture.root, 'dev-deploy.lock')), false);
  assert.deepEqual(
    fs.readdirSync(fixture.root).filter((entry) => entry.startsWith('dev-crucio-deploy.')),
    [],
  );
}

for (const [failure, status] of [
  ['nginx', 70],
  ['validation', 73],
  ['restart', 71],
  ['health', 72],
]) {
  test(`deploy rollback restores all prior state after injected ${failure} failure`, () => {
    const fixture = createFixture();
    try {
      const result = runInjectedFailure(fixture, failure);
      assertRestored(fixture, result, status);
      const retained = path.join(fixture.releaseRoot, 'releases', fixture.newCommit);
      assert.equal(fs.existsSync(retained), true, 'immutable failed release remains available for diagnosis');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
}

test('a held deploy lock rejects a concurrent invocation before staging or publication', () => {
  const fixture = createFixture();
  try {
    fs.mkdirSync(path.join(fixture.root, 'dev-deploy.lock'));
    const result = runInjectedFailure(fixture, '');
    assert.equal(result.status, 75, result.stderr);
    assert.match(result.stderr, /Another dev deploy holds the test lock/);
    assert.equal(fs.realpathSync(fixture.current), fs.realpathSync(fixture.oldRelease));
    assert.equal(fs.readFileSync(path.join(fixture.webroot, 'index.html'), 'utf8'), 'old frontend\n');
    assert.equal(
      fs.existsSync(path.join(fixture.releaseRoot, 'releases', fixture.newCommit)),
      false,
      'concurrent invocation must stop before release staging',
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('first-rollout failure restores the legacy unit and leaves no current link', () => {
  const fixture = createFixture();
  try {
    fs.unlinkSync(fixture.current);
    const result = runInjectedFailure(fixture, 'validation');
    assert.equal(result.status, 73, result.stderr);
    assert.equal(fs.existsSync(fixture.current), false);
    assert.equal(fs.readFileSync(fixture.unit, 'utf8'), 'legacy release unit\n');
    assert.equal(fs.readFileSync(path.join(fixture.webroot, 'index.html'), 'utf8'), 'old frontend\n');
    assert.match(result.stderr, /Rollback completed successfully/);
    assert.equal(fs.existsSync(path.join(fixture.root, 'dev-deploy.lock')), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('successful deploy aligns frontend, current BFF release and unit despite source audit artifacts', () => {
  const fixture = createFixture();
  try {
    fs.writeFileSync(path.join(fixture.source, 'password-recovery-live-audit.txt'), 'do not deploy\n');
    const result = runInjectedFailure(fixture, '', { restrictiveUmask: true });
    assert.equal(result.status, 0, result.stderr);
    const release = path.join(fixture.releaseRoot, 'releases', fixture.newCommit);
    assert.equal(fs.realpathSync(fixture.current), fs.realpathSync(release));
    const buildInfo = JSON.parse(
      fs.readFileSync(path.join(fixture.webroot, 'build-info.json'), 'utf8'),
    );
    assert.equal(buildInfo.commit, fixture.newCommit);
    assert.equal(buildInfo.dirty, false);
    assert.match(fs.readFileSync(fixture.unit, 'utf8'), /clankerdev-release\/current\/bff/);
    assert.equal(fs.statSync(release).mode & 0o777, 0o755);
    assert.equal(fs.statSync(path.join(release, 'bff')).mode & 0o005, 0o005);
    assert.equal(fs.statSync(path.join(release, 'bff', 'server.js')).mode & 0o004, 0o004);
    assert.equal(fs.existsSync(path.join(release, 'password-recovery-live-audit.txt')), false);
    assert.equal(fs.existsSync(path.join(fixture.root, 'dev-deploy.lock')), false);
    assert.deepEqual(
      fs.readdirSync(fixture.root).filter((entry) => entry.startsWith('dev-crucio-deploy.')),
      [],
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('an unreadable reused release is rejected before active state changes', () => {
  const fixture = createFixture();
  try {
    const release = path.join(fixture.releaseRoot, 'releases', fixture.newCommit);
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', fixture.source, release]);
    git(release, ['checkout', '--quiet', '--detach', fixture.newCommit]);
    fs.mkdirSync(path.join(release, 'dist'));
    fs.writeFileSync(path.join(release, 'dist', 'build-info.json'), `${JSON.stringify({
      schemaVersion: 1,
      commit: fixture.newCommit,
      shortCommit: fixture.newCommit.slice(0, 12),
      dirty: false,
      source: 'git',
    })}\n`);
    fs.chmodSync(release, 0o700);

    const result = runInjectedFailure(fixture, '');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /BFF release is not readable\/traversable/);
    assert.equal(fs.realpathSync(fixture.current), fs.realpathSync(fixture.oldRelease));
    assert.equal(fs.readFileSync(path.join(fixture.webroot, 'index.html'), 'utf8'), 'old frontend\n');
    assert.equal(fs.existsSync(path.join(fixture.root, 'dev-deploy.lock')), false);
  } finally {
    fs.chmodSync(path.join(fixture.releaseRoot, 'releases', fixture.newCommit), 0o755);
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyDevDeployProvenance } from './dev-deploy-provenance.mjs';
import { atomicSwitchReleaseLink, removeReleaseLink } from './dev-deploy-release-link.mjs';

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-deploy-provenance-'));
  const source = path.join(root, 'source');
  const releaseRoot = path.join(root, 'release');
  const releases = path.join(releaseRoot, 'releases');
  fs.mkdirSync(source);
  fs.mkdirSync(releases, { recursive: true });
  git(source, ['init', '--quiet']);
  git(source, ['config', 'user.name', 'Deploy Test']);
  git(source, ['config', 'user.email', 'deploy-test@example.invalid']);
  fs.mkdirSync(path.join(source, 'bff'));
  fs.writeFileSync(path.join(source, 'bff', 'server.js'), 'console.log("fixture");\n');
  fs.writeFileSync(path.join(source, '.gitignore'), 'dist/\nnode_modules/\noutput/\n');
  git(source, ['add', '.']);
  git(source, ['commit', '--quiet', '-m', 'fixture']);
  const commit = git(source, ['rev-parse', 'HEAD']);
  const release = path.join(releases, commit);
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', source, release]);
  git(release, ['checkout', '--quiet', '--detach', commit]);
  const current = path.join(releaseRoot, 'current');
  atomicSwitchReleaseLink({ releaseRoot, current, target: release });
  const buildInfo = path.join(root, 'build-info.json');
  fs.writeFileSync(buildInfo, `${JSON.stringify({
    schemaVersion: 1,
    commit,
    shortCommit: commit.slice(0, 12),
    dirty: false,
    source: 'git',
  })}\n`);
  const unitState = path.join(root, 'unit-state.json');
  fs.writeFileSync(unitState, `${JSON.stringify({
    workingDirectory: path.join(current, 'bff'),
    execStart: `/usr/bin/node ${path.join(current, 'bff', 'server.js')}`,
    mainPID: 42,
    processCwd: path.join(release, 'bff'),
  })}\n`);
  return { root, source, releaseRoot, release, current, buildInfo, unitState, commit };
}

function verify(fixture, overrides = {}) {
  return verifyDevDeployProvenance({
    expected: fixture.commit,
    sourceRepo: fixture.source,
    buildInfo: fixture.buildInfo,
    releaseRoot: fixture.releaseRoot,
    releaseRepo: fixture.release,
    unit: 'fixture.service',
    unitStateFile: fixture.unitState,
    ...overrides,
  });
}

test('provenance distinguishes and aligns source, frontend, configured unit and process commits', () => {
  const fixture = createFixture();
  try {
    const report = verify(fixture);
    assert.equal(report.ok, true);
    assert.equal(report.source.commit, fixture.commit);
    assert.equal(report.frontend.commit, fixture.commit);
    assert.equal(report.release.commit, fixture.commit);
    assert.equal(report.runtime.configuredCommit, fixture.commit);
    assert.equal(report.runtime.processCommit, fixture.commit);
    assert.equal(report.runtime.configuredCheckout, fs.realpathSync(fixture.release));
    assert.equal(report.runtime.processCheckout, fs.realpathSync(fixture.release));
    assert.equal(report.source.untrackedCount, 0);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('provenance permits benign untracked source artifacts but rejects tracked changes', () => {
  const fixture = createFixture();
  try {
    fs.writeFileSync(path.join(fixture.source, 'audit-artifact.txt'), 'private audit artifact\n');
    const untrackedReport = verify(fixture);
    assert.equal(untrackedReport.ok, true);
    assert.equal(untrackedReport.source.trackedClean, true);
    assert.equal(untrackedReport.source.untrackedCount, 1);

    fs.writeFileSync(path.join(fixture.source, 'bff', 'server.js'), 'tracked drift\n');
    assert.throws(() => verify(fixture), /Deploy source checkout is not clean/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('provenance rejects the release root itself as a release checkout', () => {
  const fixture = createFixture();
  try {
    assert.throws(
      () => verify(fixture, { releaseRepo: fixture.releaseRoot, skipRuntime: true }),
      /Staged BFF release checkout.*release root/i,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('provenance rejects frontend and active-process commit drift', () => {
  const fixture = createFixture();
  try {
    const wrongCommit = 'f'.repeat(40);
    const buildInfo = JSON.parse(fs.readFileSync(fixture.buildInfo, 'utf8'));
    fs.writeFileSync(fixture.buildInfo, `${JSON.stringify({ ...buildInfo, commit: wrongCommit })}\n`);
    assert.throws(() => verify(fixture), /published frontend commit .* differs from expected/i);

    fs.writeFileSync(fixture.buildInfo, `${JSON.stringify(buildInfo)}\n`);
    const foreign = path.join(fixture.releaseRoot, 'releases', 'foreign');
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', fixture.source, foreign]);
    const state = JSON.parse(fs.readFileSync(fixture.unitState, 'utf8'));
    fs.writeFileSync(fixture.unitState, `${JSON.stringify({ ...state, processCwd: path.join(foreign, 'bff') })}\n`);
    assert.throws(() => verify(fixture), /Active BFF process checkout differs from staged release/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('atomic release link replacement is contained and removable only for the expected target', () => {
  const fixture = createFixture();
  try {
    const second = path.join(fixture.releaseRoot, 'releases', 'second');
    fs.mkdirSync(second);
    const switched = atomicSwitchReleaseLink({
      releaseRoot: fixture.releaseRoot,
      current: fixture.current,
      target: second,
    });
    assert.equal(switched.target, fs.realpathSync(second));
    assert.equal(fs.realpathSync(fixture.current), fs.realpathSync(second));
    assert.throws(
      () => removeReleaseLink({
        releaseRoot: fixture.releaseRoot,
        current: fixture.current,
        expectedTarget: fixture.release,
      }),
      /unexpected target/,
    );
    assert.equal(removeReleaseLink({
      releaseRoot: fixture.releaseRoot,
      current: fixture.current,
      expectedTarget: second,
    }).removed, true);
    assert.equal(fs.existsSync(fixture.current), false);
    assert.throws(
      () => atomicSwitchReleaseLink({
        releaseRoot: fixture.releaseRoot,
        current: fixture.current,
        target: fixture.releaseRoot,
      }),
      /must be below release root/,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

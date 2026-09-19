#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const FULL_SHA = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(message);
}

function normalizeSha(value, label) {
  const sha = String(value ?? '').trim().toLowerCase();
  if (!FULL_SHA.test(sha)) fail(`${label} must be a full 40-character Git SHA.`);
  return sha;
}

function realDirectory(value, label) {
  const resolved = fs.realpathSync(String(value));
  if (!fs.statSync(resolved).isDirectory()) fail(`${label} is not a directory: ${resolved}`);
  return resolved;
}

function assertWithin(root, target, label) {
  const relative = path.relative(root, target);
  if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) return target;
  fail(`${label} escapes release root ${root}: ${target}`);
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function repositoryState(repo, label, { includeUntracked = false } = {}) {
  const resolved = realDirectory(repo, label);
  const commit = normalizeSha(git(resolved, ['rev-parse', 'HEAD']), `${label} commit`);
  const trackedDirty = git(resolved, ['status', '--porcelain', '--untracked-files=no']).length > 0;
  const untrackedOutput = execFileSync(
    'git',
    ['-C', resolved, 'ls-files', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const untrackedCount = untrackedOutput.split('\0').filter(Boolean).length;
  if (trackedDirty || (includeUntracked && untrackedCount > 0)) {
    fail(`${label} is not clean: ${resolved}`);
  }
  return { path: resolved, commit, trackedDirty, untrackedCount };
}

function buildInfoState(buildInfoPath) {
  const resolved = fs.realpathSync(String(buildInfoPath));
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const commit = normalizeSha(parsed?.commit, 'Published frontend build-info commit');
  if (parsed?.dirty !== false) fail(`Published frontend build-info is dirty: ${resolved}`);
  return {
    path: resolved,
    commit,
    dirty: parsed.dirty,
    source: typeof parsed.source === 'string' ? parsed.source : 'unknown',
  };
}

function systemdValue(unit, property) {
  return execFileSync('systemctl', ['show', unit, `--property=${property}`, '--value'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readUnitState(options) {
  if (options.unitStateFile) {
    return JSON.parse(fs.readFileSync(options.unitStateFile, 'utf8'));
  }

  const mainPID = Number(systemdValue(options.unit, 'MainPID'));
  return {
    workingDirectory: systemdValue(options.unit, 'WorkingDirectory'),
    execStart: systemdValue(options.unit, 'ExecStart'),
    mainPID,
    processCwd: Number.isSafeInteger(mainPID) && mainPID > 0
      ? fs.realpathSync(`/proc/${mainPID}/cwd`)
      : '',
  };
}

function runtimeState(options, expected, releaseRoot, expectedRelease) {
  const state = readUnitState(options);
  const workingDirectory = String(state.workingDirectory ?? '').trim();
  const execStart = String(state.execStart ?? '').trim();
  const mainPID = Number(state.mainPID);
  if (!workingDirectory) fail('Configured BFF WorkingDirectory is empty.');
  if (!execStart) fail('Configured BFF ExecStart is empty.');
  if (!Number.isSafeInteger(mainPID) || mainPID <= 0) fail('BFF has no running main process.');

  const configuredWorkdir = fs.realpathSync(workingDirectory);
  const configuredCheckout = assertWithin(
    releaseRoot,
    realDirectory(path.dirname(configuredWorkdir), 'Configured BFF checkout'),
    'Configured BFF checkout',
  );
  const processWorkdir = fs.realpathSync(String(state.processCwd ?? ''));
  const processCheckout = assertWithin(
    releaseRoot,
    realDirectory(path.dirname(processWorkdir), 'Active BFF process checkout'),
    'Active BFF process checkout',
  );

  if (configuredWorkdir !== path.join(configuredCheckout, 'bff')) {
    fail(`Configured BFF WorkingDirectory is not the checkout bff directory: ${configuredWorkdir}`);
  }
  if (processWorkdir !== path.join(processCheckout, 'bff')) {
    fail(`Active BFF process CWD is not the checkout bff directory: ${processWorkdir}`);
  }
  if (configuredCheckout !== expectedRelease.path) {
    fail(`Configured BFF checkout differs from staged release: ${configuredCheckout}`);
  }
  if (processCheckout !== expectedRelease.path) {
    fail(`Active BFF process checkout differs from staged release: ${processCheckout}`);
  }
  if (!execStart.includes(`${workingDirectory}/server.js`)) {
    fail(`BFF ExecStart does not use server.js below configured WorkingDirectory: ${execStart}`);
  }

  const configured = repositoryState(configuredCheckout, 'Configured BFF checkout', {
    includeUntracked: true,
  });
  const process = repositoryState(processCheckout, 'Active BFF process checkout', {
    includeUntracked: true,
  });
  for (const [label, commit] of [
    ['configured BFF checkout', configured.commit],
    ['active BFF process checkout', process.commit],
  ]) {
    if (commit !== expected) fail(`${label} commit ${commit} differs from expected ${expected}.`);
  }

  return {
    unit: options.unit,
    workingDirectory,
    configuredCheckout: configured.path,
    configuredCommit: configured.commit,
    execStartMatchesWorkingDirectory: true,
    mainPID,
    processCwd: processWorkdir,
    processCheckout: process.path,
    processCommit: process.commit,
    processUntrackedCount: process.untrackedCount,
  };
}

export function verifyDevDeployProvenance(options) {
  const expected = normalizeSha(options.expected, 'Expected deploy commit');
  const releaseRoot = realDirectory(options.releaseRoot, 'Release root');
  const releasePath = assertWithin(
    releaseRoot,
    realDirectory(options.releaseRepo, 'Staged BFF release checkout'),
    'Staged BFF release checkout',
  );
  const source = repositoryState(options.sourceRepo, 'Deploy source checkout');
  const frontend = buildInfoState(options.buildInfo);
  const release = repositoryState(releasePath, 'Staged BFF release checkout', {
    includeUntracked: true,
  });

  for (const [label, commit] of [
    ['deploy source checkout', source.commit],
    ['published frontend', frontend.commit],
    ['staged BFF release checkout', release.commit],
  ]) {
    if (commit !== expected) fail(`${label} commit ${commit} differs from expected ${expected}.`);
  }
  const runtime = options.skipRuntime
    ? null
    : runtimeState(options, expected, releaseRoot, release);

  return {
    ok: true,
    expectedCommit: expected,
    source: {
      path: source.path,
      commit: source.commit,
      trackedClean: true,
      untrackedCount: source.untrackedCount,
    },
    frontend: { path: frontend.path, commit: frontend.commit, dirty: false, source: frontend.source },
    release: { path: release.path, commit: release.commit, clean: true, untrackedCount: 0 },
    runtime,
  };
}

function parseArgs(argv) {
  const values = {};
  const boolean = new Set(['skip-runtime']);
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) fail(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    if (boolean.has(key)) {
      values[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for --${key}.`);
    values[key] = value;
    index += 1;
  }
  return {
    expected: values.expected,
    sourceRepo: values['source-repo'],
    buildInfo: values['build-info'],
    releaseRoot: values['release-root'],
    releaseRepo: values['release-repo'],
    unit: values.unit ?? 'webui-next-bff.service',
    unitStateFile: values['unit-state-file'],
    skipRuntime: values['skip-runtime'] === true,
  };
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  try {
    const report = verifyDevDeployProvenance(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Dev deploy provenance check failed: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}

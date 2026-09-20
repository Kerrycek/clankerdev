#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  throw new Error(message);
}

function realDirectory(value, label) {
  const resolved = fs.realpathSync(String(value));
  if (!fs.statSync(resolved).isDirectory()) fail(`${label} is not a directory: ${resolved}`);
  return resolved;
}

function assertWithin(root, target, label) {
  const relative = path.relative(root, target);
  if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) return target;
  fail(`${label} must be below release root ${root}: ${target}`);
}

function validateCurrentPath(root, current) {
  const requested = path.resolve(String(current));
  const parent = fs.realpathSync(path.dirname(requested));
  const absolute = path.join(parent, path.basename(requested));
  if (parent !== root) fail(`Current link must be directly below release root ${root}.`);
  let exists = true;
  try {
    if (!fs.lstatSync(absolute).isSymbolicLink()) {
      fail(`Refusing to replace non-symlink current path: ${absolute}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    exists = false;
  }
  return { path: absolute, exists };
}

export function atomicSwitchReleaseLink({ releaseRoot, current, target }) {
  const root = realDirectory(releaseRoot, 'Release root');
  const { path: currentPath } = validateCurrentPath(root, current);
  const targetPath = assertWithin(root, realDirectory(target, 'Release target'), 'Release target');
  const relativeTarget = path.relative(root, targetPath);
  const temporary = path.join(root, `.current-${process.pid}-${crypto.randomUUID()}`);

  fs.symlinkSync(relativeTarget, temporary, 'dir');
  try {
    fs.renameSync(temporary, currentPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Preserve the original atomic-replace failure.
    }
    throw error;
  }

  const resolvedCurrent = fs.realpathSync(currentPath);
  if (resolvedCurrent !== targetPath) {
    fail(`Atomic current-link verification failed: expected ${targetPath}, got ${resolvedCurrent}`);
  }
  return { current: currentPath, target: targetPath };
}

export function removeReleaseLink({ releaseRoot, current, expectedTarget }) {
  const root = realDirectory(releaseRoot, 'Release root');
  const { path: currentPath, exists } = validateCurrentPath(root, current);
  if (!exists) return { current: currentPath, removed: false };
  const currentTarget = fs.realpathSync(currentPath);
  const expected = assertWithin(
    root,
    realDirectory(expectedTarget, 'Expected release target'),
    'Expected release target',
  );
  if (currentTarget !== expected) {
    fail(`Refusing to remove current link for unexpected target ${currentTarget}; expected ${expected}.`);
  }
  fs.unlinkSync(currentPath);
  return { current: currentPath, target: expected, removed: true };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || !value) fail(`Invalid argument near ${key ?? '[end]'}.`);
    values[key.slice(2)] = value;
  }
  return { command, values };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { command, values } = parseArgs(process.argv.slice(2));
    let result;
    if (command === 'switch') {
      result = atomicSwitchReleaseLink({
        releaseRoot: values.root,
        current: values.current,
        target: values.target,
      });
    } else if (command === 'remove') {
      result = removeReleaseLink({
        releaseRoot: values.root,
        current: values.current,
        expectedTarget: values['expected-target'],
      });
    } else {
      fail(
        'Usage: dev-deploy-release-link.mjs switch --root PATH --current PATH --target PATH '
        + '| remove --root PATH --current PATH --expected-target PATH',
      );
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Release-link operation failed: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}

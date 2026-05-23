#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readPinnedVersion() {
  const envVersion = process.env.PLAYWRIGHT_VERSION?.trim();
  if (envVersion) return envVersion;

  // scripts/playwright.mjs -> e2e/PLAYWRIGHT_VERSION
  const versionFile = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'e2e',
    'PLAYWRIGHT_VERSION',
  );

  try {
    const v = fs.readFileSync(versionFile, 'utf8').trim();
    if (!v) throw new Error('empty version file');
    return v;
  } catch (e) {
    console.error(`Failed to read Playwright version from ${versionFile}:`, e);
    process.exit(2);
  }
}

function usage() {
  console.log(`\nPinned Playwright runner.\n\nUsage:\n  node scripts/playwright.mjs install [args...]\n  node scripts/playwright.mjs test [args...]\n\nNotes:\n  - Version is read from e2e/PLAYWRIGHT_VERSION (or PLAYWRIGHT_VERSION env).\n  - This intentionally uses npx so Playwright stays out of package-lock until we decide to pin it there.\n`);
}

const [action, ...args] = process.argv.slice(2);

if (!action || action === '-h' || action === '--help') {
  usage();
  process.exit(action ? 0 : 2);
}

if (action !== 'install' && action !== 'test') {
  console.error(`Unknown action: ${action}`);
  usage();
  process.exit(2);
}

// Convenience: allow `--smoke` / `--smoke-mobile` without fragile regex quoting.
// These expand to a grep pattern that matches the tag as a standalone token.
const normalizedArgs = [];
for (const a of args) {
  if (a === '--smoke') {
    normalizedArgs.push('--grep', '(^|\\s)@smoke(\\s|$)');
    continue;
  }
  if (a === '--smoke-mobile') {
    normalizedArgs.push('--grep', '(^|\\s)@smoke-mobile(\\s|$)');
    continue;
  }
  normalizedArgs.push(a);
}

const version = readPinnedVersion();
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const cmdArgs = ['-y', `@playwright/test@${version}`, action, ...normalizedArgs];

const res = spawnSync(npxCmd, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(res.status ?? 1);

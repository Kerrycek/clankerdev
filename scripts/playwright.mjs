#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  buildPlaywrightEnvironment,
  relaxChromiumUrlBlocklist,
  shouldRelaxChromiumPolicy,
} from './e2e-harness.mjs';

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
  console.log(`
Pinned Playwright runner.

Usage:
  node scripts/playwright.mjs install [args...]
  node scripts/playwright.mjs test [args...]
  node scripts/playwright.mjs test --container [args...]

Runner-only test flags:
  --container                  Use system Chromium, disable artifacts, and temporarily relax local URLBlocklist policy.
  --auto-system-chromium       Set E2E_CHROMIUM_EXECUTABLE_PATH from common Chromium paths when unset.
  --no-artifacts               Set E2E_RECORD_ARTIFACTS=0 when unset.
  --relax-chromium-policy      Temporarily remove blocking '*' entries from Chromium URLBlocklist policies.

Notes:
  - Version is read from e2e/PLAYWRIGHT_VERSION (or PLAYWRIGHT_VERSION env).
  - This intentionally uses npx so Playwright stays out of package-lock until we decide to pin it there.
`);
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

const harness = buildPlaywrightEnvironment({ action, args });
for (const note of harness.notes) console.error(`[e2e] ${note}`);
for (const warning of harness.warnings) console.error(`[e2e] Warning: ${warning}`);

let restoreChromiumPolicy = () => [];
if (shouldRelaxChromiumPolicy({ action, options: harness.options, env: harness.env })) {
  const relaxed = relaxChromiumUrlBlocklist({});
  restoreChromiumPolicy = relaxed.restore;
  if (relaxed.changed === 0 && relaxed.warnings.length === 0) {
    console.error('[e2e] No blocking Chromium URLBlocklist policy found.');
  }
  for (const note of relaxed.notes) console.error(`[e2e] ${note}`);
  for (const warning of relaxed.warnings) console.error(`[e2e] Warning: ${warning}`);
}

const version = readPinnedVersion();
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const cmdArgs = ['-y', `@playwright/test@${version}`, action, ...harness.playwrightArgs];

let res;
try {
  res = spawnSync(npxCmd, cmdArgs, {
    stdio: 'inherit',
    env: harness.env,
  });
} finally {
  for (const warning of restoreChromiumPolicy()) console.error(`[e2e] Warning: ${warning}`);
}

if (res?.error) {
  console.error(`[e2e] Failed to run Playwright: ${res.error.message}`);
  process.exit(1);
}

if (res?.signal) {
  const signalExitCode = res.signal === 'SIGINT' ? 130 : res.signal === 'SIGTERM' ? 143 : 1;
  process.exit(signalExitCode);
}

process.exit(res?.status ?? 1);

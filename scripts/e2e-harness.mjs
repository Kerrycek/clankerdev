#!/usr/bin/env node
/**
 * Small helpers for the Playwright wrapper.
 *
 * The default CI path still uses Playwright-managed browsers. These helpers are
 * intentionally opt-in for locked-down local/container hosts where only a
 * system Chromium is available and machine policies block localhost.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const PLAYWRIGHT_SHORTCUTS = new Map([
  ['--smoke', ['--grep', '(^|\\s)@smoke(\\s|$)']],
  ['--smoke-mobile', ['--grep', '(^|\\s)@smoke-mobile(\\s|$)']],
  ['--pr-smoke', ['--grep', '(^|\\s)@pr-smoke(\\s|$)']],
  ['--pr-smoke-mobile', ['--grep', '(^|\\s)@pr-smoke-mobile(\\s|$)']],
  ['--live-manual', ['--grep', '(^|\\s)@live-manual(\\s|$)']],
]);

export const DEFAULT_CHROMIUM_EXECUTABLE_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

export const DEFAULT_CHROMIUM_COMMANDS = [
  'chromium',
  'chromium-browser',
  'google-chrome-stable',
  'google-chrome',
];

export const DEFAULT_CHROMIUM_POLICY_DIRS = [
  '/etc/chromium/policies/managed',
  '/etc/opt/chrome/policies/managed',
];

export const DEFAULT_CHROMIUM_E2E_URL_ALLOWLIST = [
  'http://127.0.0.1:*',
  'http://127.0.0.1:*/*',
  'http://localhost:*',
  'http://localhost:*/*',
  'ws://127.0.0.1:*',
  'ws://127.0.0.1:*/*',
  'ws://localhost:*',
  'ws://localhost:*/*',
];

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitList(value, delimiter = path.delimiter) {
  const raw = cleanEnvValue(value);
  if (!raw) return [];
  return raw
    .split(delimiter)
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter(Boolean);
}

function isExecutable(candidate, fsLike = fs) {
  if (!candidate) return false;
  try {
    const stat = fsLike.statSync(candidate);
    if (!stat.isFile() && !stat.isSymbolicLink?.()) return false;
    fsLike.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function firstUnique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function expandPlaywrightShortcuts(args) {
  const out = [];
  for (const arg of args) {
    const replacement = PLAYWRIGHT_SHORTCUTS.get(arg);
    if (replacement) out.push(...replacement);
    else out.push(arg);
  }
  return out;
}

export function splitE2eRunnerArgs(args) {
  const options = {
    container: false,
    autoSystemChromium: false,
    noArtifacts: false,
    relaxChromiumPolicy: false,
  };
  const playwrightArgs = [];

  for (const arg of args) {
    if (arg === '--container') {
      options.container = true;
      continue;
    }
    if (arg === '--auto-system-chromium') {
      options.autoSystemChromium = true;
      continue;
    }
    if (arg === '--no-artifacts') {
      options.noArtifacts = true;
      continue;
    }
    if (arg === '--relax-chromium-policy') {
      options.relaxChromiumPolicy = true;
      continue;
    }
    playwrightArgs.push(arg);
  }

  if (options.container) {
    options.autoSystemChromium = true;
    options.noArtifacts = true;
    options.relaxChromiumPolicy = true;
  }

  return { playwrightArgs, options };
}

export function normalizePlaywrightArgs(args) {
  const { playwrightArgs, options } = splitE2eRunnerArgs(args);
  return { playwrightArgs: expandPlaywrightShortcuts(playwrightArgs), options };
}

export function findSystemChromium({ env = process.env, fs: fsLike = fs, spawnSync: spawn = spawnSync } = {}) {
  const explicitCandidates = splitList(env.E2E_CHROMIUM_CANDIDATES);
  const candidates = firstUnique([...explicitCandidates, ...DEFAULT_CHROMIUM_EXECUTABLE_CANDIDATES]);

  for (const candidate of candidates) {
    if (isExecutable(candidate, fsLike)) return candidate;
  }

  for (const command of DEFAULT_CHROMIUM_COMMANDS) {
    try {
      const result = spawn(command, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (result.status === 0) {
        const which = spawn('command', ['-v', command], {
          encoding: 'utf8',
          shell: true,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const resolved = cleanEnvValue(which.stdout);
        if (resolved && isExecutable(resolved, fsLike)) return resolved;
      }
    } catch {
      // Continue to the next command.
    }
  }

  return undefined;
}

export function buildPlaywrightEnvironment({ action, args, env = process.env, fs: fsLike = fs, spawnSync: spawn = spawnSync } = {}) {
  const { playwrightArgs, options } = normalizePlaywrightArgs(args ?? []);
  const nextEnv = { ...env };
  const notes = [];
  const warnings = [];

  const isTestRun = action === 'test';
  const wantsSystemChromium =
    isTestRun && (options.autoSystemChromium || isTruthy(nextEnv.E2E_AUTO_SYSTEM_CHROMIUM));

  if (wantsSystemChromium && !cleanEnvValue(nextEnv.E2E_CHROMIUM_EXECUTABLE_PATH)) {
    const chromiumPath = findSystemChromium({ env: nextEnv, fs: fsLike, spawnSync: spawn });
    if (chromiumPath) {
      nextEnv.E2E_CHROMIUM_EXECUTABLE_PATH = chromiumPath;
      notes.push(`Using system Chromium at ${chromiumPath}`);
    } else {
      warnings.push('System Chromium was requested, but no executable was found.');
    }
  }

  const wantsNoArtifacts = isTestRun && (options.noArtifacts || isTruthy(nextEnv.E2E_NO_ARTIFACTS));
  if (wantsNoArtifacts && !hasOwn(nextEnv, 'E2E_RECORD_ARTIFACTS')) {
    nextEnv.E2E_RECORD_ARTIFACTS = '0';
    notes.push('Disabled Playwright trace/video/screenshot artifacts for this run.');
  }

  return { playwrightArgs, options, env: nextEnv, notes, warnings };
}

export function shouldRelaxChromiumPolicy({ action, options, env = process.env } = {}) {
  return action === 'test' && Boolean(options?.relaxChromiumPolicy || isTruthy(env.E2E_RELAX_CHROMIUM_POLICY));
}

export function getChromiumPolicyDirs(env = process.env) {
  const configured = splitList(env.E2E_CHROMIUM_POLICY_DIRS);
  return configured.length > 0 ? configured : DEFAULT_CHROMIUM_POLICY_DIRS;
}

function walkPolicyDir(dir, fsLike, files, depth = 0) {
  if (depth > 4) return;

  let entries;
  try {
    entries = fsLike.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Missing policy dirs are common on CI and developer machines.
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPolicyDir(full, fsLike, files, depth + 1);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (entry.name.includes('.vpsadmin-e2e-backup-')) continue;
    files.push(full);
  }
}

export function listChromiumPolicyFiles(dirs, fsLike = fs) {
  const files = [];
  for (const dir of dirs) walkPolicyDir(dir, fsLike, files);
  return files.sort((a, b) => a.localeCompare(b));
}

export function sanitizeChromiumUrlPolicy(policy, allowlist = DEFAULT_CHROMIUM_E2E_URL_ALLOWLIST) {
  const sanitized = { ...policy };
  let changed = false;

  for (const key of ['URLBlocklist', 'URLBlacklist']) {
    const value = sanitized[key];
    if (!Array.isArray(value)) continue;
    if (!value.includes('*')) continue;

    const next = value.filter((item) => item !== '*');
    if (next.length > 0) sanitized[key] = next;
    else delete sanitized[key];
    changed = true;
  }

  if (changed) {
    const currentAllowlist = Array.isArray(sanitized.URLAllowlist) ? sanitized.URLAllowlist : [];
    const mergedAllowlist = firstUnique([...currentAllowlist, ...allowlist]);
    sanitized.URLAllowlist = mergedAllowlist;
  }

  return { changed, policy: sanitized };
}

export function findBlockingChromiumPolicyFiles({ dirs = getChromiumPolicyDirs(), fs: fsLike = fs } = {}) {
  const affected = [];
  for (const file of listChromiumPolicyFiles(dirs, fsLike)) {
    try {
      const originalText = fsLike.readFileSync(file, 'utf8');
      const parsed = JSON.parse(originalText);
      const { changed, policy } = sanitizeChromiumUrlPolicy(parsed);
      if (!changed) continue;
      affected.push({
        file,
        originalText,
        sanitizedText: `${JSON.stringify(policy, null, 2)}\n`,
      });
    } catch {
      // Ignore malformed policy fragments; Chromium will ignore or report them too.
    }
  }
  return affected;
}

function createBackupDir(pid, fsLike) {
  const tmpRoot = typeof os.tmpdir === 'function' ? os.tmpdir() : '/tmp';
  return fsLike.mkdtempSync(path.join(tmpRoot, `vpsadmin-e2e-policy-${pid}-`));
}

export function relaxChromiumUrlBlocklist({ dirs = getChromiumPolicyDirs(), fs: fsLike = fs, pid = process.pid } = {}) {
  const affected = findBlockingChromiumPolicyFiles({ dirs, fs: fsLike });
  const notes = [];
  const warnings = [];
  const restorations = [];
  const backupDir = affected.length > 0 ? createBackupDir(pid, fsLike) : undefined;

  affected.forEach((item, index) => {
    const backupPath = path.join(backupDir, `${String(index + 1).padStart(3, '0')}-${path.basename(item.file)}`);
    try {
      const stat = fsLike.statSync(item.file);
      fsLike.copyFileSync(item.file, backupPath);
      fsLike.writeFileSync(item.file, item.sanitizedText, 'utf8');
      fsLike.chmodSync(item.file, stat.mode);
      restorations.push({ file: item.file, backupPath, mode: stat.mode });
      notes.push(`Temporarily relaxed Chromium URLBlocklist in ${item.file}`);
    } catch (error) {
      try {
        if (fsLike.existsSync(backupPath)) fsLike.unlinkSync(backupPath);
      } catch {
        // Best-effort cleanup only.
      }
      warnings.push(
        `Could not relax Chromium policy ${item.file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  let restored = false;
  function restore() {
    if (restored) return [];
    restored = true;
    const restoreWarnings = [];

    for (const item of restorations.slice().reverse()) {
      try {
        fsLike.copyFileSync(item.backupPath, item.file);
        fsLike.chmodSync(item.file, item.mode);
      } catch (error) {
        restoreWarnings.push(
          `Could not restore Chromium policy ${item.file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (backupDir) {
      try {
        fsLike.rmSync(backupDir, { recursive: true, force: true });
      } catch (error) {
        restoreWarnings.push(
          `Could not remove Chromium policy backup directory ${backupDir}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return restoreWarnings;
  }

  return { changed: restorations.length, notes, warnings, backupDir, restore };
}

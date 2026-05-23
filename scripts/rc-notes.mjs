#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function safeReadText(relPath) {
  try {
    return readText(relPath);
  } catch {
    return '';
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch {
    return '';
  }
}

function formatPragueDateTime(date) {
  try {
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    // sv-SE formatting is stable: YYYY-MM-DD HH:mm
    return fmt.format(date).replace(',', '');
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function replacePrefixedLine(content, prefix, value) {
  const lines = content.split('\n');
  return lines
    .map((l) => {
      if (l.startsWith(prefix)) {
        return `${prefix} ${value}`;
      }
      return l;
    })
    .join('\n');
}

const now = new Date();
const dateTime = formatPragueDateTime(now);
const date = dateTime.slice(0, 10);

const templateRel = 'work/rc/RC_TEMPLATE.md';
const templateAbs = path.join(root, templateRel);
if (!fs.existsSync(templateAbs)) {
  console.error(`Missing template: ${templateRel}`);
  process.exit(1);
}

let content = readText(templateRel).replaceAll('YYYY-MM-DD', date);

let version = '';
try {
  const pkg = JSON.parse(readText('package.json'));
  version = String(pkg.version ?? '');
} catch {
  // ignore
}

const playwrightVersion = safeReadText('e2e/PLAYWRIGHT_VERSION').trim();
const commit = safeExec('git rev-parse HEAD');
const branch = safeExec('git rev-parse --abbrev-ref HEAD');
const npmVersion = safeExec('npm -v');
const nodeVersion = process.version.replace(/^v/, '');

content = replacePrefixedLine(content, '- Date/time (local):', dateTime);
content = replacePrefixedLine(content, '- Branch/tag:', branch);
content = replacePrefixedLine(content, '- Commit:', commit);
content = replacePrefixedLine(content, '- WebUI Next version (package.json):', version);
content = replacePrefixedLine(content, '- Node version:', nodeVersion);
content = replacePrefixedLine(content, '- npm version:', npmVersion);
content = replacePrefixedLine(content, '- Playwright version (`e2e/PLAYWRIGHT_VERSION`):', playwrightVersion);

const outDir = path.join(root, 'work/rc');
fs.mkdirSync(outDir, { recursive: true });

let outPath = path.join(outDir, `rc-${date}.md`);
let n = 2;
while (fs.existsSync(outPath)) {
  outPath = path.join(outDir, `rc-${date}-${n}.md`);
  n += 1;
}

fs.writeFileSync(outPath, content, 'utf8');
console.log(outPath);

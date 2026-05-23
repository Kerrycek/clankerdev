#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function extractTranslationKeys(sourceText) {
  const keys = new Set();
  const re = /'([^'\n]+)'\s*:\s*/g;
  let m;
  while ((m = re.exec(sourceText))) {
    const k = m[1];
    if (k) keys.add(k);
  }
  return keys;
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function sorted(list) {
  return [...list].sort((a, b) => a.localeCompare(b));
}

function usage() {
  console.log(`Usage: node scripts/audit-i18n.mjs [--fail] [--json]\n\nChecks key parity between src/i18n/locales/en and src/i18n/locales/cs.\n\nOptions:\n  --fail  Exit with code 1 when keys are missing.\n  --json  Print JSON instead of human-readable output.`);
}

function walkFiles(rootDir) {
  const out = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function extractKeysFromTree(rootDir) {
  const keys = new Set();
  for (const file of walkFiles(rootDir)) {
    for (const key of extractTranslationKeys(readFile(file))) {
      keys.add(key);
    }
  }
  return keys;
}

const args = new Set(process.argv.slice(2));
if (args.has('-h') || args.has('--help')) {
  usage();
  process.exit(0);
}

const root = process.cwd();
const enRoot = path.join(root, 'src', 'i18n', 'locales', 'en');
const csRoot = path.join(root, 'src', 'i18n', 'locales', 'cs');

const enKeys = extractKeysFromTree(enRoot);
const csKeys = extractKeysFromTree(csRoot);

const missingInCs = sorted([...enKeys].filter((k) => !csKeys.has(k)));
const missingInEn = sorted([...csKeys].filter((k) => !enKeys.has(k)));

const report = {
  enCount: enKeys.size,
  csCount: csKeys.size,
  missingInCs,
  missingInEn,
};

if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`i18n audit: en=${enKeys.size}, cs=${csKeys.size}`);
  if (missingInCs.length > 0) {
    console.log(`\nMissing in cs (${missingInCs.length}):`);
    for (const k of missingInCs) console.log(`- ${k}`);
  }
  if (missingInEn.length > 0) {
    console.log(`\nMissing in en (${missingInEn.length}):`);
    for (const k of missingInEn) console.log(`- ${k}`);
  }
  if (missingInCs.length === 0 && missingInEn.length === 0) {
    console.log('OK: dictionaries have matching keys.');
  }
}

if (args.has('--fail') && (missingInCs.length > 0 || missingInEn.length > 0)) {
  process.exit(1);
}

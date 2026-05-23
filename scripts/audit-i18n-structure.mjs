#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const LANGS = ['en', 'cs'];
const ROOT = path.resolve('src/i18n');
const MAX_AGGREGATOR_LINES = 80;
const MAX_LOCALE_MODULE_LINES = 400;
const MIN_LOCALE_MODULE_COUNT = 20;

const failures = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

for (const lang of LANGS) {
  const aggPath = path.join(ROOT, `${lang}.ts`);
  const aggText = fs.readFileSync(aggPath, 'utf8');
  const aggLines = aggText.split('\n').length;
  if (aggLines > MAX_AGGREGATOR_LINES) {
    failures.push(`${path.relative(process.cwd(), aggPath)} is too large: ${aggLines} > ${MAX_AGGREGATOR_LINES}`);
  }
  if (!aggText.includes(`./locales/${lang}/`)) {
    failures.push(`${path.relative(process.cwd(), aggPath)} does not import from ./locales/${lang}/`);
  }
  if (!aggText.includes(`export const ${lang} = {`)) {
    failures.push(`${path.relative(process.cwd(), aggPath)} no longer exports '${lang}' dictionary`);
  }

  const localeDir = path.join(ROOT, 'locales', lang);
  if (!fs.existsSync(localeDir) || !fs.statSync(localeDir).isDirectory()) {
    failures.push(`${path.relative(process.cwd(), localeDir)} is missing`);
    continue;
  }

  const files = walk(localeDir);
  if (files.length < MIN_LOCALE_MODULE_COUNT) {
    failures.push(`${path.relative(process.cwd(), localeDir)} has too few split modules: ${files.length} < ${MIN_LOCALE_MODULE_COUNT}`);
  }

  for (const full of files) {
    const text = fs.readFileSync(full, 'utf8');
    const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
    const lines = text.split('\n').length;
    if (lines > MAX_LOCALE_MODULE_LINES) {
      failures.push(`${rel} is too large: ${lines} > ${MAX_LOCALE_MODULE_LINES}`);
    }
    const firstLine = text.split('\n', 1)[0] ?? '';
    if (!firstLine.startsWith('// ')) {
      failures.push(`${rel} should start with a short domain comment`);
    }
    if (!/export const \w+ = \{/m.test(text)) {
      failures.push(`${rel} should export a dictionary chunk/barrel`);
    }
  }
}

if (failures.length > 0) {
  console.error('i18n structure audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('i18n structure OK');

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const exts = new Set(['.ts', '.tsx']);
const pageSuffixes = ['Page.tsx', 'Layout.tsx'];
const IGNORE_MARKER = 'audit-pages-ignore';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const allFiles = walk(root);
const pageFiles = allFiles.filter((file) => pageSuffixes.some((suffix) => file.endsWith(suffix)));
const textByFile = new Map(allFiles.map((file) => [file, fs.readFileSync(file, 'utf8')]));

const failures = [];
for (const file of pageFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const ownText = textByFile.get(file) ?? '';
  if (ownText.includes(IGNORE_MARKER)) continue;
  const base = path.basename(file, path.extname(file));
  const pattern = new RegExp(`\\b${escapeRegex(base)}\\b`, 'g');
  let found = false;
  for (const [otherFile, text] of textByFile.entries()) {
    if (otherFile === file) continue;
    if (pattern.test(text)) {
      found = true;
      break;
    }
  }
  if (!found) failures.push(rel);
}

if (failures.length > 0) {
  console.error('Found orphan page/layout files with no references:');
  for (const rel of failures) console.error(`- ${rel}`);
  process.exit(1);
}

console.log(`audit-page-integrity: OK (${pageFiles.length} page/layout files scanned)`);

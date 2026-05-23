#!/usr/bin/env node
/**
 * Diff two hash-tree snapshots.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--baseline') {
      args.baseline = argv[++i];
      continue;
    }
    if (a === '--current') {
      args.current = argv[++i];
      continue;
    }
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
  }
  return args;
}

async function readJson(p) {
  const abs = path.resolve(process.cwd(), p);
  const raw = await fs.readFile(abs, 'utf8');
  return JSON.parse(raw);
}

function sortPaths(arr) {
  return arr.sort((a, b) => a.localeCompare(b));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.baseline || !args.current) {
    console.log('Usage: node scripts/diff-hashes.mjs --baseline <file> --current <file>');
    process.exit(args.help ? 0 : 1);
  }

  const base = await readJson(args.baseline);
  const cur = await readJson(args.current);

  const baseFiles = base.files ?? {};
  const curFiles = cur.files ?? {};

  const added = [];
  const removed = [];
  const changed = [];

  for (const p of Object.keys(curFiles)) {
    if (!(p in baseFiles)) {
      added.push(p);
    } else if (curFiles[p] !== baseFiles[p]) {
      changed.push(p);
    }
  }

  for (const p of Object.keys(baseFiles)) {
    if (!(p in curFiles)) {
      removed.push(p);
    }
  }

  sortPaths(added);
  sortPaths(changed);
  sortPaths(removed);

  const total = added.length + changed.length + removed.length;
  console.log(`Diff vs baseline:`);
  console.log(`  Added:   ${added.length}`);
  console.log(`  Changed: ${changed.length}`);
  console.log(`  Removed: ${removed.length}`);
  console.log(`  Total:   ${total}`);

  if (added.length) {
    console.log('\nAdded:');
    for (const p of added) console.log(`  + ${p}`);
  }
  if (changed.length) {
    console.log('\nChanged:');
    for (const p of changed) console.log(`  ~ ${p}`);
  }
  if (removed.length) {
    console.log('\nRemoved:');
    for (const p of removed) console.log(`  - ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

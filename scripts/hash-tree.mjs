#!/usr/bin/env node
/**
 * Compute a deterministic sha256 hash map for the repository.
 *
 * This is used instead of git to identify changed files across parallel turns.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') {
      args.out = argv[++i];
      continue;
    }
    if (a === '--root') {
      args.root = argv[++i];
      continue;
    }
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
  }
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.turbo',
  '.next',
  // parallel lanes are noisy by design
  'work/parallel/lanes',
  'work/parallel/baseline',
]);

async function sha256File(absPath) {
  const data = await fs.readFile(absPath);
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

async function walk(rootAbs, relDir = '') {
  const absDir = path.join(rootAbs, relDir);
  const entries = await fs.readdir(absDir, { withFileTypes: true });

  /** @type {string[]} */
  const files = [];

  for (const ent of entries) {
    const rel = relDir ? path.join(relDir, ent.name) : ent.name;
    const relPosix = toPosix(rel);

    if (ent.isDirectory()) {
      if (DEFAULT_EXCLUDE_DIRS.has(relPosix)) continue;
      if (DEFAULT_EXCLUDE_DIRS.has(ent.name)) continue;
      const sub = await walk(rootAbs, rel);
      files.push(...sub);
      continue;
    }

    if (ent.isFile()) {
      files.push(relPosix);
    }
  }

  return files;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.out) {
    console.log('Usage: node scripts/hash-tree.mjs --out <file> [--root <dir>]');
    process.exit(args.help ? 0 : 1);
  }

  const root = args.root ?? '.';
  const rootAbs = path.resolve(process.cwd(), root);

  const fileList = await walk(rootAbs);
  fileList.sort();

  /** @type {Record<string,string>} */
  const fileHashes = {};

  for (const rel of fileList) {
    const abs = path.join(rootAbs, rel);
    fileHashes[rel] = await sha256File(abs);
  }

  const output = {
    meta: {
      created_at: new Date().toISOString(),
      root: toPosix(root),
      algo: 'sha256',
      exclude_dirs: Array.from(DEFAULT_EXCLUDE_DIRS.values()).sort(),
      file_count: fileList.length,
    },
    files: fileHashes,
  };

  const outPath = path.resolve(process.cwd(), args.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${fileList.length} file hashes to ${args.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

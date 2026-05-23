#!/usr/bin/env node
/**
 * Lint for simple banned string patterns that often indicate typos or accidental commits.
 *
 * This is intentionally dependency-free so it can run in minimal environments.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Scan code directories only. (Docs intentionally excluded to avoid false positives.)
const SCAN_DIRS = ['src', 'e2e', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md']);

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.cache', 'coverage']);

// Ignore this lint script itself (it necessarily contains the banned strings)
const IGNORE_FILES = new Set(['scripts/lint-banned-patterns.mjs']);

const BANNED = [

  {
    code: 'modal_isopen_prop',
    pattern: /<Modal[^>]*isOpen=/,
    message: 'Found `<Modal isOpen=...>`. Modal expects `open`, not `isOpen`.',
  },
  {
    code: 'drawer_onopenchange_prop',
    pattern: /<Drawer[^>]*onOpenChange=/,
    message: 'Found `<Drawer onOpenChange=...>`. Drawer expects `onClose`.',
  },
  {
    code: 'select_label_prop',
    pattern: /<Select[^>]*label=/,
    message: 'Found `<Select label=...>`. Select does not render labels; render a visible label element separately.',
  },
  {
    code: 'input_label_prop',
    pattern: /<Input[^>]*label=/,
    message: 'Found `<Input label=...>`. Input does not render labels; render a visible label element separately.',
  },
  {
    code: 'targetx',
    pattern: /\btargetx\b/,
    message: 'Found `targetx` typo. Use `target` (e.g. `e.target.value`).',
  },
  {
    code: 'reactx',
    pattern: /\bReactx\b/,
    message: 'Found `Reactx` typo. Use `React`.',
  },
  {
    code: 'nextx',
    pattern: /\bnextx\b/,
    message: 'Found `nextx` typo. Use the intended variable name (usually `next`).',
  },
  {
    code: 'outx',
    pattern: /\boutx\b/,
    message: 'Found `outx` typo. Use the intended variable name (usually `out`).',
  },
  {
    code: 'tx_match',
    pattern: /\btx\.match\b/,
    message: 'Found `tx.match` (common typo for `t.match`).',
  },
  {
    code: 'spinner_size_prop',
    pattern: /<Spinner[^>]*\bsize=/,
    message: 'Found `<Spinner size=...>`. Our Spinner does not support a `size` prop; use the default size or add a proper tokenized variant.',
  },
  {
    code: 'layout_objectheader_import',
    pattern: /components\/layout\/ObjectHeader/,
    message: 'Found import from `components/layout/ObjectHeader`. ObjectHeader lives in `components/ui/ObjectHeader`.',
  },
];

function walk(dir, files) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const ent of entries) {
    const full = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      if (ent.name.startsWith('.')) continue;
      walk(full, files);
      continue;
    }

    if (!ent.isFile()) continue;

    const ext = path.extname(ent.name);
    if (!EXTENSIONS.has(ext)) continue;

    files.push(full);
  }
}

function readLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
}

const files = [];
for (const d of SCAN_DIRS) {
  walk(path.join(ROOT, d), files);
}

/** @type {Array<{file: string; line: number; code: string; text: string}>} */
const hits = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (IGNORE_FILES.has(rel)) continue;
  const lines = readLines(file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    for (const rule of BANNED) {
      if (rule.pattern.test(line)) {
        hits.push({ file: rel, line: i + 1, code: rule.code, text: line.trimEnd() });
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`[lint] banned patterns found: ${hits.length}`);

  const byCode = new Map();
  for (const h of hits) {
    byCode.set(h.code, (byCode.get(h.code) ?? 0) + 1);
  }

  for (const [code, count] of byCode.entries()) {
    const msg = BANNED.find((r) => r.code === code)?.message ?? '';
    console.error(`- ${code}: ${count}${msg ? ` (${msg})` : ''}`);
  }

  for (const h of hits.slice(0, 50)) {
    console.error(`${h.file}:${h.line}: [${h.code}] ${h.text}`);
  }

  if (hits.length > 50) {
    console.error(`…and ${hits.length - 50} more.`);
  }

  process.exit(1);
}

console.log(`[lint] ok (${files.length} files scanned)`);

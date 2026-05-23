#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const ACTIVE_DOCS = [
  'README.md',
  'SPEC.md',
  'docs/README.md',
  'docs/CANONICAL_DOCS.md',
  'docs/spec/ROUTE_COVERAGE_AUDIT.md',
  'docs/spec/PAGINATION_AND_SEARCH.md',
  'docs/spec/MODE_AND_ROUTE_ACCESSIBILITY.md',
  'docs/spec/TEST_IDS.md',
  'docs/spec/AUTH_AND_FAILURE_SURFACES.md',
];

const SCAN_SRC_DIRS = ['src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.cache', 'coverage']);

const RULES = [
  {
    code: 'obsolete_webui_next_spec_ref',
    pattern: /WEBUI_NEXT_SPEC\.md/,
    message: 'Active docs must not reference WEBUI_NEXT_SPEC.md; point to UI_REDESIGN.md canon or a derived appendix instead.',
  },
  {
    code: 'obsolete_basic_advanced_model',
    pattern: /\b(?:Basic mode|Advanced mode|basic mode|advanced mode)\b/,
    message: 'The removed Basic/Advanced UI-mode model must not appear in active docs or source.',
  },
  {
    code: 'obsolete_basic_advanced_qualifier',
    pattern: /\b(?:basic only|advanced only)\b/,
    message: 'The removed Basic/Advanced UI-mode qualifiers must not appear in active docs or source.',
  },
  {
    code: 'obsolete_ui_mode_ref',
    pattern: /\bui_mode\b/,
    message: 'Active docs or source must not refer to legacy ui_mode terminology.',
  },
  {
    code: 'obsolete_mode_gate_ref',
    pattern: /\bmode gate\b/i,
    message: 'Active docs or source must not refer to the removed mode-gating model.',
  },
  {
    code: 'source_spec_md_comment',
    pattern: /SPEC\.md/,
    message: 'Source comments should not point at SPEC.md; reference UI_REDESIGN.md canon directly.',
    sourceOnly: true,
  },
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      walk(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(ent.name))) continue;
    out.push(full);
  }
}

const files = [];
for (const rel of ACTIVE_DOCS) files.push(path.join(ROOT, rel));
for (const dir of SCAN_SRC_DIRS) walk(path.join(ROOT, dir), files);

const hits = [];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(ROOT, file);
  const isSource = rel.startsWith('src/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const rule of RULES) {
      if (rule.sourceOnly && !isSource) continue;
      if (!rule.sourceOnly && false) {}
      if (rule.pattern.test(line)) {
        hits.push({ file: rel, line: i + 1, code: rule.code, text: line.trimEnd() });
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`[audit-active-docs] violations: ${hits.length}`);
  for (const hit of hits.slice(0, 100)) {
    const msg = RULES.find((r) => r.code === hit.code)?.message ?? '';
    console.error(`${hit.file}:${hit.line}: [${hit.code}] ${msg}`);
    console.error(`  ${hit.text}`);
  }
  if (hits.length > 100) console.error(`...and ${hits.length - 100} more.`);
  process.exit(1);
}

console.log(`[audit-active-docs] ok (${files.length} files scanned)`);

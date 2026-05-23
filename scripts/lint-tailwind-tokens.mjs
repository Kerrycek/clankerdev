#!/usr/bin/env node
/**
 * Lightweight, dependency-free lint for Tailwind token discipline.
 *
 * Goal: prevent “random-sized” and non-tokenized styles from creeping back in.
 *
 * NOTE: this is intentionally simple; as the project grows we can migrate to ESLint
 * + eslint-plugin-tailwindcss, but this script is cheap and works everywhere.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function isCheckedFile(p) {
  return p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.css');
}

const allFiles = walk(SRC_DIR).filter(isCheckedFile);

// Disallow size “arbitrary values” that create random visual rhythm.
// If you need a new size, add a token to src/styles/index.css + tailwind.config.js
// and document it in docs/spec/SIZE_TOKENS_AND_VARIANTS.md
const forbiddenEverywhere = [

  { needle: 'bg-surface2', msg: 'Forbidden: bg-surface2 (use bg-surface-2)' },
  { needle: 'text-surface2', msg: 'Forbidden: text-surface2 (use a valid token such as text-muted/text-fg)' },
  { needle: 'border-surface2', msg: 'Forbidden: border-surface2 (use border-border or border-strong)' },
  { needle: 'w-[', msg: 'Forbidden: w-[…] (use width tokens, e.g. w-drawer-md)' },
  { needle: 'min-w-[', msg: 'Forbidden: min-w-[…] (use min-w-table-* tokens)' },
  { needle: 'max-w-[', msg: 'Forbidden: max-w-[…] (use max-w-content-* tokens)' },
  { needle: 'h-[', msg: 'Forbidden: h-[…] (use h-console or other height tokens)' },
  { needle: 'min-h-[', msg: 'Forbidden: min-h-[…] (use min-h-textarea or other min-height tokens)' },
  { needle: 'text-[', msg: 'Forbidden: text-[…] (use the typography scale: text-xs/sm/base/…)' },
  { needle: 'bg-overlay/', msg: 'Forbidden: bg-overlay/… (overlays must be opaque; use bg-backdrop and bg-overlay-surface without alpha)' },
  { needle: 'bg-backdrop/', msg: 'Forbidden: bg-backdrop/… (backdrops must be opaque; use bg-backdrop)' },
  { needle: 'bg-overlay-surface/', msg: 'Forbidden: bg-overlay-surface/… (overlay surfaces must be opaque; use bg-overlay-surface)' },
  { needle: 'backdrop-blur', msg: 'Forbidden: backdrop-blur (overlays must be solid/opaque per spec)' },

  // Semantic surfaces must not use alpha modifiers. If a different intensity is needed, introduce a token.
  { needle: 'bg-ok-bg/', msg: 'Forbidden: bg-ok-bg/… (use bg-ok-bg or bg-ok-row)' },
  { needle: 'bg-warn-bg/', msg: 'Forbidden: bg-warn-bg/… (use bg-warn-bg or bg-warn-row)' },
  { needle: 'bg-danger-bg/', msg: 'Forbidden: bg-danger-bg/… (use bg-danger-bg or bg-danger-row)' },
  { needle: 'bg-info-bg/', msg: 'Forbidden: bg-info-bg/… (use bg-info-bg or bg-info-row)' },
  { needle: 'bg-neutral-bg/', msg: 'Forbidden: bg-neutral-bg/… (use bg-neutral-bg)' },
  { needle: 'bg-ok-row/', msg: 'Forbidden: bg-ok-row/… (use bg-ok-row)' },
  { needle: 'bg-warn-row/', msg: 'Forbidden: bg-warn-row/… (use bg-warn-row)' },
  { needle: 'bg-danger-row/', msg: 'Forbidden: bg-danger-row/… (use bg-danger-row)' },
  { needle: 'bg-info-row/', msg: 'Forbidden: bg-info-row/… (use bg-info-row)' },

  // Do not apply alpha to the base semantic hue for borders/rings; use the dedicated -border tokens.
  { needle: 'border-ok/', msg: 'Forbidden: border-ok/… (use border-ok-border)' },
  { needle: 'border-warn/', msg: 'Forbidden: border-warn/… (use border-warn-border)' },
  { needle: 'border-danger/', msg: 'Forbidden: border-danger/… (use border-danger-border)' },
  { needle: 'border-info/', msg: 'Forbidden: border-info/… (use border-info-border)' },
  { needle: 'border-neutral/', msg: 'Forbidden: border-neutral/… (use border-neutral-border)' },
  { needle: 'ring-ok/', msg: 'Forbidden: ring-ok/… (use ring-ok-border)' },
  { needle: 'ring-warn/', msg: 'Forbidden: ring-warn/… (use ring-warn-border)' },
  { needle: 'ring-danger/', msg: 'Forbidden: ring-danger/… (use ring-danger-border)' },
  { needle: 'ring-info/', msg: 'Forbidden: ring-info/… (use ring-info-border)' },
  { needle: 'ring-neutral/', msg: 'Forbidden: ring-neutral/… (use ring-neutral-border)' },
];

// In shared UI components we ban “hardcoded” black/white utility colors.
// Pages can be migrated gradually, but shared primitives must be theme-safe.
const uiDir = path.join(SRC_DIR, 'components', 'ui');
const forbiddenInSharedUi = [
  { re: /\btext-black\b|\btext-black\//, msg: 'Forbidden in shared UI: text-black… (use text-fg/text-muted/text-faint)' },
  { re: /\bbg-white\b|\bbg-white\//, msg: 'Forbidden in shared UI: bg-white… (use bg-surface/bg-surface-2)' },
  { re: /\bborder-black\b|\bborder-black\//, msg: 'Forbidden in shared UI: border-black… (use border-border)' },
  { re: /\bring-black\b|\bring-black\//, msg: 'Forbidden in shared UI: ring-black… (use ring-focus/… or ring-border)' },
  { re: /\bbg-black\b|\bbg-black\//, msg: 'Forbidden in shared UI: bg-black… (use bg-backdrop/bg-overlay-surface or semantic surfaces)' },
];

function reportIssues(issues) {
  for (const it of issues) {
    // eslint-disable-next-line no-console
    console.error(`${it.file}:${it.line}: ${it.msg}`);
    // eslint-disable-next-line no-console
    console.error(`  ${it.preview}`);
  }
}

const issues = [];

for (const file of allFiles) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const rule of forbiddenEverywhere) {
      if (line.includes(rule.needle)) {
        issues.push({
          file: rel,
          line: i + 1,
          msg: rule.msg,
          preview: line.trim(),
        });
      }
    }
  }

  // Shared UI only checks
  if (file.startsWith(uiDir)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const rule of forbiddenInSharedUi) {
        if (rule.re.test(line)) {
          issues.push({
            file: rel,
            line: i + 1,
            msg: rule.msg,
            preview: line.trim(),
          });
        }
      }
    }
  }
}

if (issues.length) {
  // eslint-disable-next-line no-console
  console.error(`\nFound ${issues.length} Tailwind token discipline issue(s):\n`);
  reportIssues(issues);
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log('Tailwind token discipline: OK');
}

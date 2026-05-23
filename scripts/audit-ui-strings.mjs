#!/usr/bin/env node
/**
 * audit-ui-strings.mjs
 *
 * Scans src/ for likely user-facing hardcoded strings that bypass i18n.
 *
 * Primary goal: catch regressions and keep i18n hygiene high without adding
 * heavy tooling requirements.
 *
 * Implementation:
 * - If `typescript` is available, uses a tiny TS/TSX AST walk for accuracy.
 * - Otherwise falls back to conservative regex heuristics.
 *
 * Ignore directives:
 *   - // i18n-ignore-file
 *   - // i18n-ignore
 *   - // i18n-ignore-next-line
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

const args = process.argv.slice(2);

function argValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const outPath = argValue('--write') ?? path.join(ROOT, 'work', 'audits', 'ui_strings.md');
const failOnFindings = args.includes('--fail') || args.includes('--fail-on-findings');

const includeTs = args.includes('--include-ts');
const exts = includeTs ? new Set(['.tsx', '.ts']) : new Set(['.tsx']);

const IGNORE_DIRS = [
  path.join(SRC_DIR, 'i18n'),
  path.join(SRC_DIR, 'lib', 'api'),
];

function isInsideIgnoredDir(filePath) {
  return IGNORE_DIRS.some((dir) => filePath.startsWith(dir + path.sep) || filePath === dir);
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      if (isInsideIgnoredDir(full)) continue;
      walk(full, out);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name);
      if (!exts.has(ext)) continue;
      if (isInsideIgnoredDir(full)) continue;
      out.push(full);
    }
  }
}

function looksLikeUserFacing(text) {
  const s = String(text ?? '').trim();
  if (!s) return false;

  // Ignore composed JSX fragments (regex fallback can capture `{expr}`)
  if (s.includes('{') || s.includes('}')) return false;

  // Skip pure punctuation/whitespace/numbers
  if (/^[\s\d.,:;!?()\[\]{}<>'"\\/\-–—·•]+$/.test(s)) return false;

  // Skip obvious paths/urls
  if (/^(https?:\/\/|\/)[^\s]+$/.test(s)) return false;

  // Very short technical tokens (SSH, CPU, OK, node1) are not our priority.
  if (!/\s/.test(s) && /^[a-zA-Z0-9_.:-]{1,24}$/.test(s)) return false;

  // Default heuristic: phrases/sentences or anything longer.
  const hasSpace = /\s/.test(s);
  const hasLower = /[a-zà-ž]/.test(s);

  return hasSpace || hasLower || s.length >= 12;
}

function readLines(text) {
  return text.split(/\r?\n/);
}

const ATTR_NAMES = new Set(['placeholder', 'title', 'subtitle', 'description', 'label', 'helpText', 'helperText', 'aria-label', 'alt']);

const FINDINGS = [];

function addFinding(file, line, kind, text) {
  FINDINGS.push({ file, line, kind, text: String(text ?? '').trim() });
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function writeReport(filePath) {
  const now = new Date().toISOString();
  const byFile = new Map();
  for (const f of FINDINGS) {
    const arr = byFile.get(f.file) ?? [];
    arr.push(f);
    byFile.set(f.file, arr);
  }

  const kindCounts = new Map();
  for (const f of FINDINGS) {
    kindCounts.set(f.kind, (kindCounts.get(f.kind) ?? 0) + 1);
  }

  const lines = [];
  lines.push(`# UI hardcoded-string audit`);
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push('');
  lines.push(`Scanned: \`src/**\` (${includeTs ? 'ts+tsx' : 'tsx'})`);
  lines.push('');
  lines.push(`Findings: **${FINDINGS.length}**`);
  lines.push('');

  if (FINDINGS.length) {
    lines.push('## Breakdown');
    for (const [k, v] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${k}: ${v}`);
    }
    lines.push('');

    lines.push('## Findings');
    const files = [...byFile.keys()].sort();
    for (const file of files) {
      const items = byFile.get(file) ?? [];
      lines.push(`### ${file}`);
      for (const it of items.sort((a, b) => a.line - b.line)) {
        const snippet = it.text.replace(/\s+/g, ' ').slice(0, 180);
        lines.push(`- L${it.line} (${it.kind}): \`${snippet}\``);
      }
      lines.push('');
    }

    lines.push('## How to fix');
    lines.push('');
    lines.push('- Prefer `t(\'key\')` / `tc(\'key\', n)` for user-facing strings.');
    lines.push('- For justified exceptions, add: `// i18n-ignore` on that line, or `// i18n-ignore-file` at the top of the file.');
    lines.push('');
  } else {
    lines.push('No findings 🎉');
  }

  ensureDir(filePath);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function shouldIgnoreLine(lines, lineIdx0) {
  const line = lines[lineIdx0] ?? '';
  const prev = lines[lineIdx0 - 1] ?? '';
  if (line.includes('i18n-ignore')) return true;
  if (prev.includes('i18n-ignore-next-line')) return true;
  return false;
}

function scanFileRegex(filePath) {
  const rel = path.relative(ROOT, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('i18n-ignore-file')) return;

  const lines = readLines(text);

  // 1) Inline JSX text nodes (best-effort) – match <Tag ...>Text</
  for (let i = 0; i < lines.length; i++) {
    if (shouldIgnoreLine(lines, i)) continue;
    const line = lines[i];
    let m;
    const re = /<[A-Za-z][^>]*>\s*([^<{][^<]*?)\s*<\//g;
    while ((m = re.exec(line))) {
      const raw = m[1];
      if (!looksLikeUserFacing(raw)) continue;
      addFinding(rel, i + 1, 'jsx-text', raw);
    }
  }

  // 2) String literals in common UI props (single-line)
  const attrRe = /\b(placeholder|title|subtitle|description|label|helpText|helperText|aria-label|alt)\s*=\s*("([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/g;
  for (let i = 0; i < lines.length; i++) {
    if (shouldIgnoreLine(lines, i)) continue;
    const line = lines[i];
    let m;
    attrRe.lastIndex = 0;
    while ((m = attrRe.exec(line))) {
      const attr = m[1];
      const raw = m[3] ?? m[4] ?? '';
      if (!looksLikeUserFacing(raw)) continue;
      addFinding(rel, i + 1, `attr:${attr}`, raw);
    }
  }

  // 3) Common “toast/notice” direct strings (very conservative)
  for (let i = 0; i < lines.length; i++) {
    if (shouldIgnoreLine(lines, i)) continue;
    const line = lines[i];
    const callMatch = line.match(/\b(setNotice|setError|toast\.(success|error|warning|info))\(\s*['"]([^'"]+)['"]/);
    if (callMatch) {
      const raw = callMatch[3];
      if (looksLikeUserFacing(raw)) addFinding(rel, i + 1, 'call', raw);
    }
  }
}

function scanFileTypescript(ts, filePath) {
  const rel = path.relative(ROOT, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('i18n-ignore-file')) return;

  const lines = readLines(text);
  const isTsx = filePath.endsWith('.tsx');
  const sourceFile = ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function lineOf(node) {
    const pos = node.getStart(sourceFile, false);
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function ignoreNode(node) {
    const l1 = lineOf(node);
    return shouldIgnoreLine(lines, l1 - 1);
  }

  function visit(node) {
    // JSX text (including multi-line nodes)
    if (ts.isJsxText(node)) {
      if (!ignoreNode(node)) {
        const raw = node.getText(sourceFile).trim();
        if (looksLikeUserFacing(raw)) addFinding(rel, lineOf(node), 'jsx-text', raw);
      }
    }

    // JSX attributes: title="..." etc (also catches {'...'}).
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (ATTR_NAMES.has(name) && node.initializer) {
        let raw = null;
        if (ts.isStringLiteral(node.initializer)) {
          raw = node.initializer.text;
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isStringLiteral(node.initializer.expression)) {
          raw = node.initializer.expression.text;
        }
        if (raw && !ignoreNode(node) && looksLikeUserFacing(raw)) {
          addFinding(rel, lineOf(node), `attr:${name}`, raw);
        }
      }
    }

    // Call expressions: setNotice('...') / toast.success('...')
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let callName = null;

      if (ts.isIdentifier(callee)) callName = callee.text;
      if (ts.isPropertyAccessExpression(callee)) {
        const left = callee.expression;
        const right = callee.name;
        if (ts.isIdentifier(left) && ts.isIdentifier(right)) callName = `${left.text}.${right.text}`;
      }

      if (callName) {
        const isTracked =
          callName === 'setNotice' ||
          callName === 'setError' ||
          callName === 'toast.success' ||
          callName === 'toast.error' ||
          callName === 'toast.warning' ||
          callName === 'toast.info';

        if (isTracked && node.arguments.length > 0) {
          const a0 = node.arguments[0];
          if (ts.isStringLiteral(a0) && !ignoreNode(node) && looksLikeUserFacing(a0.text)) {
            addFinding(rel, lineOf(node), 'call', a0.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

async function loadTypescript() {
  try {
    const mod = await import('typescript');
    // CommonJS interop: `default` is often the module.exports.
    return mod.default ?? mod;
  } catch (e) {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('src/ not found. Run from webui-next/ root.');
    process.exit(2);
  }

  const files = [];
  walk(SRC_DIR, files);

  const ts = await loadTypescript();

  for (const f of files) {
    if (ts) scanFileTypescript(ts, f);
    else scanFileRegex(f);
  }

  writeReport(outPath);

  if (failOnFindings && FINDINGS.length > 0) {
    console.error(`Found ${FINDINGS.length} hardcoded UI string(s). See: ${outPath}`);
    process.exit(1);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(2);
});

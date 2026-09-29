import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const directory = path.join(root, 'docs/design');
const files = fs.readdirSync(directory).filter(f => f.endsWith('.md')).map(f => path.join(directory, f));
const workLog = path.join(root, 'docs/work-log');
files.push(...fs.readdirSync(workLog).filter(f => f.endsWith('.md')).map(f => path.join(workLog, f)));
files.push(...['README.md', 'UI_REDESIGN.md', 'SPEC.md', 'docs/README.md', 'docs/CANONICAL_DOCS.md', 'WORK_LOG.md'].map(f => path.join(root, f)));
// Include operational guides: handover links must work beyond the handbook.
function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}
files.push(...markdownFiles(path.join(root, 'deploy')));
const errors = [];
// The handbook uses ATX headings and optional explicit HTML anchors. Duplicate
// headings receive GitHub-style numeric suffixes. This is link lint, not a
// general Markdown renderer or a semantic documentation completeness proof.
function anchors(file) {
  const content = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  const found = new Set();
  for (const match of content.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
    const base = match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '').replace(/ /g, '-');
    let slug = base;
    for (let n = 1; found.has(slug); n++) slug = `${base}-${n}`;
    found.add(slug);
  }
  for (const match of content.matchAll(/<(?:a|h[1-6])\s+[^>]*(?:id|name)=["']([^"']+)["']/g)) found.add(match[1]);
  return found;
}
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const [target, fragment] = match[1].split('#');
    if (/^[a-z]+:/i.test(target)) continue;
    const destination = target ? path.resolve(path.dirname(file), decodeURIComponent(target)) : file;
    if (!destination.startsWith(root + path.sep) || !fs.existsSync(destination)) {
      errors.push(`${path.relative(root, file)}: missing or external local link ${target}`);
    } else if (fragment && destination.endsWith('.md') && !anchors(destination).has(decodeURIComponent(fragment))) {
      errors.push(`${path.relative(root, file)}: missing local anchor ${match[1]}`);
    }
  }
}
// Historical mentions may remain, but no tracked document/source may direct
// readers to the missing specification outside this repository.
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0');
for (const relative of tracked.filter(f => /\.(md|tsx?|css)$/.test(f))) {
  const content = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const match of content.matchAll(/(?:\.\.\/)+UI_REDESIGN\.md/g)) {
    const destination = path.resolve(path.dirname(path.join(root, relative)), match[0]);
    if (destination !== path.join(root, 'UI_REDESIGN.md')) {
      errors.push(`${relative}: obsolete external redesign reference ${match[0]}`);
    }
  }
}
const register = fs.readFileSync(path.join(directory, 'REQUIREMENTS.md'), 'utf8');
const ids = [...register.matchAll(/^\| (REQ-\d{3}) \|/gm)].map(m => m[1]);
if (!ids.length || new Set(ids).size !== ids.length) errors.push('Requirement IDs are empty or duplicated');
const evidenceFile = path.join(directory, 'EVIDENCE_MATRIX.md');
const evidence = fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : '';
const coverage = (evidence.split('## Requirement coverage\n')[1] ?? '').split(/^## /m)[0];
const evidenceIds = [...coverage.matchAll(/^\| (REQ-\d{3}) \|/gm)].map(m => m[1]);
for (const id of ids) {
  if (evidenceIds.filter(value => value === id).length !== 1) errors.push(`Evidence matrix must contain exactly one coverage row for ${id}`);
}
for (const id of evidenceIds) {
  if (!ids.includes(id)) errors.push(`Evidence matrix has unknown ${id}`);
}
for (const file of files.filter(f => f.startsWith(directory))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bREQ-\d{3}\b/g)) {
    if (!ids.includes(match[0])) errors.push(`${path.basename(file)}: unknown ${match[0]}`);
  }
}
if (errors.length) throw new Error(errors.join('\n'));
execFileSync(process.execPath, ['scripts/design-inventory.mjs'], { stdio: 'inherit' });
console.log(`Design docs: ${files.length} documents checked, ${ids.length} unique requirements`);

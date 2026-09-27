import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const directory = path.join(root, 'docs/design');
const files = fs.readdirSync(directory).filter(f => f.endsWith('.md')).map(f => path.join(directory, f));
const workLog = path.join(root, 'docs/work-log');
files.push(...fs.readdirSync(workLog).filter(f => f.endsWith('.md')).map(f => path.join(workLog, f)));
files.push(...['README.md', 'UI_REDESIGN.md', 'SPEC.md', 'docs/README.md', 'docs/CANONICAL_DOCS.md', 'WORK_LOG.md'].map(f => path.join(root, f)));
const errors = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const destination = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!destination.startsWith(root + path.sep) || !fs.existsSync(destination)) {
      errors.push(`${path.relative(root, file)}: missing or external local link ${target}`);
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
for (const file of files.filter(f => f.startsWith(directory))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bREQ-\d{3}\b/g)) {
    if (!ids.includes(match[0])) errors.push(`${path.basename(file)}: unknown ${match[0]}`);
  }
}
if (errors.length) throw new Error(errors.join('\n'));
execFileSync(process.execPath, ['scripts/design-inventory.mjs'], { stdio: 'inherit' });
console.log(`Design docs: ${files.length} documents checked, ${ids.length} unique requirements`);

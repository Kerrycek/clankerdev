#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');
const TS_EXT = new Set(['.ts', '.tsx']);

const MAX_AS_ANY = 1327;
const MAX_FILES_OVER_500 = 61;
const MAX_FILES_OVER_1000 = 11;
const ALLOWED_OVER_1000 = new Set([
  'src/pages/app/MonitoringEventsPage.tsx',
  'src/pages/app/admin/MigrationPlanDetailPage.tsx',
  'src/pages/app/admin/MigrationPlansPage.tsx',
  'src/pages/app/admin/NodesPage.tsx',
  'src/pages/app/admin/RequestsPage.tsx',
  'src/pages/app/admin/cluster/NetworksPage.tsx',
  'src/pages/app/admin/cluster/OsTemplatesPage.tsx',
  'src/pages/app/admin/mailer/MailLogsPage.tsx',
  'src/pages/app/dns/DnsZonesPage.tsx',
  'src/pages/app/incidents/IncidentsPage.tsx',
  'src/pages/app/oom/OomReportsPage.tsx',
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(SRC_DIR).filter((f) => TS_EXT.has(path.extname(f)));
let asAnyCount = 0;
const over500 = [];
const over1000 = [];
for (const full of files) {
  const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
  const text = fs.readFileSync(full, 'utf8');
  asAnyCount += (text.match(/\sas\s+any\b/g) ?? []).length;
  const lines = text.split('\n').length;
  if (lines > 500) over500.push({ rel, lines });
  if (lines > 1000) over1000.push({ rel, lines });
}

const failures = [];
if (asAnyCount > MAX_AS_ANY) {
  failures.push(`'as any' count regressed: ${asAnyCount} > ${MAX_AS_ANY}`);
}
if (over500.length > MAX_FILES_OVER_500) {
  failures.push(`Files over 500 lines regressed: ${over500.length} > ${MAX_FILES_OVER_500}`);
}
if (over1000.length > MAX_FILES_OVER_1000) {
  failures.push(`Files over 1000 lines regressed: ${over1000.length} > ${MAX_FILES_OVER_1000}`);
}
const unexpectedOver1000 = over1000.filter((it) => !ALLOWED_OVER_1000.has(it.rel));
if (unexpectedOver1000.length > 0) {
  failures.push(
    `New files crossed 1000 lines: ${unexpectedOver1000.map((it) => `${it.rel} (${it.lines})`).join(', ')}`
  );
}

if (failures.length > 0) {
  console.error('Structural budget audit failed:\n');
  for (const f of failures) console.error(`- ${f}`);
  console.error('\nCurrent metrics:');
  console.error(`  as any count: ${asAnyCount}`);
  console.error(`  files >500 lines: ${over500.length}`);
  console.error(`  files >1000 lines: ${over1000.length}`);
  process.exit(1);
}

console.log('Structural budgets OK');
console.log(`- as any count: ${asAnyCount}`);
console.log(`- files >500 lines: ${over500.length}`);
console.log(`- files >1000 lines: ${over1000.length}`);

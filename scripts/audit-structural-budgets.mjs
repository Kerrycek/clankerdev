#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');
const TS_EXT = new Set(['.ts', '.tsx']);
const DEFAULT_BASELINE_PATH = path.resolve('scripts/fixtures/structural-baseline.json');
const OVER_500_LIMIT = 500;
const OVER_1000_LIMIT = 1000;

function readArgValue(name) {
  const args = process.argv.slice(2);
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return undefined;
}

function hasArg(name) {
  return process.argv.slice(2).includes(name);
}

const baselinePath = path.resolve(readArgValue('--baseline') ?? DEFAULT_BASELINE_PATH);
const writeBaseline = hasArg('--write-baseline');

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

function collectMetrics() {
  const files = walk(SRC_DIR)
    .filter((f) => TS_EXT.has(path.extname(f)))
    .sort((a, b) => a.localeCompare(b));

  const byFile = {};
  let asAny = 0;
  let filesOver500 = 0;
  let filesOver1000 = 0;

  for (const full of files) {
    const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
    const text = fs.readFileSync(full, 'utf8');
    const asAnyCount = (text.match(/\sas\s+any\b/g) ?? []).length;
    const lines = text.split('\n').length;
    const over500 = lines > OVER_500_LIMIT;
    const over1000 = lines > OVER_1000_LIMIT;

    if (asAnyCount > 0 || over500 || over1000) {
      byFile[rel] = { lines, asAny: asAnyCount };
    }

    asAny += asAnyCount;
    if (over500) filesOver500 += 1;
    if (over1000) filesOver1000 += 1;
  }

  return {
    totals: { asAny, filesOver500, filesOver1000 },
    files: byFile,
  };
}

function buildBaseline(metrics) {
  return {
    version: 1,
    root: 'src',
    limits: metrics.totals,
    note:
      'Structural debt ratchet baseline. Lower counts are allowed; any new or expanded over-budget file, or added as-any cast, fails audit:structural.',
    files: metrics.files,
  };
}

function loadBaseline(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing structural baseline at ${path.relative(process.cwd(), file)}. ` +
        'Run `node scripts/audit-structural-budgets.mjs --write-baseline` after reviewing the baseline intentionally.'
    );
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (parsed.version !== 1 || !parsed.limits || !parsed.files) {
    throw new Error(`Unsupported structural baseline format in ${path.relative(process.cwd(), file)}`);
  }
  return parsed;
}

function formatFileMetric(rel, metric) {
  return `${rel} (${metric.lines} lines, ${metric.asAny} as-any)`;
}

function topEntries(files, predicate, limit = 12) {
  return Object.entries(files)
    .filter(([, metric]) => predicate(metric))
    .sort((a, b) => b[1].lines - a[1].lines || b[1].asAny - a[1].asAny || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([rel, metric]) => `  - ${formatFileMetric(rel, metric)}`);
}

const metrics = collectMetrics();

if (writeBaseline) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(metrics), null, 2)}\n`);
  console.log(`Structural baseline written: ${path.relative(process.cwd(), baselinePath)}`);
  console.log(`- as any count: ${metrics.totals.asAny}`);
  console.log(`- files >500 lines: ${metrics.totals.filesOver500}`);
  console.log(`- files >1000 lines: ${metrics.totals.filesOver1000}`);
  process.exit(0);
}

let baseline;
try {
  baseline = loadBaseline(baselinePath);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const failures = [];
const baselineLimits = baseline.limits;

if (metrics.totals.asAny > baselineLimits.asAny) {
  failures.push(`'as any' count regressed: ${metrics.totals.asAny} > ${baselineLimits.asAny}`);
}
if (metrics.totals.filesOver500 > baselineLimits.filesOver500) {
  failures.push(`Files over 500 lines regressed: ${metrics.totals.filesOver500} > ${baselineLimits.filesOver500}`);
}
if (metrics.totals.filesOver1000 > baselineLimits.filesOver1000) {
  failures.push(`Files over 1000 lines regressed: ${metrics.totals.filesOver1000} > ${baselineLimits.filesOver1000}`);
}

const newAsAny = [];
const increasedAsAny = [];
const crossedOver500 = [];
const crossedOver1000 = [];
const expandedOverBudget = [];

for (const [rel, metric] of Object.entries(metrics.files)) {
  const base = baseline.files[rel];
  const baseAsAny = Number(base?.asAny ?? 0);
  const baseLines = Number(base?.lines ?? 0);

  if (metric.asAny > 0 && !base) newAsAny.push([rel, metric]);
  else if (metric.asAny > baseAsAny) increasedAsAny.push([rel, metric, baseAsAny]);

  const wasOver500 = baseLines > OVER_500_LIMIT;
  const wasOver1000 = baseLines > OVER_1000_LIMIT;
  if (metric.lines > OVER_500_LIMIT && !wasOver500) crossedOver500.push([rel, metric]);
  if (metric.lines > OVER_1000_LIMIT && !wasOver1000) crossedOver1000.push([rel, metric]);

  if (base && baseLines > OVER_500_LIMIT && metric.lines > baseLines) {
    expandedOverBudget.push([rel, metric, baseLines]);
  }
}

if (newAsAny.length > 0) {
  failures.push(
    `New files introduced 'as any': ${newAsAny
      .sort((a, b) => b[1].asAny - a[1].asAny || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([rel, metric]) => `${rel} (+${metric.asAny})`)
      .join(', ')}`
  );
}
if (increasedAsAny.length > 0) {
  failures.push(
    `Existing files increased 'as any': ${increasedAsAny
      .sort((a, b) => b[1].asAny - b[2] - (a[1].asAny - a[2]) || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([rel, metric, baseAsAny]) => `${rel} (${metric.asAny} > ${baseAsAny})`)
      .join(', ')}`
  );
}
if (crossedOver500.length > 0) {
  failures.push(
    `Files crossed 500 lines: ${crossedOver500
      .sort((a, b) => b[1].lines - a[1].lines || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([rel, metric]) => `${rel} (${metric.lines})`)
      .join(', ')}`
  );
}
if (crossedOver1000.length > 0) {
  failures.push(
    `Files crossed 1000 lines: ${crossedOver1000
      .sort((a, b) => b[1].lines - a[1].lines || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([rel, metric]) => `${rel} (${metric.lines})`)
      .join(', ')}`
  );
}
if (expandedOverBudget.length > 0) {
  failures.push(
    `Existing over-budget files grew: ${expandedOverBudget
      .sort((a, b) => b[1].lines - b[2] - (a[1].lines - a[2]) || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([rel, metric, baseLines]) => `${rel} (${metric.lines} > ${baseLines})`)
      .join(', ')}`
  );
}

if (failures.length > 0) {
  console.error('Structural budget audit failed:\n');
  for (const f of failures) console.error(`- ${f}`);
  console.error('\nCurrent metrics:');
  console.error(`  as any count: ${metrics.totals.asAny}`);
  console.error(`  files >500 lines: ${metrics.totals.filesOver500}`);
  console.error(`  files >1000 lines: ${metrics.totals.filesOver1000}`);
  console.error(`\nBaseline: ${path.relative(process.cwd(), baselinePath)}`);

  const largest = topEntries(metrics.files, (metric) => metric.lines > OVER_500_LIMIT);
  const asAnyTop = Object.entries(metrics.files)
    .filter(([, metric]) => metric.asAny > 0)
    .sort((a, b) => b[1].asAny - a[1].asAny || b[1].lines - a[1].lines || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([rel, metric]) => `  - ${formatFileMetric(rel, metric)}`);

  if (largest.length > 0) console.error(`\nLargest over-budget files:\n${largest.join('\n')}`);
  if (asAnyTop.length > 0) console.error(`\nTop as-any files:\n${asAnyTop.join('\n')}`);
  process.exit(1);
}

console.log('Structural budgets OK');
console.log(`- baseline: ${path.relative(process.cwd(), baselinePath)}`);
console.log(`- as any count: ${metrics.totals.asAny} / ${baselineLimits.asAny}`);
console.log(`- files >500 lines: ${metrics.totals.filesOver500} / ${baselineLimits.filesOver500}`);
console.log(`- files >1000 lines: ${metrics.totals.filesOver1000} / ${baselineLimits.filesOver1000}`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'design-docs-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const dir of ['scripts', 'src/routes', 'src/lib/api', 'docs/design', 'docs/work-log']) fs.mkdirSync(path.join(cwd, dir), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'dir');
  for (const name of ['design-inventory.mjs', 'audit-design-docs.mjs']) fs.copyFileSync(path.join(root, 'scripts', name), path.join(cwd, 'scripts', name));
  fs.writeFileSync(path.join(cwd, 'src/routes/router.tsx'), `createBrowserRouter([{ element: <Shell />, children: [{ path: '/app', element: <Member />, children: [{ index: true, element: <Home /> }, { path: 'vps/:id', element: <Detail /> }, ...adminFinanceRoutes] }] }]);`);
  fs.writeFileSync(path.join(cwd, 'src/routes/adminFinanceRoutes.tsx'), `export const adminFinanceRoutes = [{ element: <Gate />, children: [{path:'payments',element:<Payments />}]}];`);
  fs.writeFileSync(path.join(cwd, 'src/routes/securityAdvisoryAdminRoutes.tsx'), 'export const securityAdvisoryAdminRoutes = [];');
  fs.writeFileSync(path.join(cwd, 'src/lib/api/vps.ts'), 'export {};');
  fs.writeFileSync(path.join(cwd, 'src/lib/api/vps.test.ts'), 'test fixture');
  for (const name of ['README.md','UI_REDESIGN.md','SPEC.md','docs/README.md','docs/CANONICAL_DOCS.md','WORK_LOG.md']) fs.writeFileSync(path.join(cwd,name),'# Fixture\n');
  fs.writeFileSync(path.join(cwd,'docs/design/API_CONTRACTS.md'),'# API\n');
  fs.writeFileSync(path.join(cwd,'docs/work-log/README.md'),'# Work log\n');
  fs.writeFileSync(path.join(cwd,'docs/design/REQUIREMENTS.md'),'| REQ-001 | Requirement |\n');
  fs.writeFileSync(path.join(cwd,'docs/design/EVIDENCE_MATRIX.md'),'## Requirement coverage\n\n| REQ-001 | Manual review | Not executed |\n');
  const run = (...args) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  assert.equal(run('scripts/design-inventory.mjs','--write').status,0);
  // The audit checks tracked documentation/source paths, just like a checkout.
  for (const args of [['init', '--quiet'], ['add', '.']]) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return {cwd, run};
}

test('inventory includes nested/index routes, imported gates and API modules', t => {
  const {cwd,run}=fixture(t);
  const content=fs.readFileSync(path.join(cwd,'docs/design/IMPLEMENTATION_INVENTORY.md'),'utf8');
  assert.match(content,/`\/app\/vps\/:id`/);
  assert.match(content,/`\/app` \| index/);
  assert.match(content,/`\/app\/payments`/);
  assert.match(content,/<Shell \/> → <Member \/> → <Gate \/>/);
  assert.match(content,/API adapter modules \(1\)/);
  const result = run('scripts/audit-design-docs.mjs');
  assert.equal(result.status, 0, result.stderr);
});

test('audit rejects stale inventory after a route or adapter is added',t=>{
  const {cwd,run}=fixture(t);
  fs.writeFileSync(path.join(cwd,'src/lib/api/dns.ts'),'export {};');
  const result=run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/inventory is stale/);
});

test('audit rejects broken links and duplicate or undefined requirement IDs',t=>{
  const {cwd,run}=fixture(t);
  fs.writeFileSync(path.join(cwd,'docs/design/REQUIREMENTS.md'),'| REQ-001 | One |\n| REQ-001 | Two |\nREQ-999\n[missing](missing.md)\n');
  const result=run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/missing or external local link/);
  assert.match(result.stderr,/duplicated/);
  assert.match(result.stderr,/unknown REQ-999/);
});

test('inventory fails rather than silently omit an unresolved route spread',t=>{
  const {cwd,run}=fixture(t);
  fs.writeFileSync(path.join(cwd,'src/routes/router.tsx'),'createBrowserRouter([...unknownRoutes]);');
  const result=run('scripts/design-inventory.mjs','--write');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unresolved route spread/);
});

test('audit accepts the in-repository redesign bridge and historical mentions', t => {
  const {cwd, run} = fixture(t);
  fs.writeFileSync(path.join(cwd, 'docs/design/API_CONTRACTS.md'),
    '[Redesign index](../../UI_REDESIGN.md)\nThe old UI_REDESIGN.md is unavailable.\n');
  const result = run('scripts/audit-design-docs.mjs');
  assert.equal(result.status, 0, result.stderr);
});

test('audit rejects external redesign references in tracked docs and source', t => {
  const {cwd, run} = fixture(t);
  fs.writeFileSync(path.join(cwd, 'README.md'), '`../UI_REDESIGN.md`\n');
  fs.writeFileSync(path.join(cwd, 'src/lib/api/vps.ts'),
    '// Spec: ../../../../UI_REDESIGN.md\nexport {};\n');
  const result = run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /README\.md: obsolete external redesign reference/);
  assert.match(result.stderr, /src\/lib\/api\/vps\.ts: obsolete external redesign reference/);
});

test('audit checks links inside the redesign bridge', t => {
  const {cwd, run} = fixture(t);
  fs.writeFileSync(path.join(cwd, 'UI_REDESIGN.md'), '[Missing](missing.md)\n');
  const result = run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UI_REDESIGN\.md: missing or external local link missing\.md/);
});

test('audit discovers independent work-log entries without a shared index update', t => {
  const {cwd, run} = fixture(t);
  const first = path.join(cwd, 'docs/work-log/2026-09-27-first-feature.md');
  const second = path.join(cwd, 'docs/work-log/2026-09-27-second-feature.md');
  fs.writeFileSync(first, '[Requirement](../design/REQUIREMENTS.md)\n');
  fs.writeFileSync(second, '[Related change](2026-09-27-first-feature.md)\n');
  let result = run('scripts/audit-design-docs.mjs');
  assert.equal(result.status, 0, result.stderr);
  fs.appendFileSync(second, '[Broken evidence](missing-evidence.md)\n');
  result = run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /second-feature\.md: missing or external local link missing-evidence\.md/);
});


test('audit rejects missing, duplicate and unknown evidence rows', t => {
  const {cwd, run} = fixture(t);
  const file = path.join(cwd, 'docs/design/EVIDENCE_MATRIX.md');
  for (const content of ['', '| REQ-001 | A |\n| REQ-001 | B |', '| REQ-001 | A |\n| REQ-999 | B |']) {
    fs.writeFileSync(file, '## Requirement coverage\n\n' + content);
    const result = run('scripts/audit-design-docs.mjs');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Evidence matrix/);
  }
});

test('audit validates local headings, duplicate suffixes and explicit anchors', t => {
  const {cwd, run} = fixture(t);
  const file = path.join(cwd, 'docs/design/API_CONTRACTS.md');
  fs.writeFileSync(file, '# API\n## A `contract` (cs/en)\n## Same\n## Same\n<a id="special"></a>\n[One](#a-contract-csen) [Two](#same-1) [Three](#special)\n');
  let result = run('scripts/audit-design-docs.mjs');
  assert.equal(result.status, 0, result.stderr);
  fs.appendFileSync(file, '[Stale](REQUIREMENTS.md#deleted-heading)\n');
  result = run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing local anchor/);
});

test('audit checks deployment runbook links, without requiring a shared index', t => {
  const {cwd, run} = fixture(t);
  fs.mkdirSync(path.join(cwd, 'deploy/host'), {recursive: true});
  fs.writeFileSync(path.join(cwd, 'deploy/host/release.md'), '[Bad](../../README.md#absent)\n');
  const result = run('scripts/audit-design-docs.mjs');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /deploy\/host\/release.md: missing local anchor/);
});

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const allowed = new Set([
  path.join(srcDir, 'lib/api/app.ts'),
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield full;
  }
}

const offenders = [];
for (const file of walk(srcDir)) {
  if (allowed.has(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*lib\/api\/app['"]/.test(text)) {
    offenders.push(path.relative(root, file));
  }
}

if (offenders.length) {
  console.error('Legacy lib/api/app imports are forbidden outside src/lib/api/app.ts');
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}

console.log('audit-api-barrel-imports: OK');

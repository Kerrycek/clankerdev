#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src/components/ui/UserLookupInput.tsx',
  'src/components/ui/NodeLookupInput.tsx',
  'src/components/ui/VpsLookupInput.tsx',
  'src/components/ui/HostIpLookupInput.tsx',
  'src/components/ui/DatasetLookupInput.tsx',
  'src/components/ui/IpAddressLookupInput.tsx',
];

const failures = [];
for (const rel of files) {
  const full = path.resolve(rel);
  const text = fs.readFileSync(full, 'utf8');
  if (/\bas\s+any\b/.test(text)) failures.push(`${rel}: contains 'as any'`);
  if (/function\s+parseIdLike\s*\(/.test(text)) failures.push(`${rel}: duplicates local parseIdLike helper`);
}

if (failures.length) {
  console.error('Lookup primitives audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Lookup primitives OK');

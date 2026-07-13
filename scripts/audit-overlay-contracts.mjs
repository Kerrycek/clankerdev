#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const checks = [
  {
    file: 'src/components/ui/Modal.tsx',
    mustInclude: ['bg-backdrop/45', 'data-overlay-backdrop="true"', 'data-overlay="modal"', 'data-overlay-surface="overlay"', 'bg-overlay-surface'],
  },
  {
    file: 'src/components/ui/Drawer.tsx',
    mustInclude: ['bg-backdrop/45', 'data-overlay-backdrop="true"', 'data-overlay="drawer"', 'data-overlay-surface="overlay"', 'bg-overlay-surface'],
  },
  {
    file: 'src/app/toasts.tsx',
    mustInclude: ['data-overlay="toast"', 'data-overlay-surface="overlay"', 'bg-overlay-surface'],
  },
  {
    file: 'src/components/layout/AppHeader.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface'],
    minimumCounts: { 'data-overlay="popover"': 2 },
  },
  {
    file: 'src/components/ui/SmartFilterInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/UserLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/NodeLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/VpsLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/HostIpLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/DatasetLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/IpAddressLookupInput.tsx',
    mustInclude: ['data-overlay="popover"', 'data-overlay-surface="overlay"', 'bg-overlay-surface', 'shadow-panel'],
  },
  {
    file: 'src/components/ui/TimeSeriesChart.tsx',
    mustInclude: ['data-overlay="tooltip"', 'data-overlay-surface="overlay"', 'bg-overlay-surface'],
  },
];

const problems = [];
for (const check of checks) {
  const text = read(check.file);
  for (const token of check.mustInclude) {
    if (!text.includes(token)) {
      problems.push(`${check.file}: missing required overlay contract token ${JSON.stringify(token)}`);
    }
  }
  for (const [token, min] of Object.entries(check.minimumCounts ?? {})) {
    const count = text.split(token).length - 1;
    if (count < min) {
      problems.push(`${check.file}: expected at least ${min} occurrences of ${JSON.stringify(token)}, found ${count}`);
    }
  }
}

if (problems.length > 0) {
  console.error('Overlay contract audit failed:\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log('Overlay contract audit OK');

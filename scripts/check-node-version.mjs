#!/usr/bin/env node
const inputVersion = process.argv[2] ?? process.versions.node;

function parse(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isSupportedNode(version) {
  const parsed = parse(version);

  if (!parsed) return false;

  const { major, minor, patch } = parsed;

  if (major >= 24) return true;
  if (major === 22) return minor > 12 || (minor === 12 && patch >= 0);
  if (major === 20) return minor > 19 || (minor === 19 && patch >= 0);

  return false;
}

if (isSupportedNode(inputVersion)) {
  process.exit(0);
}

const message = [
  `Unsupported Node.js version: ${inputVersion}`,
  'webui-next requires Node.js ^20.19.0, ^22.12.0, or >=24.0.0.',
  'Recommended local baseline: Node.js 22.12.0 or newer on the 22.x LTS line.',
  'This guard is intentionally strict because Vite 7, Vitest 4, jsdom 27, and @vitejs/plugin-react 5 no longer support Node 18.',
].join('\n');

console.error(message);
process.exit(1);

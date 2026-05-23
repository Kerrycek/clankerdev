#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { build as esbuild } from 'esbuild';

function ensureFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

function patchFile(target, transform, label) {
  if (!fs.existsSync(target)) {
    console.log(`[patch-test-deps] ${label}: target not found, skipping`);
    return;
  }

  const source = fs.readFileSync(target, 'utf8');
  const next = transform(source);
  if (next === source) {
    console.log(`[patch-test-deps] ${label}: already patched or no changes needed`);
    return;
  }

  fs.writeFileSync(target, next, 'utf8');
  console.log(`[patch-test-deps] ${label}: patched`);
}

const shimSource = fs.readFileSync(path.resolve('scripts/shims/jsdomEncodingShim.cjs'), 'utf8');
ensureFile(path.resolve('node_modules/jsdom-encoding-shim/index.js'), shimSource);
ensureFile(path.resolve('node_modules/jsdom-encoding-shim/package.json'), JSON.stringify({
  name: 'jsdom-encoding-shim',
  private: true,
  main: 'index.js',
}, null, 2) + '\n');
console.log('[patch-test-deps] jsdom-encoding-shim: ensured');

const htmlSnifferTarget = path.resolve('node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js');
patchFile(
  htmlSnifferTarget,
  (source) => source
    .replace(
      'const { getBOMEncoding, labelToName } = require("@exodus/bytes/encoding-lite.js");',
      'const { getBOMEncoding, labelToName } = require("jsdom-encoding-shim");'
    )
    .replace(
      'const { getBOMEncoding, labelToName } = require("../../../scripts/shims/htmlEncodingLite.cjs");',
      'const { getBOMEncoding, labelToName } = require("jsdom-encoding-shim");'
    ),
  'html-encoding-sniffer'
);


const parse5PkgTarget = path.resolve('node_modules/parse5/package.json');
if (!fs.existsSync(parse5PkgTarget)) {
  console.log('[patch-test-deps] parse5: package not found, skipping');
} else {
  const parse5Pkg = JSON.parse(fs.readFileSync(parse5PkgTarget, 'utf8'));
  const parse5Entry = path.resolve('node_modules/parse5/dist/index.js');
  const parse5Cjs = path.resolve('node_modules/parse5/dist/index.cjs');

  if (!fs.existsSync(parse5Entry)) {
    console.log('[patch-test-deps] parse5: ESM entry not found, skipping');
  } else {
    let needsBundle = !fs.existsSync(parse5Cjs);

    if (!needsBundle) {
      try {
        const sourceStat = fs.statSync(parse5Entry);
        const cjsStat = fs.statSync(parse5Cjs);
        needsBundle = cjsStat.mtimeMs < sourceStat.mtimeMs;
      } catch {
        needsBundle = true;
      }
    }

    if (needsBundle) {
      await esbuild({
        entryPoints: [parse5Entry],
        outfile: parse5Cjs,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: ['node18'],
        logLevel: 'silent',
      });
      console.log('[patch-test-deps] parse5: built CommonJS bridge');
    } else {
      console.log('[patch-test-deps] parse5: CommonJS bridge already present');
    }

    const nextExports = {
      '.': {
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
    };

    const needsPkgPatch = parse5Pkg.main !== 'dist/index.cjs' || JSON.stringify(parse5Pkg.exports) !== JSON.stringify(nextExports);
    if (needsPkgPatch) {
      parse5Pkg.main = 'dist/index.cjs';
      parse5Pkg.exports = nextExports;
      fs.writeFileSync(parse5PkgTarget, JSON.stringify(parse5Pkg, null, 4) + '\n', 'utf8');
      console.log('[patch-test-deps] parse5: package.json patched for require()');
    } else {
      console.log('[patch-test-deps] parse5: package.json already patched');
    }
  }
}

const webidlTarget = path.resolve('node_modules/webidl-conversions/lib/index.js');
patchFile(
  webidlTarget,
  (source) => source
    .replace(
      'const abResizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable").get;',
      'const abResizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;'
    )
    .replace(
      'const sabGrowableGetter = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable").get;',
      'const sabGrowableGetter = typeof SharedArrayBuffer === "undefined" ? undefined : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")?.get;'
    )
    .replace(
      '    return abResizableGetter.call(value);',
      '    return abResizableGetter ? abResizableGetter.call(value) : false;'
    )
    .replace(
      '    return sabGrowableGetter.call(value);',
      '    return sabGrowableGetter ? sabGrowableGetter.call(value) : false;'
    )
    .replace(
      '  return exports.DOMString(value, options).toWellFormed();',
      '  const domString = exports.DOMString(value, options);\n  return typeof domString.toWellFormed === "function" ? domString.toWellFormed() : domString;'
    ),
  'webidl-conversions'
);

for (const rel of [
  'node_modules/jsdom/lib/api.js',
  'node_modules/jsdom/lib/jsdom/browser/Window.js',
  'node_modules/jsdom/lib/jsdom/living/encoding/TextDecoder-impl.js',
  'node_modules/jsdom/lib/jsdom/living/encoding/TextEncoder-impl.js',
  'node_modules/jsdom/lib/jsdom/living/helpers/stylesheets.js',
  'node_modules/jsdom/lib/jsdom/living/file-api/FileReader-impl.js',
  'node_modules/jsdom/lib/jsdom/living/nodes/HTMLFrameElement-impl.js',
  'node_modules/jsdom/lib/jsdom/living/nodes/HTMLScriptElement-impl.js',
  'node_modules/jsdom/lib/jsdom/living/xhr/XMLHttpRequest-impl.js',
]) {
  patchFile(
    path.resolve(rel),
    (source) => source
      .replaceAll('require("@exodus/bytes/encoding.js")', 'require("jsdom-encoding-shim")')
      .replace(
        '    window = vm.createContext(vm.constants.DONT_CONTEXTIFY);',
        '    window = vm.createContext(vm.constants?.DONT_CONTEXTIFY ?? {});'
      ),
    rel
  );
}

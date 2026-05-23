import { describe, expect, it, vi } from 'vitest';

import {
  buildRuntimeScriptCandidates,
  loadOptionalRuntimeScripts,
  normalizeBaseUrl,
  shouldTryLocalRuntimeConfig,
} from './runtimeBootstrap';

describe('runtimeBootstrap', () => {
  it('normalizes base urls for runtime script resolution', () => {
    expect(normalizeBaseUrl(undefined)).toBe('/');
    expect(normalizeBaseUrl('')).toBe('/');
    expect(normalizeBaseUrl('/')).toBe('/');
    expect(normalizeBaseUrl('ui-next')).toBe('/ui-next/');
    expect(normalizeBaseUrl('/ui-next')).toBe('/ui-next/');
    expect(normalizeBaseUrl('/ui-next/')).toBe('/ui-next/');
  });

  it('builds root-only candidates for root deployments', () => {
    expect(buildRuntimeScriptCandidates('config.js', '/', 'https://example.test')).toEqual([
      'https://example.test/config.js',
    ]);
  });

  it('builds sub-path candidates with a root fallback', () => {
    expect(buildRuntimeScriptCandidates('config.js', '/ui-next/', 'https://example.test')).toEqual([
      'https://example.test/ui-next/config.js',
      'https://example.test/config.js',
    ]);
  });

  it('enables config.local.js for local hosts even in production mode', () => {
    expect(shouldTryLocalRuntimeConfig(false, 'localhost')).toBe(true);
    expect(shouldTryLocalRuntimeConfig(false, '127.0.0.1')).toBe(true);
    expect(shouldTryLocalRuntimeConfig(false, '::1')).toBe(true);
    expect(shouldTryLocalRuntimeConfig(false, 'example.test')).toBe(false);
  });

  it('falls back from a sub-path config.js to the root config.js', async () => {
    const calls: string[] = [];
    const loadScript = vi.fn(async (src: string) => {
      calls.push(src);
      if (src === 'https://example.test/ui-next/config.js') {
        throw new Error('404');
      }
    });

    const loaded = await loadOptionalRuntimeScripts({
      baseUrl: '/ui-next/',
      origin: 'https://example.test',
      hostname: 'example.test',
      isDev: false,
      loadScript,
      scriptNames: ['config.js'],
    });

    expect(calls).toEqual([
      'https://example.test/ui-next/config.js',
      'https://example.test/config.js',
    ]);
    expect(loaded).toEqual(['https://example.test/config.js']);
  });

  it('loads config.local.js after config.js for local development', async () => {
    const calls: string[] = [];
    const loadScript = vi.fn(async (src: string) => {
      calls.push(src);
    });

    const loaded = await loadOptionalRuntimeScripts({
      baseUrl: '/',
      origin: 'http://127.0.0.1:5173',
      hostname: '127.0.0.1',
      isDev: true,
      loadScript,
    });

    expect(calls).toEqual([
      'http://127.0.0.1:5173/config.js',
      'http://127.0.0.1:5173/config.local.js',
    ]);
    expect(loaded).toEqual([
      'http://127.0.0.1:5173/config.js',
      'http://127.0.0.1:5173/config.local.js',
    ]);
  });
});

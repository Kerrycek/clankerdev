import { describe, expect, it, vi } from 'vitest';

import { frontendBundleChanged, moduleScriptUrlFromHtml } from './frontendFreshness';

describe('frontend freshness', () => {
  it('extracts the hashed module URL from the application shell', () => {
    expect(
      moduleScriptUrlFromHtml(
        '<script type="module" crossorigin src="/assets/index-new.js"></script>',
        'https://example.test/app'
      )
    ).toBe('https://example.test/assets/index-new.js');
  });

  it('detects when the deployed bundle changed', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<script type="module" src="/assets/index-new.js"></script>', { status: 200 })
    );

    await expect(
      frontendBundleChanged({
        currentScriptUrl: 'https://example.test/assets/index-old.js',
        indexUrl: 'https://example.test/',
        fetchImpl,
      })
    ).resolves.toBe(true);
  });

  it('keeps the current document when the bundle is unchanged', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<script type="module" src="/assets/index-current.js"></script>', { status: 200 })
    );

    await expect(
      frontendBundleChanged({
        currentScriptUrl: 'https://example.test/assets/index-current.js',
        indexUrl: 'https://example.test/',
        fetchImpl,
      })
    ).resolves.toBe(false);
  });
});

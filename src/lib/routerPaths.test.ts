import { describe, expect, it } from 'vitest';

import {
  normalizeRouterBasename,
  sanitizeLocalPath,
  sanitizePostLoginPath,
  withRouterBasename,
  withSameOriginNextParam,
} from './routerPaths';

describe('routerPaths', () => {
  it('normalizes router basenames', () => {
    expect(normalizeRouterBasename(undefined)).toBe('');
    expect(normalizeRouterBasename('')).toBe('');
    expect(normalizeRouterBasename('/')).toBe('');
    expect(normalizeRouterBasename('ui-next')).toBe('/ui-next');
    expect(normalizeRouterBasename('/ui-next/')).toBe('/ui-next');
  });

  it('sanitizes redirect targets to local absolute paths', () => {
    expect(sanitizeLocalPath('/app', '/fallback')).toBe('/app');
    expect(sanitizeLocalPath('/ui-next/app?foo=1#bar', '/fallback')).toBe('/ui-next/app?foo=1#bar');
    expect(sanitizeLocalPath('', '/fallback')).toBe('/fallback');
    expect(sanitizeLocalPath('app', '/fallback')).toBe('/fallback');
    expect(sanitizeLocalPath('//evil.test', '/fallback')).toBe('/fallback');
    expect(sanitizeLocalPath(' https://evil.test ', '/fallback')).toBe('/fallback');
  });

  it('prefixes paths with the router basename exactly once', () => {
    expect(withRouterBasename('/app', '/ui-next')).toBe('/ui-next/app');
    expect(withRouterBasename('/', '/ui-next')).toBe('/ui-next/');
    expect(withRouterBasename('/ui-next/app', '/ui-next')).toBe('/ui-next/app');
    expect(withRouterBasename('/app', '')).toBe('/app');
  });

  it('does not preserve the expired session notice as a post-login target', () => {
    expect(sanitizePostLoginPath('/?session=expired')).toBe('/app');
    expect(sanitizePostLoginPath('/?session=expired#top', '/admin')).toBe('/admin');
    expect(sanitizePostLoginPath('/admin/users?limit=50')).toBe('/admin/users?limit=50');
  });

  it('retargets same-origin urls with next while leaving cross-origin urls untouched', () => {
    expect(withSameOriginNextParam('/oauth/logout', '/ui-next/', 'https://example.test')).toBe(
      'https://example.test/oauth/logout?next=%2Fui-next%2F'
    );
    expect(withSameOriginNextParam('https://auth.example.test/logout', '/ui-next/', 'https://example.test')).toBe(
      'https://auth.example.test/logout'
    );
  });
});

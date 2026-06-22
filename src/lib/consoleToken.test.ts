import { describe, expect, test } from 'vitest';

import {
  buildConsoleUrl,
  isConsoleTokenExpired,
  millisecondsUntilConsoleTokenExpiry,
  normalizeConsoleToken,
  normalizeRemoteConsoleServer,
} from './consoleToken';

describe('console token helpers', () => {
  test('normalizes configured console server URLs', () => {
    expect(normalizeRemoteConsoleServer('https://console.example///')).toBe('https://console.example');
    expect(normalizeRemoteConsoleServer('/_console/')).toBe('/_console');
    expect(normalizeRemoteConsoleServer('https://console.example/path/?debug=1#token')).toBe('https://console.example/path');
    expect(normalizeRemoteConsoleServer('/_console/?debug=1#token')).toBe('/_console');
    expect(normalizeRemoteConsoleServer('   ')).toBeNull();
    expect(normalizeRemoteConsoleServer(null)).toBeNull();
  });


  test('rejects unsafe configured console server URLs', () => {
    expect(normalizeRemoteConsoleServer('javascript:alert(1)')).toBeNull();
    expect(normalizeRemoteConsoleServer('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeRemoteConsoleServer('//evil.example/console')).toBeNull();
    expect(normalizeRemoteConsoleServer('https://user:pass@console.example')).toBeNull();
    expect(normalizeRemoteConsoleServer('console.example/no-scheme')).toBeNull();
  });

  test('accepts legacy and explicit token response fields', () => {
    expect(normalizeConsoleToken({ token: 'T1', expiration: '2027-01-01T00:00:00Z' })).toEqual({
      token: 'T1',
      expiration: '2027-01-01T00:00:00Z',
    });
    expect(normalizeConsoleToken({ session_token: 'T2', expires_at: '2027-01-02T00:00:00Z' })).toEqual({
      token: 'T2',
      expiration: '2027-01-02T00:00:00Z',
    });
    expect(normalizeConsoleToken({ session: 'T3' })).toEqual({ token: 'T3', expiration: null });
    expect(normalizeConsoleToken({ token: '  ' })).toBeNull();
  });

  test('builds a scoped console URL without leaving raw token characters unescaped', () => {
    expect(buildConsoleUrl('/_console/', 123, 'abc+/= token')).toBe('/_console/console/123?session=abc%2B%2F%3D%20token');
    expect(buildConsoleUrl('', 123, 'T')).toBeNull();
    expect(buildConsoleUrl('/_console', 123, '')).toBeNull();
  });

  test('calculates expiry state from the returned expiration timestamp', () => {
    const now = Date.parse('2027-01-01T00:00:00Z');

    expect(millisecondsUntilConsoleTokenExpiry('2027-01-01T00:00:10Z', now)).toBe(10_000);
    expect(millisecondsUntilConsoleTokenExpiry('2026-12-31T23:59:59Z', now)).toBe(0);
    expect(millisecondsUntilConsoleTokenExpiry('not-a-date', now)).toBeNull();
    expect(isConsoleTokenExpired('2027-01-01T00:00:10Z', now)).toBe(false);
    expect(isConsoleTokenExpired('2026-12-31T23:59:59Z', now)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { HaveApiError } from './api/haveapi';
import { buildErrorDetails, classifyError, errorI18nKeys } from './errorMapping';

describe('classifyError', () => {
  it('maps HTTP status codes from HaveApiError', () => {
    expect(classifyError(new HaveApiError({ status: false, message: 'unauth' }, 'HTTP 401', 401)).kind).toBe(
      'unauthorized'
    );
    expect(classifyError(new HaveApiError({ status: false, message: 'forbidden' }, 'HTTP 403', 403)).kind).toBe(
      'forbidden'
    );
    expect(classifyError(new HaveApiError({ status: false, message: 'not found' }, 'HTTP 404', 404)).kind).toBe(
      'not_found'
    );
    expect(classifyError(new HaveApiError({ status: false, message: 'locked' }, 'HTTP 423', 423)).kind).toBe('locked');
    expect(classifyError(new HaveApiError({ status: false, message: 'server' }, 'HTTP 500', 500)).kind).toBe('server');
  });

  it('detects common network errors', () => {
    expect(classifyError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(classifyError(new TypeError('NetworkError when attempting to fetch resource.')).kind).toBe('network');
  });

  it('falls back to unexpected', () => {
    expect(classifyError(new Error('boom')).kind).toBe('unexpected');
    expect(classifyError('boom').kind).toBe('unexpected');
  });
});

describe('errorI18nKeys', () => {
  it('returns stable title/body keys', () => {
    const mapped = errorI18nKeys('network');
    expect(mapped.titleKey).toBe('error.network.title');
    expect(mapped.bodyKey).toBe('error.network.body');
  });
});

describe('buildErrorDetails', () => {
  it('includes request and HaveAPI details when available', () => {
    const err = new HaveApiError({ status: false, message: 'nope', errors: { x: ['y'] } }, 'HTTP 403', 403, {
      method: 'GET',
      path: '/vpses',
      url: 'https://example.invalid/api/v7.0/vpses',
    });

    const { payload, text } = buildErrorDetails({ error: err, route: '/app/vps' });

    expect(payload['httpStatus']).toBe(403);
    expect(payload['request']).toEqual({ method: 'GET', path: '/vpses', url: 'https://example.invalid/api/v7.0/vpses' });
    expect(payload['haveApiMessage']).toBe('nope');
    expect(text).toContain('"httpStatus": 403');
    expect(text).toContain('"haveApiMessage": "nope"');
  });
});

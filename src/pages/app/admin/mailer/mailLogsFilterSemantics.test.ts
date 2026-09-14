import { describe, expect, test } from 'vitest';

import { normalizeLegacyMailLogsUrl } from './mailLogsFilterSemantics';

describe('legacy mail-log URL normalization', () => {
  test('leaves supported pagination untouched', () => {
    const result = normalizeLegacyMailLogsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('limit=25&from_id=400&page=3'),
    });

    expect(result).toEqual({
      changed: false,
      href: '/admin/mailer/log?limit=25&from_id=400&page=3',
    });
  });

  test('removes every unsupported filter and resets stale pagination', () => {
    const searchParams = new URLSearchParams(
      'q=invoice&q=welcome&user=42&template=7&mail_template=8&after=2026-01-01&before=2026-01-31&created_after=a&created_before=b&limit=25&from_id=400&page=3'
    );
    const originalSearch = searchParams.toString();
    const result = normalizeLegacyMailLogsUrl({
      basePath: '/admin',
      searchParams,
    });

    expect(result).toEqual({
      changed: true,
      href: '/admin/mailer/log?limit=25',
    });
    expect(searchParams.toString()).toBe(originalSearch);
  });

  test('also canonicalizes empty legacy parameters', () => {
    const result = normalizeLegacyMailLogsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('q=&template=&from_id=400&page=3'),
    });

    expect(result).toEqual({
      changed: true,
      href: '/admin/mailer/log',
    });
  });
});

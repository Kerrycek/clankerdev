import { describe, expect, test } from 'vitest';

import { normalizeLegacyNetworkSearch } from './networkFilterSemantics';

describe('cluster network filter semantics', () => {
  test('removes unsupported filters and their stale cursor as one canonical transition', () => {
    const result = normalizeLegacyNetworkSearch(
      new URLSearchParams(
        'q=public&ip_version=4&role=public_access&managed=true&location=1&purpose=vps&limit=25&from_id=99&page=2'
      )
    );

    expect(result.changed).toBe(true);
    expect(result.searchParams.toString()).toBe('location=1&purpose=vps&limit=25&page=1');
  });

  test('leaves supported filters and pagination untouched', () => {
    const source = new URLSearchParams('location=2&purpose=export&limit=50&from_id=200&page=3');
    const result = normalizeLegacyNetworkSearch(source);

    expect(result.changed).toBe(false);
    expect(result.searchParams.toString()).toBe(source.toString());
  });
});

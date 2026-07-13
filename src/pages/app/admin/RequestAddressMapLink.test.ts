import { describe, expect, test } from 'vitest';

import { googleMapsAddressUrl } from './RequestAddressMapLink';

describe('registration address map link', () => {
  test('builds an official Google Maps search URL without an API key', () => {
    const href = googleMapsAddressUrl('  Stodolní 138/44, 14400 Ostrava, Česko  ');
    const url = new URL(href!);

    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('Stodolní 138/44, 14400 Ostrava, Česko');
  });

  test('does not create a third-party link for a missing address', () => {
    expect(googleMapsAddressUrl(undefined)).toBeNull();
    expect(googleMapsAddressUrl('   ')).toBeNull();
  });
});

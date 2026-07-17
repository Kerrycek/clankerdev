import { describe, expect, test } from 'vitest';

import { nominatimSearchUrl, openStreetMapAddressUrl, openStreetMapEmbedUrl } from './RequestAddressMapLink';

describe('registration address map link', () => {
  test('builds an official OpenStreetMap search URL without an API key', () => {
    const href = openStreetMapAddressUrl('  Stodolní 138/44, 14400 Ostrava, Česko  ');
    const url = new URL(href!);

    expect(url.origin).toBe('https://www.openstreetmap.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('query')).toBe('Stodolní 138/44, 14400 Ostrava, Česko');
  });

  test('does not create a third-party link for a missing address', () => {
    expect(openStreetMapAddressUrl(undefined)).toBeNull();
    expect(openStreetMapAddressUrl('   ')).toBeNull();
  });

  test('builds an OpenStreetMap embed URL with a house marker', () => {
    const href = openStreetMapEmbedUrl({ lat: 49.835556, lon: 18.2925 });
    const url = new URL(href!);

    expect(url.origin).toBe('https://www.openstreetmap.org');
    expect(url.pathname).toBe('/export/embed.html');
    expect(url.searchParams.get('layer')).toBe('mapnik');
    expect(url.searchParams.get('marker')).toBe('49.835556,18.292500');
    expect(url.searchParams.get('bbox')).toBe('18.289500,49.832556,18.295500,49.838556');
  });

  test('builds a Nominatim lookup URL for progressive map previews', () => {
    const href = nominatimSearchUrl('Stodolní 138/44, 14400 Ostrava, Česko');
    const url = new URL(href);

    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('q')).toBe('Stodolní 138/44, 14400 Ostrava, Česko');
  });
});

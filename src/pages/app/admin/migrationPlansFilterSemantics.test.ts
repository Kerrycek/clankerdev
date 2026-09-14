import { describe, expect, test } from 'vitest';

import {
  normalizeLegacyMigrationPlansUrl,
  updateMigrationPlanFilterSearchParams,
} from './migrationPlansFilterSemantics';

describe('migration-plan filter URL updates', () => {
  test('updates supported filters atomically while preserving unrelated parameters', () => {
    const result = updateMigrationPlanFilterSearchParams({
      searchParams: new URLSearchParams('limit=25&page=2'),
      state: 'running',
      user: ' 42 ',
    });

    expect(result?.toString()).toBe('limit=25&page=2&state=running&user=42');
  });

  test('returns null instead of creating a duplicate history entry for an unchanged URL', () => {
    const result = updateMigrationPlanFilterSearchParams({
      searchParams: new URLSearchParams('state=running&user=42&limit=25'),
      state: 'running',
      user: '42',
    });

    expect(result).toBeNull();
  });
});

describe('legacy migration-plan URL normalization', () => {
  test('leaves supported filters and ordinary pagination untouched', () => {
    const result = normalizeLegacyMigrationPlansUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('state=running&user=42&limit=25&from_id=400&page=3'),
    });

    expect(result).toEqual({
      changed: false,
      href: '/admin/migration-plans?state=running&user=42&limit=25&from_id=400&page=3',
    });
  });

  test('removes every legacy q value and stale pagination while preserving supported filters', () => {
    const searchParams = new URLSearchParams(
      'q=maintenance&q=drain&state=running&user=42&limit=25&from_id=400&page=3'
    );
    const originalSearch = searchParams.toString();
    const result = normalizeLegacyMigrationPlansUrl({
      basePath: '/admin',
      searchParams,
    });

    expect(result).toEqual({
      changed: true,
      href: '/admin/migration-plans?state=running&user=42&limit=25',
    });
    expect(searchParams.toString()).toBe(originalSearch);
  });

  test('also canonicalizes an empty legacy q parameter', () => {
    const result = normalizeLegacyMigrationPlansUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('q=&from_id=400&page=3'),
    });

    expect(result).toEqual({
      changed: true,
      href: '/admin/migration-plans',
    });
  });
});

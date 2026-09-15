import { describe, expect, it } from 'vitest';

import {
  buildOomReportPage,
  canonicalKey,
  normalizeOomListSearchParams,
  resolveOptionId,
  UNSUPPORTED_OOM_SEARCH_KEY,
} from './oomReportsListSemantics';

describe('buildOomReportPage', () => {
  for (const limit of [25, 50, 100]) {
    it(`keeps a limit ${limit} sentinel hidden and derives the cursor from visible rows`, () => {
      const reports = Array.from({ length: limit + 1 }, (_, index) => ({ id: 1_000 - index }));

      const page = buildOomReportPage(reports, limit);

      expect(page.rows).toHaveLength(limit);
      expect(page.rows.at(-1)?.id).toBe(1_001 - limit);
      expect(page.rows).not.toContainEqual({ id: 1_000 - limit });
      expect(page.cursor).toBe(1_001 - limit);
      expect(page.hasMore).toBe(true);
    });
  }

  it('recognizes an exact terminal page and fails closed without a valid visible cursor', () => {
    expect(buildOomReportPage([{ id: 2 }, { id: 1 }], 2)).toEqual({
      rows: [{ id: 2 }, { id: 1 }],
      hasMore: false,
      cursor: 1,
    });
    expect(buildOomReportPage([{ id: 2 }, { id: 5 }], 2).cursor).toBe(5);
    expect(buildOomReportPage([{ id: 'invalid' }, { id: 1 }], 1)).toEqual({
      rows: [{ id: 'invalid' }],
      hasMore: true,
      cursor: null,
    });
    expect(buildOomReportPage([{ id: true }], 1).cursor).toBeNull();
    expect(buildOomReportPage([{ id: '5' }], 1).cursor).toBeNull();
    expect(buildOomReportPage([{ id: 5.9 }], 1).cursor).toBeNull();
    expect(buildOomReportPage(undefined, 25)).toEqual({ rows: [], hasMore: false, cursor: null });
  });
});

const options = [
  { id: 21, label: 'Production Prague' },
  { id: 22, label: 'Production Brno' },
  { id: 23, label: 'Playground' },
];

describe('resolveOptionId', () => {
  const label = (option: (typeof options)[number]) => option.label;

  it('prefers an exact numeric id and resolves a unique label fragment', () => {
    expect(resolveOptionId(options, '22', label)).toEqual({ id: 22 });
    expect(resolveOptionId(options, 'prague', label)).toEqual({ id: 21 });
  });

  it('rejects ambiguous and unknown labels instead of silently choosing one', () => {
    expect(resolveOptionId(options, 'production', label)).toEqual({ err: 'ambiguous' });
    expect(resolveOptionId(options, 'staging', label)).toEqual({ err: 'none' });
  });
});

describe('OOM list search contract', () => {
  it('classifies full-text aliases as explicitly unsupported', () => {
    for (const key of ['q', 'query', 'search', 'text']) {
      expect(canonicalKey(key)).toBe(UNSUPPORTED_OOM_SEARCH_KEY);
    }
    expect(canonicalKey('process')).toBeNull();
  });

  it('removes obsolete search and stale pagination while preserving exact filters', () => {
    const result = normalizeOomListSearchParams(
      new URLSearchParams('q=nginx&from_id=101&page=2&limit=25&cgroup=%2Fuser.slice&user=42'),
      true
    );

    expect(result.changed).toBe(true);
    expect(result.searchParams.toString()).toBe('page=1&limit=25&cgroup=%2Fuser.slice&user=42');
  });

  it('removes arbitrary user scope outside the global admin view', () => {
    const result = normalizeOomListSearchParams(
      new URLSearchParams('user=42&from_id=101&page=2&vps=7'),
      false
    );

    expect(result.changed).toBe(true);
    expect(result.searchParams.toString()).toBe('page=1&vps=7');
  });

  it('leaves an already valid URL untouched', () => {
    const result = normalizeOomListSearchParams(new URLSearchParams('limit=50&vps=7&page=3'), true);

    expect(result.changed).toBe(false);
    expect(result.searchParams.toString()).toBe('limit=50&vps=7&page=3');
  });
});

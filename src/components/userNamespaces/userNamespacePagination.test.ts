import { describe, expect, it } from 'vitest';

import { buildUserNamespacePageWindow } from './userNamespacePagination';

const rows = (...ids: number[]) => ids.map((id) => ({ id }));

describe('user namespace pagination', () => {
  for (const limit of [25, 50, 100]) {
    it(`hides the ${limit}-row look-ahead sentinel and uses the greatest visible ID`, () => {
      const page = Array.from({ length: limit + 1 }, (_, index) => ({ id: index + 1 }));

      expect(buildUserNamespacePageWindow(page, limit)).toEqual({
        rows: page.slice(0, limit),
        cursor: limit,
        hasMore: true,
      });
    });
  }

  it('recognizes exact and below-limit terminal pages', () => {
    expect(buildUserNamespacePageWindow(rows(26, 27, 28), 3, 25)).toEqual({
      rows: rows(26, 27, 28),
      cursor: 28,
      hasMore: false,
    });
    expect(buildUserNamespacePageWindow(rows(26, 27), 3, 25)).toEqual({
      rows: rows(26, 27),
      cursor: 27,
      hasMore: false,
    });
  });

  it('fails closed when a look-ahead page cannot advance its exclusive cursor', () => {
    expect(buildUserNamespacePageWindow(rows(25, 24, 23, 22), 3, 25)).toEqual({
      rows: rows(25, 24, 23),
      cursor: null,
      hasMore: false,
    });
    expect(buildUserNamespacePageWindow([], 25, 25)).toEqual({
      rows: [],
      cursor: null,
      hasMore: false,
    });
  });
});

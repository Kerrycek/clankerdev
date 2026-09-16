import { describe, expect, it } from 'vitest';

import type { DnsTsigKeySummary } from '../../../lib/api/dns';
import { dnsTsigKeyPage } from './dnsTsigKeyPagination';

const keys = (...ids: number[]) => ids.map((id) => ({ id }) as DnsTsigKeySummary);

describe('user TSIG key pagination', () => {
  it('uses the greatest visible ID for the ascending HaveAPI cursor', () => {
    expect(dnsTsigKeyPage(keys(1, 2, 3, 4), 3)).toEqual({
      rows: keys(1, 2, 3),
      hasMore: true,
      cursor: 3,
    });
  });

  it('disables Next for an exactly full terminal page', () => {
    expect(dnsTsigKeyPage(keys(26, 27, 28), 3)).toEqual({
      rows: keys(26, 27, 28),
      hasMore: false,
      cursor: 28,
    });
  });

  it('returns an empty page without inventing a cursor', () => {
    expect(dnsTsigKeyPage([], 25)).toEqual({ rows: [], hasMore: false, cursor: null });
  });
});

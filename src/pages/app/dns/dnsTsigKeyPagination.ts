import type { DnsTsigKeySummary } from '../../../lib/api/dns';
import { cursorFromAscendingPage } from '../../../lib/lockIndex';

export interface DnsTsigKeyPage {
  rows: DnsTsigKeySummary[];
  hasMore: boolean;
  cursor: number | null;
}

/**
 * Split a HaveAPI ascending page from its one-row look-ahead sentinel.
 *
 * DnsTsigKey::Index uses `id > from_id`, so the next cursor is the greatest
 * visible ID. The hidden sentinel must never influence that cursor.
 */
export function dnsTsigKeyPage(
  keys: DnsTsigKeySummary[] | undefined,
  limit: number
): DnsTsigKeyPage {
  const rows = (keys ?? []).slice(0, limit);

  return {
    rows,
    hasMore: (keys?.length ?? 0) > limit,
    cursor: cursorFromAscendingPage(rows),
  };
}

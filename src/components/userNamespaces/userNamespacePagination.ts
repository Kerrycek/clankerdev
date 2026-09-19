import { cursorFromAscendingPage } from '../../lib/lockIndex';

export interface UserNamespacePageWindow<T> {
  rows: T[];
  cursor: number | null;
  hasMore: boolean;
}

/**
 * Split an ascending HaveAPI page from its one-row look-ahead sentinel.
 *
 * Both user-namespace indexes use the exclusive `id > from_id` contract. The
 * hidden sentinel must not become visible or influence the next cursor, and a
 * malformed response that cannot advance past the current cursor fails closed.
 */
export function buildUserNamespacePageWindow<T extends { id: number }>(
  data: T[] | undefined,
  limit: number,
  fromId?: number
): UserNamespacePageWindow<T> {
  const source = data ?? [];
  const rows = source.slice(0, limit);
  const candidate = cursorFromAscendingPage(rows);
  const advances = candidate !== null && (fromId === undefined || candidate > fromId);

  return {
    rows,
    cursor: advances ? candidate : null,
    hasMore: source.length > limit && advances,
  };
}

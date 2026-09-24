import { fetchVpsUserDataList, type VpsUserData } from './vpsUserData';

const BATCH_SIZE = 100;
const MAX_SCANNED = 1000;

export class UserDataPageError extends Error {
  constructor(readonly reason: 'scan_limit' | 'invalid_page') {
    super(`Unable to read user-data page: ${reason}`);
    this.name = 'UserDataPageError';
  }
}

/**
 * HaveAPI accepts user/format, not q. Its cursor predicate is id > from_id.
 * Check observed order rather than sorting a broken server page (which could
 * hide skipped rows). Explicit server-side ORDER BY remains required upstream:
 * these checks cannot detect rows omitted by an otherwise ascending response.
 */
export async function fetchVpsUserDataPage(opts: {
  user?: number;
  format?: string;
  q?: string;
  limit: number;
  fromId?: number | null;
  signal?: AbortSignal;
}): Promise<{ data: VpsUserData[]; hasNext: boolean; nextCursor: number | null }> {
  if (!Number.isSafeInteger(opts.limit) || opts.limit < 1 || opts.limit > 200) {
    throw new UserDataPageError('invalid_page');
  }
  const query = (opts.q ?? '').trim().toLowerCase();
  const numeric = /^#?\d+$/.test(query) ? Number(query.replace(/^#/, '')) : null;
  const matches: VpsUserData[] = [];
  let cursor = opts.fromId ?? undefined;
  let scanned = 0;

  while (true) {
    opts.signal?.throwIfAborted();
    // A one-row probe distinguishes exactly 1000 rows from a truncated scan.
    const limit = scanned === MAX_SCANNED ? 1 : Math.min(BATCH_SIZE, MAX_SCANNED - scanned);
    const { data } = await fetchVpsUserDataList({
      user: opts.user, format: opts.format, limit, fromId: cursor, signal: opts.signal,
    });
    opts.signal?.throwIfAborted();
    if (data.length > limit) throw new UserDataPageError('invalid_page');
    let previous = cursor ?? 0;
    for (const row of data) {
      if (!Number.isSafeInteger(row.id) || row.id <= previous) throw new UserDataPageError('invalid_page');
      previous = row.id;
    }
    if (scanned === MAX_SCANNED && data.length) throw new UserDataPageError('scan_limit');

    for (const row of data) {
      if (!query || (numeric !== null ? row.id === numeric : row.label.toLowerCase().includes(query))) {
        matches.push(row);
      }
      if (matches.length > opts.limit) break;
    }
    const hasNext = matches.length > opts.limit;
    if (hasNext || data.length < limit) {
      const visible = matches.slice(0, opts.limit);
      return { data: visible, hasNext, nextCursor: hasNext ? visible.at(-1)!.id : null };
    }
    scanned += data.length;
    cursor = data.at(-1)!.id;
  }
}

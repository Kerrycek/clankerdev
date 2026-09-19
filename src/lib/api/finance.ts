import { fetchUsers, type User } from './users';

/**
 * User#index documents 1,000 rows as its maximum page size. Using that limit
 * keeps the global snapshot bounded while avoiding four network round trips
 * for data that the API can return in one response. A caller can still request
 * a smaller batch (mostly useful for tests), but never a larger one.
 */
export const FINANCE_SCAN_BATCH_SIZE = 1_000;
export const FINANCE_SCAN_MAX_ROWS = 10_000;

export type FinanceScanIncompleteReason = 'scan_limit' | 'cursor_stalled';

export interface FinanceScanResult<T> {
  rows: T[];
  /** Cursor after the last raw row inspected. Pass it to the next call. */
  nextFromId?: number;
  /** True only when the end of the server-side result set was observed. */
  complete: boolean;
  /** Number of raw rows inspected, including rows rejected by local filters. */
  scannedRows: number;
  batches: number;
  /**
   * Set when a safety boundary, rather than a normal UI page boundary, stopped
   * the scan. Consumers must not present totals from such a result as global.
   */
  incompleteReason?: FinanceScanIncompleteReason;
}

export interface FetchFinanceUsersSnapshotOptions {
  /** Maximum number of users returned by this call. */
  scanLimit?: number;
  /** Raw request size, clamped to `FINANCE_SCAN_BATCH_SIZE`. */
  batchSize?: number;
  signal?: AbortSignal;
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), maximum);
}

function normalizeScanLimit(value: number | undefined): number {
  return positiveInteger(value, FINANCE_SCAN_MAX_ROWS, FINANCE_SCAN_MAX_ROWS);
}

function normalizeBatchSize(value: number | undefined): number {
  return positiveInteger(value, FINANCE_SCAN_BATCH_SIZE, FINANCE_SCAN_BATCH_SIZE);
}

function validNextCursor(candidate: number | undefined, previous: number | undefined): number | undefined {
  if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)) return undefined;
  if (previous !== undefined && candidate <= previous) return undefined;
  return candidate;
}

/**
 * Load a bounded multi-request user snapshot for global finance KPIs.
 * The API does not offer an aggregate or transactionally consistent snapshot,
 * so rows can change while the active and suspended keyset scans are running.
 * `complete` must be true before the snapshot is used for global totals.
 */
export async function fetchFinanceUsersSnapshot(
  options: FetchFinanceUsersSnapshotOptions = {},
): Promise<FinanceScanResult<User>> {
  const scanLimit = normalizeScanLimit(options.scanLimit);
  const batchSize = normalizeBatchSize(options.batchSize);
  const seenIds = new Set<number>();
  const seenCursors = new Set<string>();
  const objectStates = ['active', 'suspended'] as const;
  const scans = objectStates.map((objectState) => ({
    objectState,
    cursor: undefined as number | undefined,
    complete: false,
    rows: [] as User[],
  }));
  let scannedRows = 0;
  let batches = 0;

  const snapshotRows = () => scans.flatMap((scan) => scan.rows);

  while (scannedRows < scanLimit) {
    const remainingRows = scanLimit - scannedRows;
    const pendingScans = scans.filter((scan) => !scan.complete);
    if (pendingScans.length === 0) {
      return { rows: snapshotRows(), complete: true, scannedRows, batches };
    }

    // Reserve at least one row of the shared safety budget for every state in
    // this round. The sum of concurrent request limits can therefore never
    // exceed the remaining global scan allowance.
    const roundScans = pendingScans.slice(0, remainingRows);
    let allocatableRows = remainingRows;
    const requests = roundScans.map((scan, index) => {
      const reservedForLaterScans = roundScans.length - index - 1;
      const requestLimit = Math.min(batchSize, allocatableRows - reservedForLaterScans);
      allocatableRows -= requestLimit;
      return {
        scan,
        requestLimit,
        result: fetchUsers({
          limit: requestLimit,
          fromId: scan.cursor,
          objectState: scan.objectState,
          signal: options.signal,
        }),
      };
    });

    const results = await Promise.all(requests.map(async (request) => ({
      ...request,
      result: await request.result,
    })));
    batches += results.length;

    for (const { scan, requestLimit, result } of results) {
      if (scannedRows >= scanLimit) break;

      let lastInspectedId: number | undefined;
      for (const user of result.data) {
        if (scannedRows >= scanLimit) break;
        scannedRows += 1;
        if (Number.isSafeInteger(user.id)) lastInspectedId = user.id;
        if (seenIds.has(user.id)) continue;
        seenIds.add(user.id);
        scan.rows.push(user);
      }

      if (result.data.length < requestLimit) {
        scan.complete = true;
        continue;
      }

      const nextCursor = validNextCursor(lastInspectedId, scan.cursor);
      const cursorKey = `${scan.objectState}:${nextCursor}`;
      if (nextCursor === undefined || seenCursors.has(cursorKey)) {
        return {
          rows: snapshotRows(),
          complete: false,
          scannedRows,
          batches,
          incompleteReason: 'cursor_stalled',
        };
      }

      seenCursors.add(cursorKey);
      scan.cursor = nextCursor;
    }
  }

  return {
    rows: snapshotRows(),
    nextFromId: scans.find((scan) => !scan.complete)?.cursor,
    complete: false,
    scannedRows,
    batches,
    incompleteReason: 'scan_limit',
  };
}

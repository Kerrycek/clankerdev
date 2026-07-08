import { getMetaTotalCount } from "../../lib/api/haveapi";

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_MAX_PAGES = 20;

export interface DashboardCountRow {
  id?: unknown;
}

export interface DashboardCountPage<T extends DashboardCountRow> {
  data: T[];
  meta?: unknown;
}

interface DashboardCountOptions {
  pageSize?: number;
  maxPages?: number;
  allowFallbackPagination?: boolean;
}

function getNumericId(row: DashboardCountRow | undefined): number | undefined {
  const raw = row?.id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function countDashboardRows<T extends DashboardCountRow>(
  fetchPage: (opts: { limit: number; fromId?: number }) => Promise<DashboardCountPage<T>>,
  opts: DashboardCountOptions = {},
): Promise<number> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const allowFallbackPagination = opts.allowFallbackPagination ?? true;
  let fromId: number | undefined;
  let count = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await fetchPage({ limit: pageSize, fromId });
    const totalCount = getMetaTotalCount(res.meta);
    if (totalCount !== undefined) return totalCount;

    count += res.data.length;
    if (!allowFallbackPagination) return count;
    if (res.data.length < pageSize) return count;

    const nextFromId = getNumericId(res.data[res.data.length - 1]);
    if (nextFromId === undefined || nextFromId === fromId) return count;
    fromId = nextFromId;
  }

  return count;
}

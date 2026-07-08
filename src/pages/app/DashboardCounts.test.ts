import { describe, expect, test, vi } from "vitest";

import { countDashboardRows } from "./DashboardCounts";

describe("countDashboardRows", () => {
  test("uses HaveAPI total_count metadata when it is present", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: 99 }],
      meta: { total_count: 17 },
    }));

    await expect(countDashboardRows(fetchPage, { pageSize: 1 })).resolves.toBe(17);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 1, fromId: undefined });
  });

  test("falls back to row count when metadata is missing", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: 3 }, { id: 2 }, { id: 1 }],
    }));

    await expect(countDashboardRows(fetchPage, { pageSize: 10 })).resolves.toBe(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test("paginates by the last row id when a page is full", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 5 }, { id: 4 }] })
      .mockResolvedValueOnce({ data: [{ id: 3 }, { id: 2 }] })
      .mockResolvedValueOnce({ data: [{ id: 1 }] });

    await expect(countDashboardRows(fetchPage, { pageSize: 2 })).resolves.toBe(5);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { limit: 2, fromId: undefined });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { limit: 2, fromId: 4 });
    expect(fetchPage).toHaveBeenNthCalledWith(3, { limit: 2, fromId: 2 });
  });

  test("stops at the maximum page guard", async () => {
    const fetchPage = vi.fn(async ({ fromId }) => ({
      data: [{ id: typeof fromId === "number" ? fromId - 1 : 10 }],
    }));

    await expect(countDashboardRows(fetchPage, { pageSize: 1, maxPages: 3 })).resolves.toBe(3);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  test("can avoid fallback pagination when metadata is missing", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: 20 }, { id: 19 }],
    }));

    await expect(countDashboardRows(fetchPage, { pageSize: 2, allowFallbackPagination: false })).resolves.toBe(2);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

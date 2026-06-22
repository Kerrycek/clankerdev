import { expect, test } from "@playwright/test";

import { bootstrapVpsAdminWindow, installHaveApiMock } from "../../fixtures";

test.describe("Dataset downloads keyset pagination", () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    const dataset = {
      id: 10,
      full_name: "tank/vps/ds10",
      name: "ds10",
      used: 2048,
      refquota: 10240,
      snapshots_count: 123,
      mount_count: 0,
      export_count: 0,
      object_state: "active",
      vps: { id: 300, hostname: "alpha.example" },
    };

    const makeDl = (id: number) => ({
      id,
      dataset: 10,
      snapshot: {
        id: id + 1000,
        name: `snap-${id + 1000}`,
        label: `Snapshot ${id + 1000}`,
      },
      format: id % 2 === 0 ? "archive" : "incremental_stream",
      size: 1024 * 1024,
      sha256: "00".repeat(32),
      url: `/download/${id}`,
      ready: true,
      expiration_date: "2026-12-27T00:00:00.000Z",
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeDl);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeDl);

    await installHaveApiMock(page, {
      user: { id: 1, login: "test", level: 1 },
      handlers: {
        "GET datasets/10": () => dataset,
        "GET snapshot_downloads": ({ searchParams }) => {
          const fromId = searchParams.get("snapshot_download[from_id]");
          const ds = searchParams.get("snapshot_download[dataset]");
          const q = (searchParams.get("snapshot_download[q]") || "").trim();
          if (ds !== "10")
            return { snapshot_downloads: [], _meta: { total_count: 0 } };
          if (q) {
            return {
              snapshot_downloads: page1.filter(
                (dl) => String(dl.id) === q || String(dl.file_name).includes(q),
              ),
              _meta: { total_count: 1 },
            };
          }
          return {
            snapshot_downloads: fromId ? page2 : page1,
            _meta: { total_count: 100 },
          };
        },
      },
    });
  });

  test("next/prev updates URL and rows", async ({ page }) => {
    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.list")).toBeVisible();
    await expect(page.getByTestId("dataset.downloads.row.300")).toBeVisible();

    await page.getByTestId("dataset.downloads.pagination.desktop.next").click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("dataset.downloads.row.250")).toBeVisible();

    await page.getByTestId("dataset.downloads.pagination.desktop.prev").click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId("dataset.downloads.row.300")).toBeVisible();
  });

  test("search uses server-side q and persists in URL", async ({ page }) => {
    await page.goto("/app/datasets/10/downloads");

    await page.getByTestId("dataset.downloads.search.input").fill("300");
    await expect(page).toHaveURL(/q=300/);
    await expect(page.getByTestId("dataset.downloads.row.300")).toBeVisible();
  });
});

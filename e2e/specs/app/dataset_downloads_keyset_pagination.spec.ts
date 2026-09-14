import { expect, test } from "@playwright/test";

import { bootstrapVpsAdminWindow, installHaveApiMock } from "../../fixtures";

test.describe("@pr-smoke @pr-smoke-mobile Dataset downloads keyset pagination", () => {
  let requestedDownloadParams: URLSearchParams[];

  test.beforeEach(async ({ page }) => {
    requestedDownloadParams = [];
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
      expiration_date: "2099-12-27T00:00:00.000Z",
    });

    const allDownloads = Array.from({ length: 100 }, (_, i) => i + 1).map(makeDl);

    await installHaveApiMock(page, {
      user: { id: 1, login: "test", level: 1 },
      handlers: {
        "GET datasets/10": () => dataset,
        "GET snapshot_downloads": ({ searchParams }) => {
          requestedDownloadParams.push(new URLSearchParams(searchParams));
          const ds = searchParams.get("snapshot_download[dataset]");
          if (ds !== "10")
            return { snapshot_downloads: [], _meta: { total_count: 0 } };
          const fromId = Number(searchParams.get("snapshot_download[from_id]") ?? 0);
          const limit = Number(searchParams.get("snapshot_download[limit]") ?? 50);
          return {
            snapshot_downloads: allDownloads
              .filter((download) => download.id > fromId)
              .slice(0, limit),
            _meta: { total_count: allDownloads.length },
          };
        },
      },
    });
  });

  test("next/prev updates URL and rows", async ({ page }) => {
    const mobile = (page.viewportSize()?.width ?? 1024) < 768;
    const item = (id: number) =>
      page.getByTestId(`dataset.downloads.${mobile ? "card" : "row"}.${id}`);
    const paginationKind = mobile ? "mobile" : "desktop";
    const pagination = page.getByTestId(`dataset.downloads.pagination.${paginationKind}`);

    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.list")).toBeVisible();
    await expect(item(1)).toBeVisible();
    expect(requestedDownloadParams.at(-1)?.get("snapshot_download[limit]")).toBe("51");

    await pagination
      .getByTestId(`dataset.downloads.pagination.${paginationKind}.next`)
      .click();
    await expect(page).toHaveURL(/from_id=50/);
    await expect(page).toHaveURL(/page=2/);
    await expect(item(51)).toBeVisible();
    expect(requestedDownloadParams.at(-1)?.get("snapshot_download[limit]")).toBe("51");
    await expect(item(1)).toHaveCount(0);
    await expect(
      pagination.getByTestId(`dataset.downloads.pagination.${paginationKind}.next`),
    ).toBeDisabled();

    await pagination
      .getByTestId(`dataset.downloads.pagination.${paginationKind}.prev`)
      .click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(item(1)).toBeVisible();
  });

  test("does not offer or send the unsupported q filter", async ({ page }) => {
    const mobile = (page.viewportSize()?.width ?? 1024) < 768;
    await page.goto("/app/datasets/10/downloads?q=legacy-search");

    await expect(
      page.getByTestId(`dataset.downloads.${mobile ? "card" : "row"}.1`),
    ).toBeVisible();
    await expect(page.getByTestId("dataset.downloads.search.input")).toHaveCount(0);
    expect(requestedDownloadParams.length).toBeGreaterThan(0);
    expect(requestedDownloadParams.every((params) => !params.has("snapshot_download[q]"))).toBe(true);
    expect(
      requestedDownloadParams.every((params) => params.get("_meta[count]") === "true"),
    ).toBe(true);
  });
});

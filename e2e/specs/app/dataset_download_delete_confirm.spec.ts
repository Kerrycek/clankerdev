import { expect, test } from "@playwright/test";

import { bootstrapVpsAdminWindow, installHaveApiMock } from "../../fixtures";

test.describe("@smoke Dataset downloads", () => {
  test("create backup deep link opens the create workflow and loads snapshots", async ({
    page,
  }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: "admin", level: 99 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 1,
          mount_count: 0,
          export_count: 0,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),

        "GET snapshot_downloads": () => ({ snapshot_downloads: [] }),

        "GET datasets/10/snapshots": () => ({
          snapshots: [
            {
              id: 200,
              dataset: 10,
              name: "snap-200",
              label: "snap-200",
              created_at: "2026-01-26T00:00:00.000Z",
            },
          ],
        }),
      },
    });

    await page.goto("/app/datasets/10/downloads?action=create");

    await expect(page.getByTestId("dataset.downloads.list")).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.create.modal"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.create.snapshot"),
    ).toContainText("snap-200");
    await expect(page).toHaveURL(/\/app\/datasets\/10\/downloads$/);
  });

  test("creates download, tracks action state, and shows details from the API", async ({
    page,
  }) => {
    let created = false;

    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: "admin", level: 99 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 2,
          mount_count: 0,
          export_count: 0,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),
        "GET transaction_chains": () => ({ transaction_chains: [] }),
        "GET datasets/10/snapshots": () => ({
          snapshots: [
            {
              id: 200,
              dataset: 10,
              name: "snap-200",
              label: "base",
              created_at: "2026-01-25T00:00:00.000Z",
            },
            {
              id: 201,
              dataset: 10,
              name: "snap-201",
              label: "target",
              created_at: "2026-01-26T00:00:00.000Z",
            },
          ],
        }),
        "GET snapshot_downloads": () => ({
          snapshot_downloads: created
            ? [
                {
                  id: 501,
                  dataset: 10,
                  snapshot: { id: 201, label: "target" },
                  from_snapshot: { id: 200, label: "base" },
                  format: "incremental_stream",
                  ready: true,
                  url: "https://example.test/incremental.zfs",
                  file_name: "incremental.zfs",
                  size: 128,
                  sha256sum: "b".repeat(64),
                  expires_at: "2026-12-10T00:00:00.000Z",
                },
              ]
            : [],
        }),
        "POST snapshot_downloads": () => {
          created = true;
          return {
            snapshot_download: { id: 501 },
            _meta: { action_state_id: 702 },
          };
        },
        "GET action_states/702": () => ({
          action_state: {
            id: 702,
            label: "Create snapshot download",
            status: true,
            finished: false,
            current: 1,
            total: 3,
          },
        }),
      },
    });

    await page.goto("/app/datasets/10/downloads?action=create");

    await page
      .getByTestId("dataset.downloads.create.snapshot")
      .selectOption("201");
    await page
      .getByTestId("dataset.downloads.create.format")
      .selectOption("incremental_stream");
    await page
      .getByTestId("dataset.downloads.create.from_snapshot")
      .selectOption("200");
    await page.getByTestId("dataset.downloads.create.send_mail").uncheck();

    const reqPromise = page.waitForRequest(
      (r) =>
        r.method() === "POST" &&
        r.url().includes("/api/v7.0/snapshot_downloads"),
    );
    await page.getByTestId("dataset.downloads.create.submit").click();

    expect((await reqPromise).postDataJSON()).toEqual({
      snapshot_download: {
        snapshot: 201,
        from_snapshot: 200,
        format: "incremental_stream",
        send_mail: false,
      },
    });
    await expect(page.getByTestId("modal.action_progress")).toBeVisible();
    await expect(page.getByTestId("modal.action_progress")).toContainText(
      "#702",
    );
    await page.getByTestId("modal.action_progress.continue").click();
    await expect(page.getByTestId("dataset.downloads.row.501")).toContainText(
      "From base",
    );
    await expect(page.getByTestId("dataset.downloads.row.501")).toContainText(
      "2026",
    );
  });

  test("shows reliable ready, pending, expired and failed download states", async ({
    page,
  }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: "admin", level: 99 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 4,
          mount_count: 0,
          export_count: 0,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),

        "GET snapshot_downloads": () => ({
          snapshot_downloads: [
            {
              id: 601,
              dataset: 10,
              snapshot: { id: 200, label: "snap-ready-url" },
              format: "archive",
              download_url: "/generated/601.tar.gz",
              file_name: "generated-601.tar.gz",
              size: 128,
              expires_at: "2099-02-10T00:00:00.000Z",
            },
            {
              id: 602,
              dataset: 10,
              snapshot: { id: 201, label: "snap-pending" },
              format: "stream",
              ready: false,
              file_name: "pending-602.zfs",
              expires_at: "2099-02-10T00:00:00.000Z",
            },
            {
              id: 603,
              dataset: 10,
              snapshot: { id: 202, label: "snap-expired" },
              format: "archive",
              ready: true,
              url: "https://example.test/expired-603.tar.gz",
              file_name: "expired-603.tar.gz",
              expires_at: "2000-01-01T00:00:00.000Z",
            },
            {
              id: 604,
              dataset: 10,
              snapshot: { id: 203, label: "snap-failed" },
              format: "archive",
              state: "failed",
              error_message: "zfs send failed",
              file_name: "failed-604.tar.gz",
            },
            {
              id: 605,
              dataset: 10,
              snapshot: { id: 204, label: "snap-legacy" },
              format: "archive",
              ready: true,
              file_name: "legacy-605.tar.gz",
              expires_at: "2099-02-10T00:00:00.000Z",
            },
          ],
        }),
      },
    });

    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.row.601")).toContainText(
      "Ready",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.601.download"),
    ).toHaveAttribute("href", /generated\/601\.tar\.gz/);
    await expect(
      page.getByTestId("dataset.downloads.row.601.copy_link"),
    ).toBeVisible();

    await expect(page.getByTestId("dataset.downloads.row.602")).toContainText(
      "Pending",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.602.download"),
    ).toBeDisabled();
    await expect(
      page.getByTestId("dataset.downloads.row.602.copy_link"),
    ).toHaveCount(0);

    await expect(page.getByTestId("dataset.downloads.row.603")).toContainText(
      "Expired",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.603.download"),
    ).toBeDisabled();
    await expect(
      page.getByTestId("dataset.downloads.row.603.retry"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.row.603.copy_link"),
    ).toHaveCount(0);

    await expect(page.getByTestId("dataset.downloads.row.604")).toContainText(
      "Failed",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.604.status_detail"),
    ).toContainText("zfs send failed");
    await expect(
      page.getByTestId("dataset.downloads.row.604.retry"),
    ).toBeVisible();

    await expect(page.getByTestId("dataset.downloads.row.605")).toContainText(
      "Ready",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.605.download"),
    ).toHaveAttribute("href", /page=backup&action=download_link&id=605/);
  });

  test("delete download uses a confirm dialog and removes the row", async ({
    page,
  }) => {
    let deleted = false;
    let deleteCalls = 0;

    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: "admin", level: 99 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 1,
          mount_count: 0,
          export_count: 0,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),

        "GET snapshot_downloads": () => {
          if (deleted) {
            return { snapshot_downloads: [] };
          }
          return {
            snapshot_downloads: [
              {
                id: 501,
                dataset: 10,
                snapshot: { id: 200, label: "snap-200" },
                format: "archive",
                ready: true,
                url: "https://example.test/dl.tar.gz",
                file_name: "dl.tar.gz",
                size: 128,
                sha256: "a".repeat(64),
                expires_at: "2026-12-10T00:00:00.000Z",
              },
            ],
          };
        },

        "DELETE snapshot_downloads/501": () => {
          deleteCalls += 1;
          deleted = true;
          return { ok: true };
        },
      },
    });

    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.list")).toBeVisible();
    await expect(page.getByTestId("dataset.downloads.row.501")).toBeVisible();

    await page.getByTestId("dataset.downloads.row.501.delete").click();
    await expect(
      page.getByTestId("dataset.downloads.delete_confirm"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.delete_confirm.confirm"),
    ).toBeEnabled();

    await page.getByTestId("dataset.downloads.delete_confirm.confirm").click();
    await expect(
      page.getByTestId("dataset.downloads.delete_confirm"),
    ).toBeHidden();

    await expect(page.getByTestId("dataset.downloads.row.501")).toHaveCount(0);
    expect(deleteCalls).toBe(1);
  });

  test("normal users can download ready backups but cannot delete download records", async ({
    page,
  }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 2, login: "member", level: 1 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 1,
          mount_count: 0,
          export_count: 1,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),

        "GET snapshot_downloads": () => ({
          snapshot_downloads: [
            {
              id: 501,
              dataset: 10,
              snapshot: { id: 200, label: "snap-200" },
              format: "archive",
              ready: true,
              url: "https://example.test/dl.tar.gz",
              file_name: "dl.tar.gz",
              size: 128,
              sha256: "a".repeat(64),
              expires_at: "2026-12-10T00:00:00.000Z",
            },
          ],
        }),
      },
    });

    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.row.501")).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.row.501.download"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.row.501.download"),
    ).toHaveAttribute("href", "https://example.test/dl.tar.gz");
    await expect(
      page.getByTestId("dataset.downloads.row.501.delete"),
    ).toHaveCount(0);
  });
  test("shows pending, expired and failed download artifacts without exposing stale links", async ({
    page,
  }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: "TEST",
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: "admin", level: 99 },
      handlers: {
        "GET datasets/10": () => ({
          id: 10,
          full_name: "tank/vps/ds10",
          name: "ds10",
          used: 2048,
          refquota: 10240,
          snapshots_count: 2,
          mount_count: 0,
          export_count: 0,
          object_state: "active",
          vps: { id: 300, hostname: "alpha.example" },
        }),
        "GET datasets/10/snapshots": () => ({
          snapshots: [
            {
              id: 200,
              dataset: 10,
              name: "snap-200",
              label: "snap-200",
              created_at: "2026-01-26T00:00:00.000Z",
            },
            {
              id: 201,
              dataset: 10,
              name: "snap-201",
              label: "snap-201",
              created_at: "2099-01-27T00:00:00.000Z",
            },
          ],
        }),
        "GET snapshot_downloads": () => ({
          snapshot_downloads: [
            {
              id: 601,
              dataset: 10,
              snapshot: { id: 200, label: "snap-200" },
              format: "archive",
              ready: false,
              url: "https://example.test/pending.tar.gz",
              file_name: "pending.tar.gz",
              expires_at: "2026-12-01T00:00:00.000Z",
            },
            {
              id: 602,
              dataset: 10,
              snapshot: { id: 200, label: "snap-200" },
              format: "archive",
              ready: true,
              url: "https://example.test/expired.tar.gz",
              file_name: "expired.tar.gz",
              expires_at: "2026-01-01T00:00:00.000Z",
            },
            {
              id: 603,
              dataset: 10,
              snapshot: { id: 201, label: "snap-201" },
              from_snapshot: { id: 200, label: "snap-200" },
              format: "incremental_stream",
              state: "failed",
              error_message: "zfs send failed",
              file_name: "failed.zfs",
            },
          ],
        }),
      },
    });

    await page.goto("/app/datasets/10/downloads");

    await expect(page.getByTestId("dataset.downloads.row.601")).toContainText(
      "Pending",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.601.status_detail"),
    ).toContainText("Preparation is still running");
    await expect(
      page.getByTestId("dataset.downloads.row.601.download"),
    ).toBeDisabled();
    await expect(
      page.getByTestId("dataset.downloads.row.601.copy_link"),
    ).toHaveCount(0);

    await expect(page.getByTestId("dataset.downloads.row.602")).toContainText(
      "Expired",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.602.download"),
    ).toBeDisabled();
    await expect(
      page.getByTestId("dataset.downloads.row.602.copy_link"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("dataset.downloads.row.602.retry"),
    ).toBeVisible();

    await expect(page.getByTestId("dataset.downloads.row.603")).toContainText(
      "Failed",
    );
    await expect(
      page.getByTestId("dataset.downloads.row.603.status_detail"),
    ).toContainText("zfs send failed");
    await expect(
      page.getByTestId("dataset.downloads.row.603.download"),
    ).toBeDisabled();
    await expect(
      page.getByTestId("dataset.downloads.row.603.copy_link"),
    ).toHaveCount(0);

    await page.getByTestId("dataset.downloads.row.603.retry").click();
    await expect(
      page.getByTestId("dataset.downloads.create.modal"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dataset.downloads.create.snapshot"),
    ).toHaveValue("201");
    await expect(
      page.getByTestId("dataset.downloads.create.format"),
    ).toHaveValue("incremental_stream");
    await expect(
      page.getByTestId("dataset.downloads.create.from_snapshot"),
    ).toHaveValue("200");
  });
});

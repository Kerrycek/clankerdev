# dev.crucio.cz live parity workflow

This checklist is for human-run verification of real VPS and dataset workflows
on `dev.crucio.cz`. It is intentionally manual and opt-in: do not run
destructive operations from CI or the AI issue runner.

## Safety rules

- Use only the development/test deployment at `https://dev.crucio.cz`.
- Do not use production objects, secrets, fixed database IDs, or production API
  endpoints.
- Keep object names obvious. Suggested prefixes:
  - VPS: `webui-next-live-test-*`, `webui-next-playground-*`, or
    `webui-next-staging-*`
  - dataset/snapshot/download labels: `webui-next-live-test-*`
- Before deleting, reinstalling, rolling back, or swapping, confirm the object
  owner, hostname/full dataset name, node/location, expiration, and IP
  assignments in the UI.
- Record returned action-state IDs and final backend/UI state in the PR notes.

## Identify safe objects

1. Create or select a disposable source VPS owned by the tester or a dedicated
   dev test user. It should have no production traffic, no irreplaceable data,
   and a hostname that clearly starts with `webui-next-live-test-`.
2. Create or select a second disposable VPS for swap testing. Its hostname
   should include `playground`, `staging`, `test`, or `dev` so the UI can mark
   it as a likely swap target.
3. Create or select a disposable dataset under the source VPS or another dev
   storage area. Prefer a full name ending in `webui-next-live-test-*`.
4. Create a small test file inside the dataset/VPS if rollback or backup
   verification needs visible state. Do not use private or production data.
5. Store object IDs only in local notes or environment variables for the test
   run; do not commit them.

## Optional non-destructive Playwright readiness check

The live readiness spec opens the real workflows and verifies that labels,
previews, and confirmation gates are present. It does not submit clone, swap,
delete, reinstall, rollback, or download actions.

Example:

```sh
E2E_BASE_URL=https://dev.crucio.cz \
E2E_IGNORE_HTTPS_ERRORS=1 \
E2E_STORAGE_STATE=/path/to/local-dev-auth-state.json \
E2E_LIVE_PARITY=1 \
E2E_LIVE_VPS_ID=... \
E2E_LIVE_SWAP_TARGET_VPS_ID=... \
E2E_LIVE_DATASET_ID=... \
npm run e2e:live:manual
```

Use a local Playwright storage state file or another locally approved auth
setup. Do not commit that file.

## VPS workflows

### Clone

1. Open `/admin/vps/<source-id>/lifecycle`.
2. In `Clone VPS`, confirm the source hostname and owner.
3. For admin mode, select the dev test owner and a suitable dev node. For user
   mode, select a dev location.
4. Set hostname to `webui-next-live-test-clone-<date>`.
5. Keep subdatasets, dataset plans, resources, and features enabled unless the
   specific scenario needs otherwise.
6. Submit only after confirming this is a disposable source.
7. Verify the action-state progress appears, the returned VPS opens, hostname
   and owner are correct, and cloned datasets/resources match expectations.

### Swap with staging/playground VPS

1. Open the source VPS lifecycle page and click `Open swap flow`.
2. Prefer a UI-suggested target whose hostname includes `playground`,
   `staging`, `test`, or `dev`.
3. If needed, enter the target as `#<target-id>`.
4. Review the swap preview table, especially hostname, resources, expiration,
   node/location, owner, and IP assignment direction.
5. In admin mode, decide whether hostname, resources, and expirations should be
   swapped.
6. Submit only when both VPS are disposable.
7. Verify the action-state ID, both VPS detail pages, IP assignments, resource
   values, and expiration dates after completion.

### Delete / lazy delete

1. Open the disposable VPS lifecycle page.
2. Confirm the hostname, owner, and lack of production traffic.
3. Keep `Lazy delete` enabled for the standard dev verification unless a human
   explicitly asks for hard delete testing.
4. Submit the delete action.
5. Verify the action-state ID and resulting object state or list removal.

### Rescue boot / reinstall / template metadata

1. Use only a disposable VPS with known-good backups or throwaway data.
2. For rescue boot, select the intended OS template and decide whether the
   original root dataset should be mounted.
3. Verify the warning copy and submit only when the temporary rescue behavior is
   expected.
4. For reinstall, select the OS template and confirm that root filesystem data
   may be replaced.
5. For template metadata, update only harmless template metadata fields and
   verify the saved values after refresh.
6. Record action-state IDs and final VPS boot/template state.

### Lifetime / expiration update

1. Open the VPS lifecycle page.
2. In the lifetime panel, note the current expiration/reminder values.
3. Change expiration to a short dev-only value, then save.
4. Verify the action-state ID and refreshed expiration display.
5. Restore the previous value if the object will remain available for further
   testing.

## Dataset workflows

### Create / edit / delete

1. Open `/admin/datasets/<parent-id>`.
2. Create a child dataset named `webui-next-live-test-<date>`.
3. Use small quotas/refquotas and default-safe storage properties unless the
   scenario requires a specific property.
4. Verify navigation to the returned dataset and refreshed full name.
5. Edit a harmless property such as quota/refquota, compression, or sync.
6. Delete only the disposable child dataset. Type the exact full dataset name in
   the confirmation dialog.
7. Verify the action-state/backend result and that the deleted dataset no
   longer appears.

### Snapshot create / delete / rollback

1. Open `/admin/datasets/<dataset-id>/snapshots`.
2. Create a snapshot labeled `webui-next-live-test-before-change`.
3. Verify the action-state ID and that the snapshot appears in the list.
4. For rollback, first make a small reversible test change in the disposable
   dataset.
5. Type the exact snapshot label/name in the rollback confirmation dialog.
6. Verify the rollback action-state ID and resulting dataset contents.
7. Delete only test snapshots, using the exact label/name confirmation.

### Backup/download create and delete

1. Open `/admin/datasets/<dataset-id>/downloads`.
2. Create a download from a test snapshot. Use archive for the simplest check,
   or incremental stream only when both base and target snapshots are
   disposable and understood.
3. Verify the action-state ID, ready/pending state, file name, size, checksum,
   expiration, and download URL when available.
4. If downloading the file, keep it local and do not commit it.
5. Delete the test download record by typing the exact required confirmation
   value.
6. Verify the record is removed or no longer listed.

## PR verification notes

For the pull request, include:

- Object naming pattern used, not fixed IDs.
- Which VPS workflows were exercised.
- Which dataset, snapshot, and download workflows were exercised.
- Action-state IDs and final state observations.
- Anything skipped because it was unsafe or unavailable on dev.

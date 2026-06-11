# dev.crucio.cz storage/NAS lab node

Issue: https://github.com/Kerrycek/clankerdev/issues/121

Use this checklist to create a dev-only nested vpsAdminOS storage node for
backup, dataset, mount, restore and storage UI smoke tests. Do not run this
against upstream or production.

The repeatable helper is:

```sh
deploy/dev.crucio.cz/bootstrap-storage-lab-node.sh
```

It defaults to a dry run and refuses non-dev hosts unless
`ALLOW_NON_DEV_HOST=1` is set. After reviewing the generated Nix config,
systemd unit, RabbitMQ setup and SQL seed, rerun with:

```sh
deploy/dev.crucio.cz/bootstrap-storage-lab-node.sh --apply
```

## Default lab objects

- systemd service: `vpsadmin-nas-storage1.service`
- vpsAdmin node: `104`, `vpsadmin-nas-storage1`, role `storage`
- dev-lab address: `10.0.0.5`
- location domain: `nas-lab`
- tap device: `tap-nas`
- RabbitMQ user: `vpsadmin-nas-storage1.nas-lab`
- backup pool: `104`, `tank/backup`, role `backup`
- generated files under `/root/vpsadmin-dev-lab/`

The script follows the existing nested hypervisor pattern: a vpsAdminOS QEMU
configuration imports `pool-tank.nix` and the vpsAdmin test node module, creates
the VM launcher with `nix build --impure ...#qemu-script`, installs a matching
systemd unit and uses `ensure-tap.sh` for host-only networking.

DB records are seeded only after systemd reports the VM service as active. The
VM is then restarted so nodectld can load the newly registered storage role and
publish node/pool status to supervisor.

## Verification

Run these commands on `admin.crucio.cz` after `--apply`:

```sh
systemctl status vpsadmin-nas-storage1.service --no-pager

ssh root@10.0.0.5 '
  svctl status nodectld || systemctl status nodectld --no-pager
  zpool status tank
  zfs list tank/backup tank/backup/webui-next-smoke tank/backup/webui-next-restore tank/backup/webui-next-datasets
'

rabbitmqctl list_queues -p vpsadmin_test name messages consumers \
  | grep 'node:vpsadmin-nas-storage1.nas-lab'

mysql vpsadmin -e "
  SELECT id,name,role,ip_addr,active FROM nodes WHERE id = 104;
  SELECT node_id,created_at,updated_at,pool_state,pool_scan,pool_checked_at
    FROM node_current_statuses WHERE node_id = 104;
  SELECT id,node_id,label,filesystem,role,state,scan,checked_at,total_space,available_space
    FROM pools WHERE id = 104;
"
```

Expected result:

- `vpsadmin-nas-storage1.service` is active.
- `nodectld` is running inside the VM.
- `tank` is online and `tank/backup` plus the smoke child datasets exist.
- RabbitMQ contains supervisor-created queues for
  `node:vpsadmin-nas-storage1.nas-lab:*`.
- `nodes`, `node_current_statuses` and `pools` show fresh timestamps and live
  pool space metrics. `pool_state` and pool `state` should resolve to the API's
  `online` enum after supervisor ingests status messages.

## UI smoke path

After status is fresh, sign in to `https://dev.crucio.cz` with a test admin and
check:

- `/admin/nodes/104`: node overview shows current status and storage summary.
- `/admin/pools`: `dev NAS backup pool` is listed with capacity/free-space
  metrics.
- `/admin/datasets`: storage-backed dataset rows load without empty-state-only
  behavior.
- Disposable dataset detail: snapshots, downloads, plans, exports and mount
  tabs can be opened. Submit only throwaway actions with obvious
  `webui-next-live-test-*` names.

## Known constraints

This repository change does not deploy or mutate `admin.crucio.cz`. A human
reviewer must run the helper on the dev host. If backup or restore transactions
still fail after the node and pool report fresh status, capture the exact
transaction chain error and nodectld log line; that would be a vpsAdmin workflow
blocker rather than WebUI seed data.

The helper intentionally avoids blind dataset topology SQL. It creates real ZFS
datasets under `tank/backup`, and vpsAdmin can create or attach disposable DB
dataset rows through normal workflows after the pool is live. Current nodectld
storage-property status code fetches dataset properties only for `primary` and
`hypervisor` pool roles; the backup-role pool still reports live capacity
through `pool_statuses`, but per-dataset property metrics on backup-only rows
may need an upstream nodectld/API change if they are required for a specific
backup UI workflow.

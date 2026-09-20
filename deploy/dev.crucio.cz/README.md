# dev.crucio.cz deployment

`dev.crucio.cz` serves the static web UI from:

```sh
/var/www/dev.crucio.cz/current
```

`dev.crucio.cz` is hosted on the same private test machine as
`admin.crucio.cz` (`172.16.106.176`). Its nginx vhost mirrors the
`clankerdev.vpsfree.cz` layout: static assets are served by nginx, while
`/config.js`, `/session.json`, `/oauth/*`, and `/healthz` are served by the WebUI Next BFF on
`127.0.0.1:3001`.

Unlike the original production deployment, `dev.crucio.cz` keeps API and OAuth
traffic on the test stack. nginx proxies `/v7.0`, `/_auth`, and the
`/oauth2/password-reset` recovery flow directly to the same local API process
used by `admin.crucio.cz`, on `127.0.0.1:9292`.

Deploy the source checkout to `dev.crucio.cz` with:

```sh
deploy-dev
```

`deploy-dev` updates the mutable input checkout at
`/srv/clankerdev-deploy/repo`, then runs the versioned helper from that same
checkout. The helper serializes deployments with the root-owned nonblocking
lock `/run/lock/clankerdev-dev-deploy.lock`. A second invocation exits before
staging or publication.

The mutable checkout must have no tracked changes. Untracked operational audit
artifacts are allowed because they are never used as build input. For every new
commit, the helper makes a fresh local clone on the release filesystem, checks
out the exact full SHA, and builds both the SPA and BFF dependencies there. A
fully verified stage is atomically renamed to:

```sh
/srv/clankerdev-release/releases/<full-commit-sha>
```

The frontend is published from that release, and the BFF unit resolves through
the atomically replaced `/srv/clankerdev-release/current` symlink. Nothing runs
`npm ci` in the active release or mutable source checkout. Releases are not
deleted by this helper. Before any active-state change, the helper also runs a
read/traverse/dependency-resolution check as the real `webui-bff` identity via
`/usr/bin/setpriv`; a new stage is published with a traversable `0755` top-level
directory and an unreadable reused release is rejected.

Before activation, the provenance gate requires the input checkout, frontend
`build-info.json`, and staged release to have the expected SHA. The input must
be tracked-clean (its nonignored untracked count is reported separately), while
the fresh release must have neither tracked nor nonignored untracked drift and
the build metadata must say `dirty: false`. After the BFF restart, the gate also
verifies the configured systemd checkout and the active process CWD and SHA.
The helper then runs the public authentication smoke check.

Before publication, the helper privately snapshots the current webroot, nginx
configuration, BFF unit, and release-link metadata. Any later validation,
reload, restart, provenance, or health-check failure enters one explicit
rollback path. Rollback restores the prior current link, unit, webroot, and
nginx configuration before restarting the prior BFF and validating health. It
returns the original failure status. If every rollback step succeeds, the
private backup is removed; otherwise its path is printed and retained for
manual recovery.

Deploy the nginx configuration manually when needed with:

```sh
rsync -az deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf \
  root@admin.crucio.cz:/etc/nginx/sites-available/dev.crucio.cz
```

The BFF unit is installed automatically by every `deploy-dev` run. Its
`WorkingDirectory` and `ExecStart` use
`/srv/clankerdev-release/current/bff`, so frontend and BFF activation share one
release boundary.

When introducing this release layout on a host that still has the previous
installed wrapper, bootstrap the wrapper once after the reviewed commit has
been pulled:

```sh
install -m 0755 deploy/dev.crucio.cz/deploy-dev.sh /usr/local/bin/deploy-dev
deploy-dev
```

The first run creates `releases/<sha>` and `current`. It deliberately keeps the
legacy `/srv/clankerdev-release/repo` checkout and captures the previously
installed unit, so a first-rollout failure can restore the old BFF source.
Subsequent deploys execute the versioned helper from the updated checkout and
do not depend on an installed helper copy.

To audit a completed deployment without changing state, run:

```sh
expected="$(git -C /srv/clankerdev-deploy/repo rev-parse HEAD)"
release="$(readlink -f /srv/clankerdev-release/current)"
node /srv/clankerdev-deploy/repo/scripts/dev-deploy-provenance.mjs \
  --expected "$expected" \
  --source-repo /srv/clankerdev-deploy/repo \
  --build-info /var/www/dev.crucio.cz/current/build-info.json \
  --release-root /srv/clankerdev-release \
  --release-repo "$release"
```

Normally rollback is automatic. If it reports failed rollback steps, use only
the retained `dev-crucio-deploy.*` directory printed by the helper. Replace the
placeholder below with that exact directory and restore the captured state:

```sh
set -euo pipefail
backup=/tmp/dev-crucio-deploy.REPORTED-BY-THE-HELPER
repo=/srv/clankerdev-deploy/repo
release_root=/srv/clankerdev-release
current="$release_root/current"

if [[ "$(<"$backup/previous-current-had-link")" == 1 ]]; then
  node "$repo/scripts/dev-deploy-release-link.mjs" switch \
    --root "$release_root" --current "$current" \
    --target "$(<"$backup/previous-current-target")"
elif [[ -L "$current" ]]; then
  active="$(readlink -f "$current")"
  node "$repo/scripts/dev-deploy-release-link.mjs" remove \
    --root "$release_root" --current "$current" --expected-target "$active"
fi

if [[ "$(<"$backup/bff-unit-had-previous")" == 1 ]]; then
  install -m 0644 "$backup/webui-next-bff.service" \
    /etc/systemd/system/webui-next-bff.service
else
  rm -f /etc/systemd/system/webui-next-bff.service
fi
install -d -m 0755 /var/www/dev.crucio.cz/current
rsync -a --delete "$backup/webroot/" /var/www/dev.crucio.cz/current/

if [[ "$(<"$backup/nginx-conf-had-previous")" == 1 ]]; then
  install -m 0644 "$backup/nginx-dev.crucio.cz.conf" \
    /etc/nginx/sites-available/dev.crucio.cz
else
  rm -f /etc/nginx/sites-available/dev.crucio.cz
fi
if [[ "$(<"$backup/nginx-link-had-previous")" == 1 ]]; then
  ln -sfn "$(<"$backup/previous-nginx-link-target")" \
    /etc/nginx/sites-enabled/dev.crucio.cz
else
  rm -f /etc/nginx/sites-enabled/dev.crucio.cz
fi
```

Then validate the restored service in this order:

```sh
systemctl daemon-reload
nginx -t && systemctl reload nginx
systemctl restart webui-next-bff.service
bash /srv/clankerdev-deploy/repo/deploy/smoke-auth-endpoints.sh \
  https://dev.crucio.cz --insecure
```

After successful validation, remove that one retained private backup. Do not
delete anything below `/srv/clankerdev-release/releases`; retained releases are
the rollback and diagnosis record.

The `/v7.0` proxy strips `WWW-Authenticate` from unauthenticated API responses.
The API still returns `401`, but browsers do not show a native Basic Auth prompt.

The BFF environment lives on the server in:

```sh
/etc/webui-next/oauth.env
```

Use `oauth.env.example` as the shape of that file. Do not commit the real OAuth
client secret or session secret.

The BFF code is served from the active immutable release:

```sh
/srv/clankerdev-release/current/bff
```

`dev.crucio.cz` currently uses the local Debian snakeoil certificate because
the hostname resolves to a private address. Replace it with a trusted internal
or DNS-validated certificate when one is available.

The test API on `admin.crucio.cz` also needs the patch in
`../admin.crucio.cz/vpsadmin-api-user-session-label.patch`. Without it, OAuth
session creation can fail with HTTP 500 when the upstream request does not carry
a user-agent label.

The password-reset endpoint also needs a notification-template oneshot and a
dedicated queue worker. Their guarded dev-only rollout and post-release check
are documented in [`password-recovery-runtime.md`](password-recovery-runtime.md).

## Dev smoke data

Networking and lifecycle UI smoke tests need disposable test rows in the local
test API. The dev-only helper in `seed-networking-smoke-data.sh` prepares RFC
5737 route and host addresses through the API and is dry-run by default:

```sh
SMOKE_USER_ID=... SMOKE_ENVIRONMENT_ID=... \
  deploy/dev.crucio.cz/seed-networking-smoke-data.sh
```

Review the plan, then rerun with `--apply` against the local test API only. See
`networking-smoke-data.md` for the expected rows and smoke-test checklist.

DNS UI smoke tests need authoritative server metadata, zone assignments, and
disposable forward/reverse zones in the local test API. The dev-only helper in
`seed-dns-smoke-data.sh` is also dry-run by default:

```sh
SMOKE_USER_ID=... SMOKE_DNS_NODE_ID=... \
  deploy/dev.crucio.cz/seed-dns-smoke-data.sh
```

Review the plan, then rerun with `--apply` against the local test API only. See
`dns-smoke-data.md` for the expected DNS rows, nodectld/service dependency
notes, and DNS/PTR smoke-test checklist.

Storage, backup and dataset UI smoke tests need a nested vpsAdminOS storage
node with a live backup-capable pool. The dev-only helper in
`bootstrap-storage-lab-node.sh` prepares the QEMU node config, systemd service,
RabbitMQ node user and guarded local DB seed:

```sh
deploy/dev.crucio.cz/bootstrap-storage-lab-node.sh
```

Review the dry-run output, then rerun with `--apply` on `admin.crucio.cz` only.
See `storage-lab-node.md` for the expected node/pool rows, status commands and
UI smoke path.

Snapshot download URLs are served by nginx from `/var/lib/web/download`, but
the files live on the nested vpsAdminOS node pools. After changing storage
nodes or after a reboot, refresh the dev-only NFS mounts with:

```sh
deploy/dev.crucio.cz/mount-snapshot-downloads.sh
```

The helper mounts the known dev pools below `/var/lib/web/download/<node>/<pool>`
and checks the `_vpsadmin-download-healthcheck` file. It intentionally skips
unavailable pools unless `--strict` is used, because some lab nodes may be
temporarily offline while storage work is in progress.

Install the matching systemd timer when the helper changes:

```sh
rsync -az deploy/dev.crucio.cz/mount-snapshot-downloads.sh \
  root@admin.crucio.cz:/root/vpsadmin-dev-lab/mount-snapshot-downloads.sh
rsync -az deploy/dev.crucio.cz/snapshot-download-mounts.{service,timer} \
  root@admin.crucio.cz:/etc/systemd/system/
ssh root@admin.crucio.cz \
  'systemctl daemon-reload && systemctl enable --now snapshot-download-mounts.timer'
```

## Live parity workflow

Real VPS and dataset operation checks are documented in
`live-parity-workflows.md`. They are human-run on `dev.crucio.cz` only and must
use disposable objects with obvious `webui-next-live-test-*`,
`webui-next-playground-*`, or `webui-next-staging-*` names. The optional
Playwright helper is opt-in via `E2E_LIVE_PARITY=1` and only opens workflows to
verify live labels, previews, and confirmation gates; it does not submit
destructive actions.

## Build source

This repository now contains the WebUI Next source project. Product fixes
should be made in source, reviewed in PRs, then deployed with `deploy-dev`.

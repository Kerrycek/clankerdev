# Reviewed artifact promotion and rollback: clankerdev.vpsfree.cz

This is the routine **existing-host** procedure transcribed from the recorded
PR527 promotion. It replaces dependence on an operator-held one-off wrapper.
It is not the [initial bootstrap](../README.md), and it is **not** the newadmin
cutover procedure. Documentation is not deployment authorization.

Validation of this revision: shell syntax and source/receipt review only. The
original operation is recorded at UI/BFF `156a7c04`; this rewritten procedure
still needs a receiving-operator rehearsal in an owned environment. No shared
deployment was executed to validate this document.

## Inputs and stop conditions

Obtain approval for the full 40-character source SHA, target, API compatibility
and known exclusions. Keep a trusted manifest containing source archive and
dev-built dist archive SHA-256 hashes, expected previous release, CI links and
rollback owner. Archives must come from the reviewed clean Git tree and verified
dev build, not an arbitrary uploaded tarball.

Source archive layout: `vpsadmin/webui-next/` prefix; generate from the exact
reviewed revision with `git archive --format=tar.gz --prefix=vpsadmin/webui-next/`.
The dist archive contains the **contents** of the verified dev release's dist,
including build-info.json, not another outer dist directory. Package only dist;
do not include environment files, sessions or node_modules. Copy the matching
locked BFF source with the source archive.

Inspect target configuration privately. Historical layout:

| Item | Recorded value |
| --- | --- |
| Host identity | hostname clankerdev; resolve/verify SSH host separately |
| Release root and pointer | /opt/webui-next/releases and /opt/webui-next/current-release |
| Release source subdirectory | vpsadmin/webui-next |
| Webroot | /var/www/clankerdev.vpsfree.cz/current |
| BFF | webui-next-bff.service, webui-bff identity, 127.0.0.1:3001 |
| nginx vhost | /etc/nginx/sites-available/clankerdev.vpsfree.cz.conf |
| Private BFF environment | /etc/webui-next/oauth.env; keep existing secret values |

Stop if the host/unit/layout, previous release, config checksum, artifact hashes,
build SHA or permissions differ from preflight. Do not “repair” shared config
during a routine release. Check available space for stage plus full rollback copy.
Check for healthy running deployment work; never interrupt it. Coordinate a
configuration freeze with the service owner for the operation: the deploy lock
serializes participating release shells, not unrelated systemctl/config edits.
Private unit snapshots and environment hashes are comparison evidence only; do
not publish them. This procedure never restores OAuth secrets automatically.

## Prepare in one root shell on the verified target

The following blocks run in the **same Bash session**. Replace only reviewed
input values. All paths and hashes are chosen before activation. An operator
must execute the rollback block after any activation/check failure; this manual
runbook does not install an automatic ERR handler.

```bash
set -euo pipefail
expected=REPLACE_WITH_APPROVED_40_CHARACTER_SHA
expected_previous=REPLACE_WITH_VERIFIED_PREVIOUS_RELEASE_DIRECTORY
input_dir=REPLACE_WITH_PRIVATE_ARTIFACT_DIRECTORY
[[ "$expected" =~ ^[0-9a-f]{40}$ ]]
test "$(hostname)" = clankerdev
base=/opt/webui-next
current="$base/current-release"
webroot=/var/www/clankerdev.vpsfree.cz/current
nginx_conf=/etc/nginx/sites-available/clankerdev.vpsfree.cz.conf
oauth_env=/etc/webui-next/oauth.env
lock_file=/run/lock/clankerdev-reviewed-deploy.lock
test ! -L "$lock_file"
if test -e "$lock_file"; then test -f "$lock_file"; test "$(stat -c %u "$lock_file")" = 0; fi
(umask 077; touch "$lock_file")
chmod 0600 "$lock_file"
exec 9>>"$lock_file"
flock -n 9
previous=$(readlink -f "$current")
test "$previous" = "$expected_previous"
test -f "$previous/vpsadmin/webui-next/bff/server.js"
test -d "$webroot"
(cd "$input_dir" && sha256sum -c release.sha256)
# Review tar member lists before extraction: only trusted release-relative paths,
# no absolute/../ entries or unexpected symlinks.
tar -tzf "$input_dir/source.tar.gz"
tar -tzf "$input_dir/dist.tar.gz"
release="$base/releases/reviewed-$expected"
test ! -e "$release"
stage=$(mktemp -d "$base/releases/.reviewed-stage.XXXXXX")
backup=$(mktemp -d "$base/rollback-reviewed.XXXXXX")
chmod 0700 "$backup"
rsync -a "$webroot/" "$backup/webroot/"
printf '%s\n' "$previous" > "$backup/previous-release"
cp -a "$nginx_conf" "$backup/nginx.conf"
systemctl cat webui-next-bff.service > "$backup/bff-unit-observed.txt"
test -f "$oauth_env"
sha256sum "$oauth_env" > "$backup/bff-env.sha256"
tar -xzf "$input_dir/source.tar.gz" -C "$stage"
frontend="$stage/vpsadmin/webui-next"
test -f "$frontend/bff/server.js"
test ! -e "$frontend/dist"
mkdir "$frontend/dist"
tar -xzf "$input_dir/dist.tar.gz" -C "$frontend/dist"
node -e 'const p=require(process.argv[1]); if(p.commit!==process.argv[2] || p.dirty!==false) process.exit(1)' \
  "$frontend/dist/build-info.json" "$expected"
printf '%s\n' "$expected" > "$stage/reviewed-commit"
npm ci --prefix "$frontend/bff" --omit=dev --no-audit --no-fund
chmod 0755 "$stage"
runuser -u webui-bff -- node -e 'require.resolve("express",{paths:[process.argv[1]]})' "$frontend/bff"
mv "$stage" "$release"
readlink -f "$release" > "$backup/candidate-release"
cmp -s "$nginx_conf" "$backup/nginx.conf"
systemctl cat webui-next-bff.service | cmp -s "$backup/bff-unit-observed.txt" -
sha256sum --status -c "$backup/bff-env.sha256"
test "$(readlink -f "$current")" = "$previous"
```

Verify the trusted source manifest is actually associated with the reviewed Git
revision; build-info.json alone does not prove source archive provenance.
The unit must already resolve through current-release; this procedure does not
modify the unit, environment, database or API. A stage failure before activation
leaves the running service alone; retain evidence and remove only identified
unused staging artifacts after inspection.

## Activate and verify

Prepare a second verified operator connection and know the backup path before
activation. Publishing dist and switching BFF are separate steps; this is **not**
a claim of atomic cross-component activation. Failed/mixed deployment requires
rollback, not an opportunistic partial retry.

```bash
# Recheck immediately before publication, including changes during preparation.
cmp -s "$nginx_conf" "$backup/nginx.conf"
systemctl cat webui-next-bff.service | cmp -s "$backup/bff-unit-observed.txt" -
sha256sum --status -c "$backup/bff-env.sha256"
test "$(readlink -f "$current")" = "$previous"
rsync -a --delete-delay --delay-updates "$release/vpsadmin/webui-next/dist/" "$webroot/"
chown -R root:www-data "$webroot"
find "$webroot" -type d -exec chmod 0755 {} +
find "$webroot" -type f -exec chmod 0644 {} +
ln -s "$release" "$base/reviewed-link-$$"
mv -Tf "$base/reviewed-link-$$" "$current"
systemctl restart webui-next-bff.service
healthy=0
for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:3001/healthz >/dev/null; then healthy=1; break; fi
  sleep 1
done
test "$healthy" = 1
bash "$release/vpsadmin/webui-next/deploy/smoke-auth-endpoints.sh" https://clankerdev.vpsfree.cz
curl -fsS https://clankerdev.vpsfree.cz/build-info.json > "$backup/new-build-info.json"
node -e 'const p=require(process.argv[1]); if(p.commit!==process.argv[2] || p.dirty!==false) process.exit(1)' \
  "$backup/new-build-info.json" "$expected"
pid=$(systemctl show -p MainPID --value webui-next-bff.service)
test "$pid" -gt 0
test "$(readlink -f "/proc/$pid/cwd")" = "$release/vpsadmin/webui-next/bff"
test -z "$(rsync -rnic --delete "$release/vpsadmin/webui-next/dist/" "$webroot/")"
```

Then check deep links/static assets and the approved public/authenticated scenario
scope. Keep fixture and real API results separate. A health check does not prove
login/MFA, console operation or lifecycle completion. Record both host revisions,
BFF paths, API pin if tested, CI, artifact hashes, retained rollback identity and
known limits in the per-release work log. Never put raw session responses there.

## Rollback after partial activation or failed verification

Use the exact private backup captured by this operation. Start a new verified
root Bash session after confirming the failed deploy shell/process has exited and
released its lock; do not race a healthy deployment. Record the backup path outside
the failed shell before activation. The block reacquires the same lock and checks
configuration and the active release before changing either component. Confirm
from the operation record that no later promotion has intervened, including a
redeployment of the same revision; the pointer check cannot distinguish those.
A different active release is a stop condition, not permission to restore a stale
backup. A partial failure may leave either this candidate or the previous pointer
active because frontend copying and BFF switching are separate steps.

```bash
set -euo pipefail
test "$(hostname)" = clankerdev
base=/opt/webui-next
current="$base/current-release"
webroot=/var/www/clankerdev.vpsfree.cz/current
nginx_conf=/etc/nginx/sites-available/clankerdev.vpsfree.cz.conf
oauth_env=/etc/webui-next/oauth.env
backup=REPLACE_WITH_THIS_OPERATIONS_VERIFIED_BACKUP_DIRECTORY
lock_file=/run/lock/clankerdev-reviewed-deploy.lock
test ! -L "$lock_file"
if test -e "$lock_file"; then test -f "$lock_file"; test "$(stat -c %u "$lock_file")" = 0; fi
(umask 077; touch "$lock_file")
chmod 0600 "$lock_file"
exec 9>>"$lock_file"
flock -n 9
previous=$(cat "$backup/previous-release")
candidate=$(cat "$backup/candidate-release")
test -f "$candidate/vpsadmin/webui-next/bff/server.js"
active=$(readlink -f "$current")
if [[ "$active" != "$candidate" && "$active" != "$previous" ]]; then
  printf '%s\n' 'Stop: active release is outside this rollback operation.' >&2
  exit 1
fi
test -f "$previous/vpsadmin/webui-next/bff/server.js"
test -d "$backup/webroot"
test -f "$backup/nginx.conf"
test -f "$backup/bff-unit-observed.txt"
test -f "$backup/bff-env.sha256"
# A changed unit/config needs its own restoration decision before rollback.
cmp -s "$nginx_conf" "$backup/nginx.conf"
systemctl cat webui-next-bff.service | cmp -s "$backup/bff-unit-observed.txt" -
sha256sum --status -c "$backup/bff-env.sha256"
nginx -t
ln -s "$previous" "$base/rollback-link-$$"
mv -Tf "$base/rollback-link-$$" "$current"
rsync -a --delete "$backup/webroot/" "$webroot/"
# Do not overwrite a concurrent authorized nginx edit. This release did not edit it.
cmp -s "$nginx_conf" "$backup/nginx.conf"
systemctl cat webui-next-bff.service | cmp -s "$backup/bff-unit-observed.txt" -
sha256sum --status -c "$backup/bff-env.sha256"
nginx -t
systemctl restart webui-next-bff.service
bash "$previous/vpsadmin/webui-next/deploy/smoke-auth-endpoints.sh" https://clankerdev.vpsfree.cz
pid=$(systemctl show -p MainPID --value webui-next-bff.service)
test "$pid" -gt 0
test "$(readlink -f "/proc/$pid/cwd")" = "$previous/vpsadmin/webui-next/bff"
test -z "$(rsync -rnic --delete "$backup/webroot/" "$webroot/")"
```

Verify public build-info matches the previous webroot's recorded metadata and rerun
the affected health/auth checks. If any restoration step fails, keep the backup,
record the failed step and hand it to the responsible operator; do not delete the
new or previous release or claim rollback succeeded. No nginx reload is needed
when its configuration was unchanged. Changed unit/config/secret scenarios require
their own reviewed restoration plan, not blind overwriting by this procedure.

Frontend rollback does not undo user/API mutations or database migrations. Retain
both releases and private backups until the agreed retention/acceptance decision.

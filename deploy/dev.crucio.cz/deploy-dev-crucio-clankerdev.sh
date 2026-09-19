#!/usr/bin/env bash
set -Eeuo pipefail

src="${1:-/srv/clankerdev-deploy/repo}"
production_src="/srv/clankerdev-deploy/repo"
dst="/var/www/dev.crucio.cz/current"
nginx_conf_src="deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf"
nginx_conf_dst="/etc/nginx/sites-available/dev.crucio.cz"
nginx_link_dst="/etc/nginx/sites-enabled/dev.crucio.cz"
bff_unit_src="deploy/dev.crucio.cz/webui-next-bff.service"
bff_unit_dst="/etc/systemd/system/webui-next-bff.service"
release_root="/srv/clankerdev-release"
release_current="$release_root/current"
release_releases="$release_root/releases"
provenance_script="scripts/dev-deploy-provenance.mjs"
release_link_script="scripts/dev-deploy-release-link.mjs"
test_root="${DEV_DEPLOY_TEST_ROOT:-}"
test_failure="${DEV_DEPLOY_TEST_FAILURE:-}"
test_events=""
test_unit_state=""
deploy_lock_file="/run/lock/clankerdev-dev-deploy.lock"
test_lock_dir=""
release_stage=""
deploy_backup=""
retain_deploy_backup=0

if [[ -n "$test_root" ]]; then
  test_root="$(readlink -f "$test_root")"
  if [[ ! -d "$test_root" || "$(basename "$test_root")" != dev-deploy-contract-* ]]; then
    echo "DEV_DEPLOY_TEST_ROOT must be an existing dev-deploy-contract-* directory" >&2
    exit 2
  fi
  dst="$test_root/webroot/current"
  nginx_conf_dst="$test_root/etc/nginx/sites-available/dev.crucio.cz"
  nginx_link_dst="$test_root/etc/nginx/sites-enabled/dev.crucio.cz"
  bff_unit_dst="$test_root/etc/systemd/system/webui-next-bff.service"
  release_root="$test_root/release"
  release_current="$release_root/current"
  release_releases="$release_root/releases"
  test_events="$test_root/events.log"
  test_unit_state="$test_root/unit-state.json"
fi

record_event() {
  [[ -n "$test_events" ]] || return 0
  printf '%s\n' "$1" >>"$test_events"
}

assert_release_target() {
  local target="$1"
  local label="$2"
  local canonical_root canonical_target relative
  canonical_root="$(readlink -f "$release_root")"
  canonical_target="$(readlink -f "$target")"
  relative="${canonical_target#"$canonical_root"/}"
  if [[ "$canonical_target" == "$canonical_root" || "$relative" == "$canonical_target" || "$relative" == ../* ]]; then
    echo "$label escapes release root $canonical_root: $canonical_target" >&2
    return 1
  fi
}

remove_private_backup() {
  local backup="$1"
  [[ -n "$backup" && -e "$backup" ]] || return 0
  if [[ ! -d "$backup" || -L "$backup" || "$(basename "$backup")" != dev-crucio-deploy.* ]]; then
    echo "Refusing to remove unexpected deploy backup: $backup" >&2
    return 1
  fi
  rm -rf -- "$backup"
}

remove_incomplete_stage() {
  local stage="$1"
  [[ -n "$stage" && -d "$stage" ]] || return 0
  assert_release_target "$stage" "Incomplete release stage" || return 1
  if [[ "$(basename "$stage")" != .staging-* ]]; then
    echo "Refusing to remove unexpected release stage: $stage" >&2
    return 1
  fi
  rm -rf -- "$stage"
}

cleanup_on_exit() {
  local original_status=$?
  local cleanup_failures=0
  trap - EXIT
  set +e

  remove_incomplete_stage "$release_stage" || ((cleanup_failures += 1))
  if [[ "$retain_deploy_backup" -eq 0 ]]; then
    remove_private_backup "$deploy_backup" || ((cleanup_failures += 1))
  fi
  if [[ -n "$test_lock_dir" && -d "$test_lock_dir" ]]; then
    rmdir -- "$test_lock_dir" || ((cleanup_failures += 1))
  fi

  if [[ "$original_status" -eq 0 && "$cleanup_failures" -gt 0 ]]; then
    original_status=1
  fi
  exit "$original_status"
}

acquire_deploy_lock() {
  if [[ -n "$test_root" ]]; then
    test_lock_dir="$test_root/dev-deploy.lock"
    if ! mkdir -- "$test_lock_dir" 2>/dev/null; then
      echo "Another dev deploy holds the test lock: $test_lock_dir" >&2
      return 75
    fi
    return 0
  fi

  if ! command -v flock >/dev/null 2>&1; then
    echo "flock is required for exclusive dev deploys" >&2
    return 69
  fi
  if [[ -L "$deploy_lock_file" || ( -e "$deploy_lock_file" && ! -f "$deploy_lock_file" ) ]]; then
    echo "Refusing unexpected deploy lock path: $deploy_lock_file" >&2
    return 2
  fi
  if ! (umask 077; : >>"$deploy_lock_file"); then
    echo "Unable to create dev deploy lock: $deploy_lock_file" >&2
    return 2
  fi
  if [[ "$(stat -c '%u' "$deploy_lock_file")" != 0 ]]; then
    echo "Dev deploy lock must be root-owned: $deploy_lock_file" >&2
    return 2
  fi
  if ! chmod 0600 "$deploy_lock_file"; then
    echo "Unable to secure dev deploy lock: $deploy_lock_file" >&2
    return 2
  fi
  if ! exec 9>>"$deploy_lock_file"; then
    echo "Unable to open dev deploy lock: $deploy_lock_file" >&2
    return 2
  fi
  if ! flock -n 9; then
    echo "Another dev deploy is already running (lock: $deploy_lock_file)" >&2
    return 75
  fi
}

verify_unit_file() {
  if [[ -n "$test_root" ]]; then
    return 0
  fi
  systemd-analyze verify "$bff_unit_src"
}

build_frontend() {
  local release="$1"
  if [[ -n "$test_root" ]]; then
    record_event "build-frontend"
    install -d -m 0755 "$release/dist"
    node -e '
      const fs = require("node:fs");
      const [file, commit] = process.argv.slice(1);
      fs.writeFileSync(file, `${JSON.stringify({
        schemaVersion: 1,
        commit,
        shortCommit: commit.slice(0, 12),
        dirty: false,
        source: "git",
      }, null, 2)}\n`);
    ' "$release/dist/build-info.json" "$expected_commit"
    printf '<!doctype html><title>new frontend</title>\n' >"$release/dist/index.html"
    return 0
  fi
  npm --prefix "$release" ci
  npm --prefix "$release" run build
}

install_staged_bff_dependencies() {
  local release="$1"
  if [[ -n "$test_root" ]]; then
    record_event "install-staged-bff-dependencies"
    return 0
  fi
  if [[ -f "$release/bff/package-lock.json" ]]; then
    npm --prefix "$release/bff" ci --omit=dev
  else
    npm --prefix "$release/bff" install --omit=dev
  fi
}

verify_existing_bff_dependencies() {
  local release="$1"
  if [[ -n "$test_root" ]]; then
    return 0
  fi
  npm --prefix "$release/bff" ls --omit=dev --depth=0 >/dev/null
}

verify_service_access_tooling() {
  [[ -n "$test_root" ]] && return 0
  if [[ ! -x /usr/bin/setpriv || ! -x /usr/bin/node || ! -x /usr/bin/id ]]; then
    echo "BFF release access verification requires /usr/bin/setpriv, /usr/bin/node and /usr/bin/id" >&2
    return 69
  fi
  if ! /usr/bin/id -u webui-bff >/dev/null 2>&1; then
    echo "BFF service user does not exist: webui-bff" >&2
    return 69
  fi
}

verify_release_service_access() {
  local release="$1"
  local -a access_command=(node)
  if [[ -z "$test_root" ]]; then
    access_command=(
      /usr/bin/setpriv
      --reuid=webui-bff
      --regid=webui-bff
      --init-groups
      /usr/bin/node
    )
  fi

  if ! "${access_command[@]}" -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const release = fs.realpathSync(process.argv[1]);
    const releaseMode = fs.statSync(release).mode & 0o777;
    if ((releaseMode & 0o005) !== 0o005) {
      throw new Error(`release root must be world-readable/traversable, got ${releaseMode.toString(8)}`);
    }
    const bff = path.join(release, "bff");
    const server = path.join(bff, "server.js");
    const packageFile = path.join(bff, "package.json");
    fs.accessSync(release, fs.constants.R_OK | fs.constants.X_OK);
    fs.accessSync(bff, fs.constants.R_OK | fs.constants.X_OK);
    fs.accessSync(server, fs.constants.R_OK);
    fs.accessSync(packageFile, fs.constants.R_OK);
    const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
      require.resolve(dependency, { paths: [bff] });
    }
  ' "$release"; then
    echo "BFF release is not readable/traversable by webui-bff: $release" >&2
    return 1
  fi
}

reload_nginx() {
  if [[ -n "$test_root" ]]; then
    record_event "reload-nginx"
    if [[ "$test_failure" == "nginx" && "$rollback_in_progress" -eq 0 ]]; then
      return 70
    fi
    return 0
  fi
  nginx -t || return
  systemctl reload nginx
}

daemon_reload() {
  if [[ -n "$test_root" ]]; then
    record_event "daemon-reload"
    return 0
  fi
  systemctl daemon-reload
}

write_test_unit_state() {
  local process_checkout
  process_checkout="$(readlink -f "$release_current")"
  node -e '
    const fs = require("node:fs");
    const [file, workingDirectory, processCwd] = process.argv.slice(1);
    fs.writeFileSync(file, `${JSON.stringify({
      workingDirectory,
      execStart: `/usr/bin/node ${workingDirectory}/server.js`,
      mainPID: 4242,
      processCwd,
    })}\n`);
  ' "$test_unit_state" "$release_current/bff" "$process_checkout/bff"
}

restart_bff() {
  if [[ -n "$test_root" ]]; then
    record_event "restart-bff"
    if [[ "$test_failure" == "restart" && "$rollback_in_progress" -eq 0 ]]; then
      return 71
    fi
    if [[ -L "$release_current" ]]; then
      write_test_unit_state || return
    fi
    return 0
  fi
  systemctl restart webui-next-bff.service
}

smoke_auth_endpoints() {
  if [[ -n "$test_root" ]]; then
    record_event "smoke-auth-endpoints"
    if [[ "$test_failure" == "health" && "$rollback_in_progress" -eq 0 ]]; then
      return 72
    fi
    return 0
  fi
  bash deploy/smoke-auth-endpoints.sh https://dev.crucio.cz --insecure
}

switch_current_release() {
  local target="$1"
  assert_release_target "$target" "Release switch target" || return
  node "$release_link_script" switch \
    --root "$release_root" \
    --current "$release_current" \
    --target "$target" >/dev/null
}

remove_current_release() {
  local expected_target="$1"
  assert_release_target "$expected_target" "Release removal target" || return
  node "$release_link_script" remove \
    --root "$release_root" \
    --current "$release_current" \
    --expected-target "$expected_target" >/dev/null
}

verify_provenance() {
  local build_info="$1"
  local release="$2"
  shift 2
  local args=(
    --expected "$expected_commit"
    --source-repo "$canonical_src"
    --build-info "$build_info"
    --release-root "$release_root"
    --release-repo "$release"
  )
  if [[ -n "$test_root" && "$#" -eq 0 ]]; then
    args+=(--unit-state-file "$test_unit_state")
  fi
  node "$provenance_script" "${args[@]}" "$@" >/dev/null
}

if [[ ! -d "$src" ]]; then
  echo "Source is not a directory: $src" >&2
  exit 2
fi

canonical_src="$(readlink -f "$src")"
if [[ -z "$test_root" && "$canonical_src" != "$production_src" ]]; then
  echo "Refusing unexpected deploy source: expected $production_src, got $canonical_src" >&2
  exit 2
fi
if ! git -C "$canonical_src" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Source is not a git checkout: $canonical_src" >&2
  exit 2
fi
if [[ -n "$(git -C "$canonical_src" status --porcelain --untracked-files=no)" ]]; then
  echo "Refusing tracked changes in deploy source: $canonical_src" >&2
  exit 2
fi

expected_commit="$(git -C "$canonical_src" rev-parse HEAD)"
if [[ ! "$expected_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Unable to resolve a full deploy commit from $canonical_src" >&2
  exit 2
fi

for required in "$nginx_conf_src" "$bff_unit_src" "$provenance_script" "$release_link_script"; do
  if [[ ! -f "$canonical_src/$required" ]]; then
    echo "Missing deploy input: $canonical_src/$required" >&2
    exit 2
  fi
done

cd "$canonical_src"
verify_unit_file
verify_service_access_tooling

if acquire_deploy_lock; then
  trap cleanup_on_exit EXIT
else
  lock_status=$?
  exit "$lock_status"
fi

install -d -m 0755 "$release_root" "$release_releases"
release_root="$(readlink -f "$release_root")"
release_releases="$(readlink -f "$release_releases")"
release_current="$release_root/current"
release_dir="$release_releases/$expected_commit"

if [[ -L "$release_dir" ]]; then
  echo "Refusing symlinked immutable release: $release_dir" >&2
  exit 2
fi

if [[ -d "$release_dir" ]]; then
  verify_existing_bff_dependencies "$release_dir"
  if [[ ! -f "$release_dir/dist/build-info.json" ]]; then
    echo "Existing immutable release has no frontend build-info: $release_dir" >&2
    exit 1
  fi
  verify_provenance "$release_dir/dist/build-info.json" "$release_dir" --skip-runtime
else
  release_stage="$(mktemp -d "$release_root/.staging-$expected_commit.XXXXXX")"
  (
    umask 022
    git clone --quiet --no-hardlinks --no-checkout "$canonical_src" "$release_stage"
    git -C "$release_stage" checkout --quiet --detach "$expected_commit"
    build_frontend "$release_stage"
    install_staged_bff_dependencies "$release_stage"
  )
  if [[ ! -f "$release_stage/dist/build-info.json" ]]; then
    echo "Frontend build did not produce $release_stage/dist/build-info.json" >&2
    exit 1
  fi
  verify_provenance "$release_stage/dist/build-info.json" "$release_stage" --skip-runtime
  chmod 0755 "$release_stage"
  if [[ -e "$release_dir" || -L "$release_dir" ]]; then
    echo "Immutable release appeared while staging: $release_dir" >&2
    exit 1
  fi
  mv "$release_stage" "$release_dir"
  release_stage=""
fi
assert_release_target "$release_dir" "Immutable release"
verify_release_service_access "$release_dir"
nginx_conf_release="$release_dir/$nginx_conf_src"
bff_unit_release="$release_dir/$bff_unit_src"
provenance_script="$release_dir/$provenance_script"
release_link_script="$release_dir/$release_link_script"

if [[ -n "$test_root" ]]; then
  deploy_backup="$(mktemp -d "$test_root/dev-crucio-deploy.XXXXXX")"
else
  deploy_backup="$(mktemp -d /tmp/dev-crucio-deploy.XXXXXX)"
fi
install -d -m 0755 "$deploy_backup/webroot"
if [[ -d "$dst" ]]; then
  rsync -a "$dst/" "$deploy_backup/webroot/"
fi

bff_unit_had_previous=0
if [[ -f "$bff_unit_dst" ]]; then
  install -m 0644 "$bff_unit_dst" "$deploy_backup/webui-next-bff.service"
  bff_unit_had_previous=1
fi

nginx_conf_had_previous=0
if [[ -f "$nginx_conf_dst" ]]; then
  install -m 0644 "$nginx_conf_dst" "$deploy_backup/nginx-dev.crucio.cz.conf"
  nginx_conf_had_previous=1
fi

nginx_link_had_previous=0
nginx_link_previous_target=""
if [[ -L "$nginx_link_dst" ]]; then
  nginx_link_had_previous=1
  nginx_link_previous_target="$(readlink "$nginx_link_dst")"
elif [[ -e "$nginx_link_dst" ]]; then
  echo "Refusing non-symlink nginx enabled path: $nginx_link_dst" >&2
  remove_private_backup "$deploy_backup"
  exit 2
fi

previous_current_had_link=0
previous_current_target=""
if [[ -L "$release_current" ]]; then
  previous_current_had_link=1
  previous_current_target="$(readlink -f "$release_current")"
  assert_release_target "$previous_current_target" "Previous current release"
elif [[ -e "$release_current" ]]; then
  echo "Refusing non-symlink release current path: $release_current" >&2
  remove_private_backup "$deploy_backup"
  exit 2
fi

printf '%s\n' "$bff_unit_had_previous" >"$deploy_backup/bff-unit-had-previous"
printf '%s\n' "$nginx_conf_had_previous" >"$deploy_backup/nginx-conf-had-previous"
printf '%s\n' "$nginx_link_had_previous" >"$deploy_backup/nginx-link-had-previous"
printf '%s\n' "$previous_current_had_link" >"$deploy_backup/previous-current-had-link"
if [[ "$nginx_link_had_previous" -eq 1 ]]; then
  printf '%s\n' "$nginx_link_previous_target" >"$deploy_backup/previous-nginx-link-target"
fi
if [[ "$previous_current_had_link" -eq 1 ]]; then
  printf '%s\n' "$previous_current_target" >"$deploy_backup/previous-current-target"
fi

rollback_in_progress=0
rollback_complete=0

rollback_step() {
  local label="$1"
  shift
  if "$@"; then
    echo "Rollback: $label: ok" >&2
    return 0
  else
    local status=$?
    echo "Rollback: $label: FAILED (exit $status)" >&2
    return "$status"
  fi
}

rollback_deploy() {
  local original_status="$1"
  local reason="$2"
  if [[ "$rollback_complete" -eq 1 ]]; then
    return "$original_status"
  fi
  if [[ "$rollback_in_progress" -eq 1 ]]; then
    echo "Rollback re-entry suppressed; original failure: $reason" >&2
    return "$original_status"
  fi

  rollback_in_progress=1
  retain_deploy_backup=1
  trap - ERR INT TERM
  set +e
  local rollback_failures=0
  echo "Deployment failed (exit $original_status): $reason" >&2
  echo "Restoring prior release link, unit, frontend and nginx configuration" >&2

  if [[ "$previous_current_had_link" -eq 1 ]]; then
    rollback_step "restore previous release link" switch_current_release "$previous_current_target" || ((rollback_failures += 1))
  elif [[ -L "$release_current" ]]; then
    rollback_step "remove first-rollout release link" remove_current_release "$release_dir" || ((rollback_failures += 1))
  fi

  if [[ "$bff_unit_had_previous" -eq 1 ]]; then
    rollback_step "restore BFF unit" install -m 0644 "$deploy_backup/webui-next-bff.service" "$bff_unit_dst" || ((rollback_failures += 1))
  else
    rollback_step "remove newly installed BFF unit" rm -f -- "$bff_unit_dst" || ((rollback_failures += 1))
  fi

  rollback_step "restore frontend directory" install -d -m 0755 "$dst" || ((rollback_failures += 1))
  rollback_step "restore frontend contents" rsync -a --delete "$deploy_backup/webroot/" "$dst/" || ((rollback_failures += 1))

  if [[ "$nginx_conf_had_previous" -eq 1 ]]; then
    rollback_step "restore nginx config" install -m 0644 "$deploy_backup/nginx-dev.crucio.cz.conf" "$nginx_conf_dst" || ((rollback_failures += 1))
  else
    rollback_step "remove newly installed nginx config" rm -f -- "$nginx_conf_dst" || ((rollback_failures += 1))
  fi
  if [[ "$nginx_link_had_previous" -eq 1 ]]; then
    rollback_step "restore nginx enabled link" ln -sfn "$nginx_link_previous_target" "$nginx_link_dst" || ((rollback_failures += 1))
  else
    rollback_step "remove newly enabled nginx link" rm -f -- "$nginx_link_dst" || ((rollback_failures += 1))
  fi

  rollback_step "reload systemd units" daemon_reload || ((rollback_failures += 1))
  rollback_step "validate and reload nginx" reload_nginx || ((rollback_failures += 1))
  rollback_step "restart previous BFF" restart_bff || ((rollback_failures += 1))
  rollback_step "validate restored health" smoke_auth_endpoints || ((rollback_failures += 1))
  rollback_complete=1
  if [[ "$rollback_failures" -eq 0 ]]; then
    if rollback_step "remove private deploy backup" remove_private_backup "$deploy_backup"; then
      deploy_backup=""
    else
      ((rollback_failures += 1))
      retain_deploy_backup=1
    fi
  else
    retain_deploy_backup=1
  fi
  if [[ "$rollback_failures" -gt 0 ]]; then
    echo "Rollback completed with $rollback_failures failed step(s); manual recovery is required." >&2
    echo "Rollback backup retained at $deploy_backup" >&2
  else
    echo "Rollback completed successfully." >&2
  fi
  return "$original_status"
}

abort_deploy() {
  local status="$1"
  shift
  local reason="$*"
  rollback_deploy "$status" "$reason" || true
  exit "$status"
}

handle_unexpected_error() {
  local status="$1"
  local command="$2"
  abort_deploy "$status" "command failed: $command"
}

run_or_abort() {
  local reason="$1"
  shift
  if "$@"; then
    return 0
  else
    local status=$?
    abort_deploy "$status" "$reason"
  fi
}

trap 'handle_unexpected_error "$?" "$BASH_COMMAND"' ERR
trap 'abort_deploy 130 "deployment interrupted"' INT
trap 'abort_deploy 143 "deployment terminated"' TERM

install -d -m 0755 "$dst" "$(dirname "$nginx_conf_dst")" "$(dirname "$nginx_link_dst")" "$(dirname "$bff_unit_dst")"
rsync -a --delete "$release_dir/dist/" "$dst/"
run_or_abort "published frontend provenance mismatch" verify_provenance "$dst/build-info.json" "$release_dir" --skip-runtime

install -m 0644 "$nginx_conf_release" "$nginx_conf_dst"
ln -sfn "$nginx_conf_dst" "$nginx_link_dst"
run_or_abort "nginx validation or reload failed" reload_nginx

run_or_abort "atomic BFF release switch failed" switch_current_release "$release_dir"
install -m 0644 "$bff_unit_release" "$bff_unit_dst"
run_or_abort "systemd daemon-reload failed" daemon_reload
run_or_abort "BFF restart failed after release switch" restart_bff

if [[ "$test_failure" == "validation" && "$rollback_in_progress" -eq 0 ]]; then
  abort_deploy 73 "injected runtime provenance validation failure"
fi
run_or_abort "active frontend/BFF provenance mismatch" verify_provenance "$dst/build-info.json" "$release_dir"

echo "Checking public authentication endpoints..."
run_or_abort "public authentication smoke verification failed" smoke_auth_endpoints

trap - ERR INT TERM
remove_private_backup "$deploy_backup"
deploy_backup=""
echo "Deployed frontend and BFF commit $expected_commit from immutable release $release_dir"

#!/usr/bin/env bash
set -Eeuo pipefail

src="${1:-/srv/clankerdev-deploy/repo}"
expected_src="/srv/clankerdev-deploy/repo"
dst="/var/www/dev.crucio.cz/current"
nginx_conf_src="deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf"
nginx_conf_dst="/etc/nginx/sites-available/dev.crucio.cz"
bff_unit_src="deploy/dev.crucio.cz/webui-next-bff.service"
bff_unit_dst="/etc/systemd/system/webui-next-bff.service"

if [[ ! -d "$src/.git" ]]; then
  echo "Source is not a git checkout: $src" >&2
  exit 2
fi

canonical_src="$(readlink -f "$src")"
if [[ "$canonical_src" != "$expected_src" ]]; then
  echo "Refusing BFF/frontend source mismatch: expected $expected_src, got $canonical_src" >&2
  exit 2
fi

if [[ "$dst" != /var/www/dev.crucio.cz/current ]]; then
  echo "Refusing unexpected destination: $dst" >&2
  exit 2
fi

if [[ ! -f "$src/$bff_unit_src" ]]; then
  echo "Missing tracked BFF unit: $src/$bff_unit_src" >&2
  exit 2
fi

cd "$src"

systemd-analyze verify "$bff_unit_src"

npm ci
npm run build

if [[ -f bff/package-lock.json ]]; then
  npm --prefix bff ci --omit=dev
else
  npm --prefix bff install --omit=dev
fi

deploy_backup="$(mktemp -d /tmp/dev-crucio-deploy.XXXXXX)"
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

rollback_deploy() {
  local status=$?
  trap - ERR
  set +e
  echo "Deployment failed; restoring the previous frontend, nginx config and BFF unit" >&2

  install -d -m 0755 "$dst"
  rsync -a --delete "$deploy_backup/webroot/" "$dst/"

  if [[ "$nginx_conf_had_previous" -eq 1 ]]; then
    install -m 0644 "$deploy_backup/nginx-dev.crucio.cz.conf" "$nginx_conf_dst"
  else
    rm -f -- "$nginx_conf_dst" /etc/nginx/sites-enabled/dev.crucio.cz
  fi

  if [[ "$bff_unit_had_previous" -eq 1 ]]; then
    install -m 0644 "$deploy_backup/webui-next-bff.service" "$bff_unit_dst"
  else
    rm -f -- "$bff_unit_dst"
  fi

  nginx -t && systemctl reload nginx
  systemctl daemon-reload
  systemctl restart webui-next-bff.service
  rm -rf -- "$deploy_backup"
  exit "$status"
}
trap rollback_deploy ERR

install -d -m 0755 "$dst"
rsync -a --delete dist/ "$dst"/

if [[ -f "$nginx_conf_src" ]]; then
  install -m 0644 "$nginx_conf_src" "$nginx_conf_dst"
  ln -sfn "$nginx_conf_dst" /etc/nginx/sites-enabled/dev.crucio.cz
  nginx -t
  systemctl reload nginx
fi

install -m 0644 "$bff_unit_src" "$bff_unit_dst"
systemctl daemon-reload
systemctl restart webui-next-bff.service

expected_bff_workdir="$canonical_src/bff"
active_bff_workdir="$(systemctl show webui-next-bff.service --property=WorkingDirectory --value)"
active_bff_workdir="$(readlink -f "$active_bff_workdir")"
if [[ "$active_bff_workdir" != "$expected_bff_workdir" ]]; then
  echo "BFF source mismatch: expected $expected_bff_workdir, active $active_bff_workdir" >&2
  exit 1
fi

active_bff_exec="$(systemctl show webui-next-bff.service --property=ExecStart --value)"
if [[ "$active_bff_exec" != *"$canonical_src/bff/server.js"* ]]; then
  echo "BFF ExecStart mismatch: expected server below $canonical_src/bff" >&2
  exit 1
fi

bff_main_pid="$(systemctl show webui-next-bff.service --property=MainPID --value)"
if [[ ! "$bff_main_pid" =~ ^[1-9][0-9]*$ ]]; then
  echo "BFF has no running main process" >&2
  exit 1
fi
active_bff_process_cwd="$(readlink -f "/proc/$bff_main_pid/cwd")"
if [[ "$active_bff_process_cwd" != "$expected_bff_workdir" ]]; then
  echo "BFF process source mismatch: expected $expected_bff_workdir, active $active_bff_process_cwd" >&2
  exit 1
fi

echo "Checking public authentication endpoints..."
bash deploy/smoke-auth-endpoints.sh https://dev.crucio.cz --insecure

trap - ERR
rm -rf -- "$deploy_backup"

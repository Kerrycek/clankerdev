#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-password-recovery-runtime.sh
  install-password-recovery-runtime.sh --apply --confirm-mail-delivery

Installs the dev-only notification-template and password-recovery worker units.
The default mode is a dry run. Apply mode can drain queued recovery requests and
therefore requires an explicit acknowledgement that recovery mail may be sent.

Optional environment:
  ALLOW_NON_DEV_HOST=1       bypass the admin.crucio.cz host guard
  VPSADMIN_RELEASE_ROOT      default: /srv/vpsadmin-release/current
  SYSTEMD_UNIT_DIR           default: /etc/systemd/system
  INSTALL_LOCK_PATH          default: /run/lock/vpsadmin-password-recovery-install.lock
  QUEUE_WAIT_SECONDS         default: 20
EOF
}

apply=0
confirm_mail_delivery=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=1
      ;;
    --confirm-mail-delivery)
      confirm_mail_delivery=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release_root="${VPSADMIN_RELEASE_ROOT:-/srv/vpsadmin-release/current}"
unit_dir="${SYSTEMD_UNIT_DIR:-/etc/systemd/system}"
template_unit="vpsadmin-notification-templates.service"
worker_unit="vpsadmin-password-recovery.service"

if [ "$apply" -eq 0 ]; then
  cat <<EOF
DRY RUN: validate the active API release at ${release_root}
DRY RUN: verify the mailer, supervisor and API services
DRY RUN: install ${template_unit} and ${worker_unit} into ${unit_dir}
DRY RUN: install missing built-in notification templates
DRY RUN: enable and restart the password-recovery worker
DRY RUN: verify the worker release and wait for the recovery queue to drain

No files, services or database rows were changed.
Rerun with --apply --confirm-mail-delivery after reviewing the queued request
and confirming that the dev mail delivery path is safe.
EOF
  exit 0
fi

if [ "$confirm_mail_delivery" -ne 1 ]; then
  echo "Apply mode requires --confirm-mail-delivery because queued requests may send mail." >&2
  exit 2
fi

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Apply mode must run as root." >&2
  exit 1
fi

host="$(hostname -f 2>/dev/null || hostname)"
case "$host" in
  admin.crucio.cz|dev.crucio.cz|admin|dev)
    ;;
  *)
    if [ "${ALLOW_NON_DEV_HOST:-0}" != "1" ]; then
      echo "Refusing to run on non-dev host: $host" >&2
      exit 1
    fi
    ;;
esac

for command in flock install mktemp readlink systemctl systemd-analyze; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

lock_path="${INSTALL_LOCK_PATH:-/run/lock/vpsadmin-password-recovery-install.lock}"
if [ -L "$lock_path" ] || { [ -e "$lock_path" ] && [ ! -f "$lock_path" ]; }; then
  echo "Unsafe install lock target: $lock_path" >&2
  exit 1
fi
umask 077
exec 9>>"$lock_path"
if ! flock -n 9; then
  echo "Another password-recovery runtime installation is already running." >&2
  exit 1
fi

api_dir="${release_root}/api"
[ -d "$api_dir" ] || { echo "Missing active API release: $api_dir" >&2; exit 1; }
[ -x "$api_dir/bin/vpsadmin-password-recovery" ] || {
  echo "Active release does not contain the password-recovery worker" >&2
  exit 1
}
for template in password_recovery user_password_changed; do
  if [ ! -f "$api_dir/notification_templates/templates/$template/meta.rb" ]; then
    echo "Active release is missing notification template: $template" >&2
    exit 1
  fi
done

for service in vpsadmin-api.service vpsadmin-supervisor.service vpsadmin-mailer-nodectld.service; do
  if ! systemctl is-active --quiet "$service"; then
    echo "Required mail delivery dependency is not active: $service" >&2
    exit 1
  fi
done

systemd-analyze verify "$script_dir/$template_unit" "$script_dir/$worker_unit"

backup_dir="$(mktemp -d /tmp/vpsadmin-password-recovery-install.XXXXXX)"
old_template_enabled="$(systemctl is-enabled "$template_unit" 2>/dev/null || true)"
old_template_active="$(systemctl is-active "$template_unit" 2>/dev/null || true)"
old_worker_enabled="$(systemctl is-enabled "$worker_unit" 2>/dev/null || true)"
old_worker_active="$(systemctl is-active "$worker_unit" 2>/dev/null || true)"

backup_unit() {
  local unit="$1"
  if [ -f "$unit_dir/$unit" ]; then
    install -m 0600 "$unit_dir/$unit" "$backup_dir/$unit"
  else
    : >"$backup_dir/$unit.absent"
  fi
}

restore_unit() {
  local unit="$1"
  if [ -f "$backup_dir/$unit.absent" ]; then
    rm -f "$unit_dir/$unit"
  else
    install -m 0644 "$backup_dir/$unit" "$unit_dir/$unit"
  fi
}

restore_state() {
  local unit="$1"
  local enabled_state="$2"
  local active_state="$3"

  case "$enabled_state" in
    enabled|enabled-runtime|linked|linked-runtime)
      systemctl enable "$unit" >/dev/null 2>&1 || true
      ;;
    masked|masked-runtime)
      systemctl mask "$unit" >/dev/null 2>&1 || true
      ;;
    *)
      systemctl disable "$unit" >/dev/null 2>&1 || true
      ;;
  esac

  if [ "$active_state" = "active" ]; then
    systemctl restart "$unit" >/dev/null 2>&1 || true
  else
    systemctl stop "$unit" >/dev/null 2>&1 || true
  fi
}

rollback() {
  local status=$?
  trap - ERR
  set +e
  echo "Password-recovery runtime installation failed; restoring previous units." >&2
  systemctl stop "$worker_unit" >/dev/null 2>&1
  restore_unit "$template_unit"
  restore_unit "$worker_unit"
  systemctl daemon-reload
  restore_state "$template_unit" "$old_template_enabled" "$old_template_active"
  restore_state "$worker_unit" "$old_worker_enabled" "$old_worker_active"
  rm -rf -- "$backup_dir"
  exit "$status"
}

backup_unit "$template_unit"
backup_unit "$worker_unit"
trap rollback ERR

install -m 0644 "$script_dir/$template_unit" "$unit_dir/$template_unit"
install -m 0644 "$script_dir/$worker_unit" "$unit_dir/$worker_unit"
systemctl daemon-reload

# This idempotent oneshot must succeed before the worker is allowed to consume
# the queue. It creates missing built-in templates without overwriting existing
# operator-managed translations.
systemctl enable "$template_unit" >/dev/null
systemctl restart "$template_unit"
systemctl enable "$worker_unit" >/dev/null
systemctl restart "$worker_unit"

QUEUE_WAIT_SECONDS="${QUEUE_WAIT_SECONDS:-20}" \
  VPSADMIN_RELEASE_ROOT="$release_root" \
  "$script_dir/check-password-recovery-runtime.sh"

trap - ERR
rm -rf -- "$backup_dir"
echo "Password-recovery runtime installed and verified from $(readlink -f "$release_root")."

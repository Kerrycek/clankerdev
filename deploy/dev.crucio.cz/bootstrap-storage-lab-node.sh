#!/usr/bin/env bash
set -euo pipefail

# Dev-only helper for GitHub issue #121.
# Builds and registers a nested vpsAdminOS storage/NAS node for dev.crucio.cz.
# The default mode is a dry run.

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.crucio.cz/bootstrap-storage-lab-node.sh [--apply] [--no-start]

This script is intended for admin.crucio.cz only. It prepares a nested
vpsAdminOS storage node, starts it as a systemd service, then registers the
storage node and backup pool in the local test vpsAdmin DB only after the VM
service is active.

Default mode is dry-run. Review the plan, then rerun with --apply.

Optional environment:
  ALLOW_NON_DEV_HOST=1        bypass hostname guard
  LAB_ROOT                    default: /root/vpsadmin-dev-lab
  VPSADMINOS_ROOT             default: /root/vpsadminos
  VPSADMIN_ROOT               default: /opt/vpsadmin
  NODE_ID                     default: 104
  NODE_NAME                   default: vpsadmin-nas-storage1
  NODE_ADDR                   default: 10.0.0.5
  LOCATION_DOMAIN             default: nas-lab
  LOCATION_LABEL              default: dev NAS lab
  TAP_NAME                    default: tap-nas
  SERVICE_NAME                default: vpsadmin-nas-storage1.service
  POOL_ID                     default: 104
  POOL_LABEL                  default: dev NAS backup pool
  POOL_FILESYSTEM             default: tank/backup
  POOL_EXPORT_ROOT            default: /export
  POOL_MAX_DATASETS           default: 200
  DB_NAME                     default: vpsadmin
  DB_CLI                      default: mysql
  RABBITMQ_VHOST              default: vpsadmin_test
  RABBITMQ_NODE_PASSWORD_FILE default: /etc/vpsadmin-test/rabbitmq-node-password
  RABBITMQ_NODE_PASSWORD      override node password file
EOF
}

apply=0
start_service=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=1
      ;;
    --no-start)
      start_service=0
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

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

say() {
  printf '%s\n' "$*" >&2
}

run_or_print() {
  if [ "$apply" -eq 0 ]; then
    printf 'DRY RUN:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

write_file() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp"

  if [ "$apply" -eq 0 ]; then
    say "DRY RUN: write $path"
    sed 's/^/  | /' "$tmp" >&2
    rm -f "$tmp"
    return
  fi

  install -D -m 0644 "$tmp" "$path"
  rm -f "$tmp"
}

require_cmd hostname
require_cmd install
require_cmd mktemp

host="$(hostname -f 2>/dev/null || hostname)"
case "$host" in
  admin.crucio.cz|dev.crucio.cz|admin|dev)
    ;;
  *)
    if [ "${ALLOW_NON_DEV_HOST:-0}" != "1" ]; then
      echo "Refusing to run on non-dev host: $host" >&2
      echo "Set ALLOW_NON_DEV_HOST=1 only after confirming this is admin.crucio.cz." >&2
      exit 1
    fi
    ;;
esac

lab_root="${LAB_ROOT:-/root/vpsadmin-dev-lab}"
vpsadminos_root="${VPSADMINOS_ROOT:-/root/vpsadminos}"
vpsadmin_root="${VPSADMIN_ROOT:-/opt/vpsadmin}"
node_id="${NODE_ID:-104}"
node_name="${NODE_NAME:-vpsadmin-nas-storage1}"
node_addr="${NODE_ADDR:-10.0.0.5}"
services_addr="${SERVICES_ADDR:-10.0.0.1}"
location_domain="${LOCATION_DOMAIN:-nas-lab}"
location_label="${LOCATION_LABEL:-dev NAS lab}"
tap_name="${TAP_NAME:-tap-nas}"
service_name="${SERVICE_NAME:-${node_name}.service}"
pool_id="${POOL_ID:-104}"
pool_label="${POOL_LABEL:-dev NAS backup pool}"
pool_filesystem="${POOL_FILESYSTEM:-tank/backup}"
pool_export_root="${POOL_EXPORT_ROOT:-/export}"
pool_max_datasets="${POOL_MAX_DATASETS:-200}"
db_name="${DB_NAME:-vpsadmin}"
db_cli="${DB_CLI:-mysql}"
rabbitmq_vhost="${RABBITMQ_VHOST:-vpsadmin_test}"
rabbitmq_node_password_file="${RABBITMQ_NODE_PASSWORD_FILE:-/etc/vpsadmin-test/rabbitmq-node-password}"
rabbitmq_user="${node_name}.${location_domain}"

node_dir="${lab_root}/${node_name}"
nix_config="${lab_root}/${node_name}.nix"
qemu_script="${lab_root}/${node_name}-qemu-script"
systemd_unit="/etc/systemd/system/${service_name}"

say "Storage lab node target: ${node_name}.${location_domain} (${node_addr}), node #${node_id}"
if [ "$apply" -eq 0 ]; then
  say "Mode: dry run. Rerun with --apply to write files, build, start, and seed."
else
  say "Mode: apply."
fi

if [ "$apply" -eq 1 ]; then
  require_cmd "$db_cli"
  require_cmd nix
  require_cmd systemctl
  require_cmd rabbitmqctl
  [ -d "$vpsadminos_root" ] || { echo "Missing VPSADMINOS_ROOT: $vpsadminos_root" >&2; exit 1; }
  [ -d "$vpsadmin_root" ] || { echo "Missing VPSADMIN_ROOT: $vpsadmin_root" >&2; exit 1; }
fi

write_file "$nix_config" <<EOF
{ config, pkgs, lib, ... }:
{
  imports = [
    ${vpsadminos_root}/tests/configs/vpsadminos/pool-tank.nix
    ${vpsadmin_root}/tests/configs/vpsadminos/node.nix
  ];

  options.system.vpsadminos.rubyCrashReportTemplate = lib.mkOption {
    type = lib.types.nullOr lib.types.str;
    default = null;
  };

  config = {
    services.openssh.enable = true;

    networking.hostId = builtins.substring 0 8 (builtins.hashString "md5" "${node_name}");
    networking.hostName = "${node_name}";

    users.users.root.openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILAJZl3Qo06EkAvKwtNpPJUL4jVVMTpwN3kOEfjvVp84 root@vpsadmin-services github"
    ];

    boot.qemu.stateDir = "${node_dir}";
    boot.qemu.memory = 4096;
    boot.qemu.cpus = 2;
    boot.qemu.cpu.cores = 2;
    boot.qemu.cpu.threads = 1;
    boot.qemu.cpu.sockets = 1;
    boot.qemu.disks = [
      {
        device = "node-nas.img";
        type = "file";
        size = "160G";
        create = true;
      }
    ];
    boot.qemu.extraQemuOptions = [
      "-device" "virtio-net,netdev=net1"
      "-netdev" "tap,id=net1,ifname=${tap_name},script=no,downscript=no"
    ];

    boot.zfs.pools.tank.datasets = {
      "/" = {
        properties = {
          compression = "on";
          acltype = "posixacl";
        };
      };
      "backup" = {
        properties = {
          compression = "zstd";
          refquota = "120G";
        };
      };
      "backup/webui-next-smoke".properties.quota = "10G";
      "backup/webui-next-restore".properties.quota = "10G";
      "backup/webui-next-datasets".properties.quota = "20G";
    };

    vpsadmin.test.node = {
      socketAddress = "${node_addr}";
      servicesAddress = "${services_addr}";
      nodeId = ${node_id};
      nodeName = "${node_name}";
      locationDomain = "${location_domain}";
      socketPeers = {
        vpsadmin-services = "${services_addr}";
        vpsadmin-prod-node1 = "10.0.0.3";
        vpsadmin-playground-node1 = "10.0.0.4";
      };
    };
  };
}
EOF

write_file "$systemd_unit" <<EOF
[Unit]
Description=vpsAdminOS nested dev-lab storage node ${node_name}
After=network-online.target mariadb.service rabbitmq-server.service
Wants=network-online.target rabbitmq-server.service mariadb.service

[Service]
Type=simple
ExecStartPre=/usr/bin/bash -lc '${lab_root}/ensure-tap.sh ${tap_name}'
ExecStart=${qemu_script}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [ "$apply" -eq 0 ]; then
  say "DRY RUN: build QEMU script with VPSADMINOS_CONFIG=$nix_config nix build --impure --out-link ${lab_root}/result-${node_name}-qemu-script ${vpsadminos_root}#qemu-script"
else
  install -d "$node_dir"
  out_link="${lab_root}/result-${node_name}-qemu-script"
  VPSADMINOS_CONFIG="$nix_config" nix build --impure --out-link "$out_link" "${vpsadminos_root}#qemu-script"
  install -m 0755 "$out_link" "$qemu_script"
  systemctl daemon-reload
  systemctl enable "$service_name"
fi

if [ "$start_service" -eq 1 ]; then
  run_or_print systemctl start "$service_name"
  if [ "$apply" -eq 1 ]; then
    systemctl is-active --quiet "$service_name"
  fi
else
  say "Skipping service start because --no-start was set."
fi

sql="$(cat <<EOF
SET @node_id := ${node_id};
SET @pool_id := ${pool_id};
SET @node_name := '${node_name}';
SET @node_addr := '${node_addr}';
SET @location_domain := '${location_domain}';
SET @location_label := '${location_label}';
SET @pool_label := '${pool_label}';
SET @pool_filesystem := '${pool_filesystem}';
SET @pool_export_root := '${pool_export_root}';
SET @pool_max_datasets := ${pool_max_datasets};
SET @environment_id := (SELECT id FROM environments ORDER BY id LIMIT 1);

INSERT INTO locations (
  label, domain, description, environment_id, remote_console_server,
  has_ipv6, maintenance_lock, created_at, updated_at
)
SELECT
  @location_label, @location_domain,
  'dev.crucio.cz storage/NAS lab location for issue #121',
  @environment_id, 'http://console.vpsadmin.test',
  0, 0, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE domain = @location_domain
);

SET @location_id := (SELECT id FROM locations WHERE domain = @location_domain LIMIT 1);

INSERT INTO nodes (
  id, name, ip_addr, location_id, role, hypervisor_type, active,
  cpus, total_memory, total_swap, max_vps, maintenance_lock,
  max_rx, max_tx
)
VALUES (
  @node_id, @node_name, @node_addr, @location_id, 1, 1, 1,
  2, 4096, 0, NULL, 0,
  235929600, 235929600
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  ip_addr = VALUES(ip_addr),
  location_id = VALUES(location_id),
  role = VALUES(role),
  hypervisor_type = VALUES(hypervisor_type),
  active = VALUES(active),
  cpus = VALUES(cpus),
  total_memory = VALUES(total_memory),
  total_swap = VALUES(total_swap);

INSERT INTO pools (
  id, node_id, label, filesystem, export_root, role, is_open,
  refquota_check, max_datasets, maintenance_lock, state, scan
)
VALUES (
  @pool_id, @node_id, @pool_label, @pool_filesystem, @pool_export_root, 2, 1,
  1, @pool_max_datasets, 0, 0, 0
)
ON DUPLICATE KEY UPDATE
  node_id = VALUES(node_id),
  label = VALUES(label),
  filesystem = VALUES(filesystem),
  export_root = VALUES(export_root),
  role = VALUES(role),
  is_open = VALUES(is_open),
  refquota_check = VALUES(refquota_check),
  max_datasets = VALUES(max_datasets),
  maintenance_lock = VALUES(maintenance_lock);
EOF
)"

if [ "$apply" -eq 0 ]; then
  say "DRY RUN: seed local vpsAdmin DB ${db_name}"
  sed 's/^/  | /' <<<"$sql" >&2
else
  "$db_cli" "$db_name" <<<"$sql"
fi

if [ "$apply" -eq 0 ]; then
  say "DRY RUN: ensure RabbitMQ node user ${rabbitmq_user} on vhost ${rabbitmq_vhost}"
else
  if [ -n "${RABBITMQ_NODE_PASSWORD:-}" ]; then
    rabbitmq_node_password="$RABBITMQ_NODE_PASSWORD"
  else
    rabbitmq_node_password="$(head -n1 "$rabbitmq_node_password_file")"
  fi

  if rabbitmqctl list_users --silent | awk '{print $1}' | grep -Fxq "$rabbitmq_user"; then
    rabbitmqctl change_password "$rabbitmq_user" "$rabbitmq_node_password"
  else
    rabbitmqctl add_user "$rabbitmq_user" "$rabbitmq_node_password"
  fi
  rabbitmqctl set_permissions -p "$rabbitmq_vhost" "$rabbitmq_user" '.*' '.*' '.*'
fi

if [ "$apply" -eq 1 ] && [ "$start_service" -eq 1 ]; then
  systemctl restart "$service_name"
  systemctl is-active --quiet "$service_name"
fi

cat <<EOF

Next verification on admin.crucio.cz:
  systemctl status ${service_name} --no-pager
  ssh root@${node_addr} 'svctl status nodectld || systemctl status nodectld --no-pager; zpool status tank; zfs list tank/backup'
  rabbitmqctl list_queues -p ${rabbitmq_vhost} name messages consumers | grep 'node:${rabbitmq_user}'
  ${db_cli} ${db_name} -e "SELECT id,name,role,ip_addr FROM nodes WHERE id=${node_id}; SELECT node_id,updated_at,pool_state,pool_checked_at FROM node_current_statuses WHERE node_id=${node_id}; SELECT id,label,filesystem,role,state,checked_at,total_space,available_space FROM pools WHERE id=${pool_id};"
EOF

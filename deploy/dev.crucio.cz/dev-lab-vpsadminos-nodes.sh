#!/usr/bin/env bash
set -euo pipefail

# Bootstrap additional nested vpsAdminOS nodes for the dev.crucio.cz lab.
# Run on admin.crucio.cz / 172.16.106.176 as root.

LAB_DIR=${LAB_DIR:-/root/vpsadmin-dev-lab}
VPSADMINOS_OS_DIR=${VPSADMINOS_OS_DIR:-/root/vpsadminos/os}
: "${NIX_CMD:=/nix/var/nix/profiles/default/bin/nix --extra-experimental-features nix-command --extra-experimental-features flakes}"
DB_NAME=${DB_NAME:-vpsadmin}
DB_USER=${DB_USER:-api}
DB_PASS=${DB_PASS:-testMariadbApiPassword}
RABBIT_VHOST=${RABBIT_VHOST:-vpsadmin_test}
RABBIT_NODE_PASS=${RABBIT_NODE_PASS:-testRabbitmqNodePassword}
BRIDGE=${BRIDGE:-br-vpsadmin}
SERVICES_ADDR=${SERVICES_ADDR:-10.0.0.1}

backup_db() {
  local ts backup
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p /root/backups
  backup="/root/backups/vpsadmin-before-dev-lab-${ts}.sql.gz"
  echo "Creating DB backup at ${backup}"
  mysqldump -u "${DB_USER}" "-p${DB_PASS}" "${DB_NAME}" | gzip -9 > "${backup}"
}

ensure_bridge_tap() {
  local tap=$1

  ip link show "${BRIDGE}" >/dev/null 2>&1 || ip link add "${BRIDGE}" type bridge
  ip addr show dev "${BRIDGE}" | grep -q "${SERVICES_ADDR}/24" || ip addr add "${SERVICES_ADDR}/24" dev "${BRIDGE}"
  ip link set "${BRIDGE}" up

  ip link show "${tap}" >/dev/null 2>&1 || ip tuntap add dev "${tap}" mode tap
  ip link set "${tap}" master "${BRIDGE}"
  ip link set "${tap}" up
}

write_node_config() {
  local node_id=$1 node_name=$2 node_addr=$3 location_domain=$4 tap=$5 disk=$6 memory=$7 cpus=$8
  local config="${LAB_DIR}/${node_name}.nix"

  mkdir -p "${LAB_DIR}"
  cat > "${config}" <<EOF
{ config, pkgs, lib, ... }:
{
  imports = [
    /root/vpsadminos/tests/configs/vpsadminos/pool-tank.nix
    /opt/vpsadmin/tests/configs/vpsadminos/node.nix
  ];

  options.system.vpsadminos.rubyCrashReportTemplate = lib.mkOption {
    type = lib.types.nullOr lib.types.str;
    default = null;
  };

  config = {
    services.openssh.enable = true;
    systemd.tmpfiles.rules = [
      "d /tank/ct/vpsadmin 0755 root root -"
      "d /tank/ct/vpsadmin/config 0755 root root -"
      "d /tank/ct/vpsadmin/config/users 0755 root root -"
      "d /tank/ct/vpsadmin/config/vps 0755 root root -"
      "d /tank/ct/vpsadmin/download 0755 root root -"
      "d /tank/ct/vpsadmin/mount 0755 root root -"
    ];

    networking.hostId = builtins.substring 0 8 (builtins.hashString "md5" "${node_name}");
    networking.hostName = "${node_name}";

    users.users.root.openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILAJZl3Qo06EkAvKwtNpPJUL4jVVMTpwN3kOEfjvVp84 root@vpsadmin-services github"
    ];

    boot.qemu.stateDir = "${LAB_DIR}/${node_name}";
    boot.qemu.memory = ${memory};
    boot.qemu.cpus = ${cpus};
    boot.qemu.cpu.cores = ${cpus};
    boot.qemu.cpu.threads = 1;
    boot.qemu.cpu.sockets = 1;
    boot.qemu.disks = [
      {
        device = "${disk}";
        type = "file";
        size = "120G";
        create = true;
      }
    ];
    boot.qemu.extraQemuOptions = [
      "-device" "virtio-net,netdev=net1"
      "-netdev" "tap,id=net1,ifname=${tap},script=no,downscript=no"
    ];

    vpsadmin.test.node = {
      socketAddress = "${node_addr}";
      servicesAddress = "${SERVICES_ADDR}";
      nodeId = ${node_id};
      nodeName = "${node_name}";
      locationDomain = "${location_domain}";
      socketPeers = {
        vpsadmin-services = "${SERVICES_ADDR}";
      };
    };
  };
}
EOF

  echo "${config}"
}

build_qemu_script() {
  local config=$1 node_name=$2 ssh_port=$3
  local out="${LAB_DIR}/${node_name}-qemu-script"

  echo "Building qemu script for ${node_name}"
  (cd "${VPSADMINOS_OS_DIR}" && VPSADMINOS_CONFIG="${config}" NIX="${NIX_CMD}" make build-qemu-script)
  cp -L "${VPSADMINOS_OS_DIR}/result/qemu-script" "${out}"
  chmod 0755 "${out}"
  sed -i \
    -e "s/-name vpsadminos /-name ${node_name} /" \
    -e "s/hostfwd=tcp::2222-:22/hostfwd=tcp::${ssh_port}-:22/" \
    "${out}"
}

write_systemd_unit() {
  local node_name=$1 tap=$2
  local unit="/etc/systemd/system/vpsadminos-${node_name}.service"

  cat > "${unit}" <<EOF
[Unit]
Description=vpsAdminOS nested dev-lab node ${node_name}
After=network-online.target mariadb.service rabbitmq-server.service
Wants=network-online.target rabbitmq-server.service mariadb.service

[Service]
Type=simple
ExecStartPre=/usr/bin/bash -lc '${LAB_DIR}/ensure-tap.sh ${tap}'
ExecStart=${LAB_DIR}/${node_name}-qemu-script
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
}

write_tap_helper() {
  mkdir -p "${LAB_DIR}"
  cat > "${LAB_DIR}/ensure-tap.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
tap=$1
bridge=${BRIDGE:-br-vpsadmin}
addr=${SERVICES_ADDR:-10.0.0.1}

ip link show "${bridge}" >/dev/null 2>&1 || ip link add "${bridge}" type bridge
ip addr show dev "${bridge}" | grep -q "${addr}/24" || ip addr add "${addr}/24" dev "${bridge}"
ip link set "${bridge}" up

ip link show "${tap}" >/dev/null 2>&1 || ip tuntap add dev "${tap}" mode tap
ip link set "${tap}" master "${bridge}"
ip link set "${tap}" up
EOF
  chmod 0755 "${LAB_DIR}/ensure-tap.sh"
}

mysql_exec() {
  mysql -u "${DB_USER}" "-p${DB_PASS}" "${DB_NAME}" "$@"
}

seed_db() {
  echo "Seeding dev-lab environments, locations, nodes, pools, and networks"
  mysql_exec <<'SQL'
SET @now = NOW();

INSERT INTO environments (id, label, domain, can_create_vps, can_destroy_vps, vps_lifetime, max_vps_count, user_ip_ownership, description, created_at, updated_at)
VALUES
  (10, 'production-lab', 'prod.vpsadmin.test', 1, 1, 0, 50, 0, 'Dev lab production-like environment', @now, @now),
  (11, 'playground-lab', 'playground.vpsadmin.test', 1, 1, 14, 50, 0, 'Dev lab playground/staging environment', @now, @now)
ON DUPLICATE KEY UPDATE
  can_create_vps = VALUES(can_create_vps),
  can_destroy_vps = VALUES(can_destroy_vps),
  max_vps_count = VALUES(max_vps_count),
  updated_at = @now;

INSERT INTO locations (id, label, has_ipv6, remote_console_server, domain, environment_id, description, created_at, updated_at)
VALUES
  (10, 'Praha lab', 1, 'https://dev.crucio.cz', 'prg-lab', 10, 'Production-like dev lab location', @now, @now),
  (11, 'Playground lab', 1, 'https://dev.crucio.cz', 'pg-lab', 11, 'Playground/staging dev lab location', @now, @now)
ON DUPLICATE KEY UPDATE
  has_ipv6 = VALUES(has_ipv6),
  remote_console_server = VALUES(remote_console_server),
  description = VALUES(description),
  updated_at = @now;

INSERT INTO nodes (id, name, location_id, ip_addr, max_vps, cpus, total_memory, total_swap, role, hypervisor_type, active)
VALUES
  (102, 'vpsadmin-prod-node1', 10, '10.0.0.3', 80, 4, 8192, 0, 0, 1, 0),
  (103, 'vpsadmin-playground-node1', 11, '10.0.0.4', 80, 4, 8192, 0, 0, 1, 0)
ON DUPLICATE KEY UPDATE
  location_id = VALUES(location_id),
  ip_addr = VALUES(ip_addr),
  max_vps = VALUES(max_vps),
  cpus = VALUES(cpus),
  total_memory = VALUES(total_memory),
  total_swap = VALUES(total_swap),
  role = VALUES(role),
  hypervisor_type = VALUES(hypervisor_type),
  active = VALUES(active);

INSERT INTO pools (id, node_id, label, filesystem, role, max_datasets, state, scan, is_open, checked_at)
VALUES
  (102, 102, 'tank', 'tank/ct', 0, 1000, 1, 1, 1, @now),
  (103, 103, 'tank', 'tank/ct', 0, 1000, 1, 1, 1, @now)
ON DUPLICATE KEY UPDATE
  node_id = VALUES(node_id),
  label = VALUES(label),
  filesystem = VALUES(filesystem),
  role = VALUES(role),
  max_datasets = VALUES(max_datasets),
  is_open = VALUES(is_open);

INSERT INTO dataset_properties (pool_id, dataset_id, dataset_in_pool_id, ancestry, ancestry_depth, name, value, inherited, confirmed, created_at, updated_at)
SELECT dst.pool_id, NULL, NULL, NULL, 0, src.name, src.value, 0, src.confirmed, @now, @now
FROM (
  SELECT 102 AS pool_id
  UNION ALL
  SELECT 103 AS pool_id
) dst
JOIN dataset_properties src
  ON src.pool_id = 1
 AND src.dataset_id IS NULL
 AND src.dataset_in_pool_id IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM dataset_properties existing
  WHERE existing.pool_id = dst.pool_id
    AND existing.dataset_id IS NULL
    AND existing.dataset_in_pool_id IS NULL
    AND existing.name = src.name
);

INSERT IGNORE INTO port_reservations (node_id, port)
SELECT 102, 10000 + seq.n
FROM (
  SELECT ones.n + tens.n * 10 AS n
  FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) ones
  CROSS JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) tens
) seq;

INSERT IGNORE INTO port_reservations (node_id, port)
SELECT 103, 10000 + seq.n
FROM (
  SELECT ones.n + tens.n * 10 AS n
  FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) ones
  CROSS JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) tens
) seq;

INSERT INTO networks (id, label, address, prefix, ip_version, role, managed, split_access, split_prefix, purpose, primary_location_id)
VALUES
  (110, 'dev-lab-public-198.51.100.0/24', '198.51.100.0', 24, 4, 0, 1, 0, 29, 1, 10),
  (111, 'dev-lab-private-10.107.0.0/24', '10.107.0.0', 24, 4, 1, 1, 0, 32, 1, 10),
  (112, 'dev-lab-ipv6-2001:db8:107::/64', '2001:db8:107::', 64, 6, 0, 1, 0, 124, 1, 10),
  (113, 'dev-lab-playground-public-198.51.101.0/24', '198.51.101.0', 24, 4, 0, 1, 0, 29, 1, 11),
  (114, 'dev-lab-playground-private-10.108.0.0/24', '10.108.0.0', 24, 4, 1, 1, 0, 32, 1, 11),
  (115, 'dev-lab-playground-ipv6-2001:db8:108::/64', '2001:db8:108::', 64, 6, 0, 1, 0, 124, 1, 11)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  managed = VALUES(managed),
  primary_location_id = VALUES(primary_location_id);

INSERT IGNORE INTO location_networks (location_id, network_id, `primary`, priority, autopick, userpick)
VALUES
  (10, 110, 1, 10, 1, 1),
  (10, 111, 1, 20, 1, 1),
  (10, 112, 1, 30, 1, 1),
  (11, 113, 1, 10, 1, 1),
  (11, 114, 1, 20, 1, 1),
  (11, 115, 1, 30, 1, 1);
SQL

  add_ip_blocks 110 10 "198.51.100" 0 8 29
  add_ip_blocks 111 10 "10.107.0" 10 20 32
  add_ip_blocks 113 11 "198.51.101" 0 8 29
  add_ip_blocks 114 11 "10.108.0" 10 20 32
  add_ipv6_blocks 112 10 "2001:db8:107::" 0 8
  add_ipv6_blocks 115 11 "2001:db8:108::" 0 8
}

add_ip_blocks() {
  local network_id=$1 _location_id=$2 prefix=$3 start=$4 count=$5 mask=$6
  local i addr
  for ((i = 0; i < count; i++)); do
    addr="${prefix}.$((start + i * (mask == 29 ? 8 : 1)))"
    mysql_exec <<SQL
INSERT INTO ip_addresses (network_id, ip_addr, prefix, size, \`order\`)
SELECT ${network_id}, '${addr}', ${mask}, $((2 ** (32 - mask))), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ip_addresses WHERE network_id = ${network_id} AND ip_addr = '${addr}'
);
SQL
  done
}

add_ipv6_blocks() {
  local network_id=$1 _location_id=$2 prefix=$3 start=$4 count=$5
  local i addr suffix
  for ((i = 0; i < count; i++)); do
    suffix=$(printf '%x' $((start + i * 16)))
    addr="${prefix}${suffix}"
    mysql_exec <<SQL
INSERT INTO ip_addresses (network_id, ip_addr, prefix, size, \`order\`)
SELECT ${network_id}, '${addr}', 124, 16, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ip_addresses WHERE network_id = ${network_id} AND ip_addr = '${addr}'
);
SQL
  done
}

ensure_rabbit_user() {
  local fqdn=$1
  rabbitmqctl add_user "${fqdn}" "${RABBIT_NODE_PASS}" >/dev/null 2>&1 || rabbitmqctl change_password "${fqdn}" "${RABBIT_NODE_PASS}"
  rabbitmqctl set_permissions -p "${RABBIT_VHOST}" "${fqdn}" '.*' '.*' '.*' >/dev/null
}

setup_node() {
  local node_id=$1 node_name=$2 node_addr=$3 location_domain=$4 tap=$5 disk=$6 ssh_port=$7 memory=${8:-4096} cpus=${9:-2}
  local config

  ensure_bridge_tap "${tap}"
  ensure_rabbit_user "${node_name}.${location_domain}"
  config=$(write_node_config "${node_id}" "${node_name}" "${node_addr}" "${location_domain}" "${tap}" "${disk}" "${memory}" "${cpus}")
  build_qemu_script "${config}" "${node_name}" "${ssh_port}"
  write_systemd_unit "${node_name}" "${tap}"
}

main() {
  if [[ ${EUID} -ne 0 ]]; then
    echo "Run as root" >&2
    exit 1
  fi

  backup_db
  write_tap_helper
  seed_db

  setup_node 102 vpsadmin-prod-node1 10.0.0.3 prg-lab tap-prod node-prod.img 2223 4096 2
  setup_node 103 vpsadmin-playground-node1 10.0.0.4 pg-lab tap-play node-playground.img 2224 4096 2

  systemctl daemon-reload
  systemctl enable --now vpsadminos-vpsadmin-prod-node1.service
  systemctl enable --now vpsadminos-vpsadmin-playground-node1.service

  echo "Restarting vpsAdmin supervisor so it subscribes to newly added node queues"
  systemctl restart vpsadmin-supervisor

  echo "Waiting for node status reports"
  sleep 90
  mysql_exec -e "UPDATE nodes JOIN node_current_statuses ON node_current_statuses.node_id=nodes.id SET nodes.active=1 WHERE nodes.id IN (102,103) AND node_current_statuses.updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE);"
  mysql_exec -e "SELECT nodes.id,nodes.name,nodes.ip_addr,nodes.active,node_current_statuses.updated_at,node_current_statuses.cgroup_version FROM nodes LEFT JOIN node_current_statuses ON node_current_statuses.node_id=nodes.id WHERE nodes.id IN (101,102,103);"
  systemctl --no-pager --full status vpsadminos-vpsadmin-prod-node1.service vpsadminos-vpsadmin-playground-node1.service || true
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

# Dev-only helper for dataset snapshot downloads on dev.crucio.cz.
# Production uses vpsadmin-download-mounter. The dev lab is assembled from
# nested test nodes, so keep the required NFS mounts explicit and auditable.

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.crucio.cz/mount-snapshot-downloads.sh [--strict]

Options:
  --strict  fail when a configured pool cannot be mounted

Optional environment:
  ALLOW_NON_DEV_HOST=1  bypass hostname guard
  WEB_DOWNLOAD_ROOT     default: /var/lib/web/download
  MOUNT_OPTIONS         default: vers=3,nolock
  PUBLIC_BASE_URL       default: https://dev.crucio.cz/download
EOF
}

strict=0
case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  --strict)
    strict=1
    ;;
  "")
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

host="$(hostname -f 2>/dev/null || hostname)"
case "$host" in
  admin.crucio.cz|dev.crucio.cz|admin|dev|kerrykdev|kerrykdev.*)
    ;;
  *)
    if [ "${ALLOW_NON_DEV_HOST:-0}" != "1" ]; then
      echo "Refusing to run on non-dev host: $host" >&2
      echo "Set ALLOW_NON_DEV_HOST=1 only after confirming this is admin.crucio.cz." >&2
      exit 1
    fi
    ;;
esac

web_download_root="${WEB_DOWNLOAD_ROOT:-/var/lib/web/download}"
mount_options="${MOUNT_OPTIONS:-vers=3,nolock}"
public_base_url="${PUBLIC_BASE_URL:-https://dev.crucio.cz/download}"

pool_specs=(
  "1|vpsadmin-hypervisor-test.prg2.vpsadmin.test|10.0.0.2:/tank/ct/vpsadmin/download"
  "102|vpsadmin-prod-node1.prg-lab.vpsadmin.test|10.0.0.3:/tank/ct/vpsadmin/download"
  "103|vpsadmin-playground-node1.pg-lab.vpsadmin.test|10.0.0.4:/tank/ct/vpsadmin/download"
  "104|vpsadmin-nas-storage1.nas-lab.vpsadmin.test|10.0.0.5:/tank/backup/vpsadmin/download"
  "105|vpsadmin-nas-storage1.nas-lab.vpsadmin.test|10.0.0.5:/tank/nas/vpsadmin/download"
)

status=0

for spec in "${pool_specs[@]}"; do
  IFS='|' read -r pool_id node_domain nfs_source <<<"$spec"
  mountpoint_path="${web_download_root}/${node_domain}/${pool_id}"
  health_url="${public_base_url}/${node_domain}/${pool_id}/_vpsadmin-download-healthcheck"

  install -d -m 0755 "$mountpoint_path"

  if mountpoint -q "$mountpoint_path"; then
    echo "Already mounted: $mountpoint_path"
  else
    echo "Mounting pool ${pool_id}: ${nfs_source} -> ${mountpoint_path}"
    if ! timeout 20 mount -t nfs -o "$mount_options" "$nfs_source" "$mountpoint_path"; then
      echo "WARN: failed to mount pool ${pool_id} from ${nfs_source}" >&2
      status=1
      continue
    fi
  fi

  findmnt "$mountpoint_path"

  if command -v curl >/dev/null 2>&1; then
    if curl -kfsS --max-time 15 "$health_url" >/dev/null; then
      echo "Healthcheck OK: $health_url"
    else
      echo "WARN: healthcheck failed: $health_url" >&2
      status=1
    fi
  fi
done

if [ "$strict" = "1" ]; then
  exit "$status"
fi

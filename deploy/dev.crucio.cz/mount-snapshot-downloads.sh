#!/usr/bin/env bash
set -euo pipefail

# Dev-only helper for dataset snapshot downloads on dev.crucio.cz.
# The real deployment uses vpsadmin-download-mounter for all pools. The dev
# NAS lab currently needs the primary NAS pool mounted explicitly so snapshot
# download URLs are visible below /download/.

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.crucio.cz/mount-snapshot-downloads.sh

Optional environment:
  ALLOW_NON_DEV_HOST=1  bypass hostname guard
  WEB_DOWNLOAD_ROOT     default: /var/lib/web/download
  NODE_DOMAIN           default: vpsadmin-nas-storage1.nas-lab.vpsadmin.test
  POOL_ID               default: 105
  NFS_SOURCE            default: 10.0.0.5:/tank/nas/vpsadmin/download
  MOUNT_OPTIONS         default: vers=3,nolock
  PUBLIC_BASE_URL       default: https://dev.crucio.cz/download
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

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
node_domain="${NODE_DOMAIN:-vpsadmin-nas-storage1.nas-lab.vpsadmin.test}"
pool_id="${POOL_ID:-105}"
nfs_source="${NFS_SOURCE:-10.0.0.5:/tank/nas/vpsadmin/download}"
mount_options="${MOUNT_OPTIONS:-vers=3,nolock}"
public_base_url="${PUBLIC_BASE_URL:-https://dev.crucio.cz/download}"
mountpoint_path="${web_download_root}/${node_domain}/${pool_id}"
health_url="${public_base_url}/${node_domain}/${pool_id}/_vpsadmin-download-healthcheck"

install -d -m 0755 "$mountpoint_path"

if mountpoint -q "$mountpoint_path"; then
  echo "Already mounted: $mountpoint_path"
else
  mount -t nfs -o "$mount_options" "$nfs_source" "$mountpoint_path"
fi

findmnt "$mountpoint_path"

if command -v curl >/dev/null 2>&1; then
  curl -kfsS "$health_url" >/dev/null
  echo "Healthcheck OK: $health_url"
fi

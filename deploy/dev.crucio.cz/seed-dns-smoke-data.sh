#!/usr/bin/env bash
set -euo pipefail

# Dev-only helper for GitHub issue #122.
# Seeds harmless DNS rows for dev.crucio.cz UI smoke tests through the local
# vpsAdmin API. The default mode is a dry run.

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.crucio.cz/seed-dns-smoke-data.sh [--apply]

Required environment:
  SMOKE_USER_ID                 user that should own the test DNS zones
  SMOKE_DNS_NODE_ID             existing dev-lab node for the DNS server row

Optional environment:
  API_BASE_URL                  default: http://127.0.0.1:9292/v7.0
  API_AUTH_HEADER               full auth header, e.g. "X-VpsAdmin-Session: ..."
  SMOKE_DNS_SERVER_ID           reuse an existing DNS server instead of creating one
  SMOKE_DNS_SERVER_NAME         default: ns-dev-lab
  SMOKE_DNS_SERVER_IPV4         default: 172.16.106.176
  SMOKE_FORWARD_ZONE            default: webui-next-dns-smoke.dev.crucio.cz
  SMOKE_REVERSE_ZONE            default: 113.0.203.in-addr.arpa
  SMOKE_REVERSE_NETWORK_ADDR    default: 203.0.113.0
  SMOKE_REVERSE_NETWORK_PREFIX  default: 24
  SMOKE_ZONE_EMAIL              default: hostmaster.dev.crucio.cz
  SMOKE_FORWARD_RECORD_NAME     default: www
  SMOKE_FORWARD_RECORD_ADDR     default: 203.0.113.23
  SMOKE_PTR_RECORD_NAME         default: 23
  SMOKE_PTR_RECORD_VALUE        default: vps-test.dev.crucio.cz.
  ALLOW_NON_DEV_API=1           allow API URLs outside localhost/dev.crucio.cz

The script is intentionally outside normal app runtime. Run it only against the
dev/test API, review the dry-run output first, then rerun with --apply.
EOF
}

apply=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=1
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

require_env() {
  if [ -z "${!1:-}" ]; then
    echo "Missing required environment: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_env SMOKE_USER_ID
require_env SMOKE_DNS_NODE_ID

api_base_url="${API_BASE_URL:-http://127.0.0.1:9292/v7.0}"
dns_server_id="${SMOKE_DNS_SERVER_ID:-}"
dns_server_name="${SMOKE_DNS_SERVER_NAME:-ns-dev-lab}"
dns_server_ipv4="${SMOKE_DNS_SERVER_IPV4:-172.16.106.176}"
forward_zone="${SMOKE_FORWARD_ZONE:-webui-next-dns-smoke.dev.crucio.cz}"
reverse_zone="${SMOKE_REVERSE_ZONE:-113.0.203.in-addr.arpa}"
reverse_network_addr="${SMOKE_REVERSE_NETWORK_ADDR:-203.0.113.0}"
reverse_network_prefix="${SMOKE_REVERSE_NETWORK_PREFIX:-24}"
zone_email="${SMOKE_ZONE_EMAIL:-hostmaster.dev.crucio.cz}"
forward_record_name="${SMOKE_FORWARD_RECORD_NAME:-www}"
forward_record_addr="${SMOKE_FORWARD_RECORD_ADDR:-203.0.113.23}"
ptr_record_name="${SMOKE_PTR_RECORD_NAME:-23}"
ptr_record_value="${SMOKE_PTR_RECORD_VALUE:-vps-test.dev.crucio.cz.}"

case "$api_base_url" in
  http://127.0.0.1:*|http://localhost:*|https://dev.crucio.cz/*|http://dev.crucio.cz/*)
    ;;
  *)
    if [ "${ALLOW_NON_DEV_API:-0}" != "1" ]; then
      echo "Refusing non-dev API URL: $api_base_url" >&2
      echo "Set ALLOW_NON_DEV_API=1 only after confirming this is not production." >&2
      exit 1
    fi
    ;;
esac

curl_args=(-fsS -H "Accept: application/json" -H "Content-Type: application/json")
if [ -n "${API_AUTH_HEADER:-}" ]; then
  curl_args+=(-H "$API_AUTH_HEADER")
fi

say() {
  printf '%s\n' "$*" >&2
}

pending() {
  if [ "$apply" -eq 0 ]; then
    say "DRY RUN: $*"
  else
    say "SKIP: $*"
  fi
}

api_get() {
  local path="$1"
  local namespace="$2"
  shift 2

  local args=("${curl_args[@]}" -G "$api_base_url$path")
  while [ "$#" -gt 0 ]; do
    local key="$1"
    local value="$2"
    args+=(--data-urlencode "${namespace}[${key}]=${value}")
    shift 2
  done

  curl "${args[@]}"
}

api_json() {
  local method="$1"
  local path="$2"
  local body="$3"
  curl "${curl_args[@]}" -X "$method" -d "$body" "$api_base_url$path"
}

ensure_status() {
  local response="$1"
  local action="$2"
  if ! jq -e '.status == true' >/dev/null <<<"$response"; then
    echo "API action failed: $action" >&2
    jq . >&2 <<<"$response"
    exit 1
  fi
}

run_or_print() {
  local description="$1"
  local method="$2"
  local path="$3"
  local body="$4"

  if [ "$apply" -eq 0 ]; then
    say "DRY RUN: $description"
    jq . >&2 <<<"$body"
    return 0
  fi

  say "APPLY: $description"
  local response
  response="$(api_json "$method" "$path" "$body")"
  ensure_status "$response" "$description"
  jq . >&2 <<<"$response"
}

find_dns_server_id() {
  local response
  response="$(api_get /dns_servers dns_server q "$dns_server_name")"
  ensure_status "$response" "lookup DNS server"
  jq -r --arg name "$dns_server_name" '
    .response.dns_servers
    | map(select(.name == $name))
    | .[0].id // empty
  ' <<<"$response"
}

find_zone_id() {
  local name="$1"
  local response
  response="$(api_get /dns_zones dns_zone q "$name")"
  ensure_status "$response" "lookup DNS zone $name"
  jq -r --arg name "$name" '
    .response.dns_zones
    | map(select(.name == $name))
    | .[0].id // empty
  ' <<<"$response"
}

find_record_id() {
  local zone_id="$1"
  local name="$2"
  local type="$3"
  local response
  response="$(api_get /dns_records dns_record dns_zone "$zone_id" q "$name")"
  ensure_status "$response" "lookup DNS record $name $type"
  jq -r --arg name "$name" --arg type "$type" '
    .response.dns_records
    | map(select(.name == $name and .type == $type))
    | .[0].id // empty
  ' <<<"$response"
}

find_server_zone_id() {
  local server_id="$1"
  local zone_id="$2"
  local response
  response="$(api_get /dns_server_zones dns_server_zone dns_server "$server_id" dns_zone "$zone_id")"
  ensure_status "$response" "lookup DNS server zone assignment"
  jq -r '.response.dns_server_zones[0].id // empty' <<<"$response"
}

ensure_zone() {
  local name="$1"
  local role="$2"
  local label="$3"
  local zone_id
  zone_id="$(find_zone_id "$name")"
  if [ -n "$zone_id" ]; then
    say "Found $role DNS zone #$zone_id for $name"
    printf '%s' "$zone_id"
    return 0
  fi

  local body
  if [ "$role" = "reverse_role" ]; then
    body="$(jq -n \
      --argjson user "$SMOKE_USER_ID" \
      --arg name "$name" \
      --arg label "$label" \
      --arg email "$zone_email" \
      --arg reverse_address "$reverse_network_addr" \
      --argjson reverse_prefix "$reverse_network_prefix" \
      '{dns_zone: {
        user: $user,
        name: $name,
        label: $label,
        email: $email,
        enabled: true,
        dnssec_enabled: false,
        source: "internal_source",
        role: "reverse_role",
        reverse_network_address: $reverse_address,
        reverse_network_prefix: $reverse_prefix
      }}')"
  else
    body="$(jq -n \
      --argjson user "$SMOKE_USER_ID" \
      --arg name "$name" \
      --arg label "$label" \
      --arg email "$zone_email" \
      '{dns_zone: {
        user: $user,
        name: $name,
        label: $label,
        email: $email,
        enabled: true,
        dnssec_enabled: false,
        source: "internal_source",
        role: "forward_role"
      }}')"
  fi

  run_or_print "create $role DNS zone $name" POST /dns_zones "$body"
  if [ "$apply" -eq 1 ]; then
    zone_id="$(find_zone_id "$name")"
  fi
  printf '%s' "$zone_id"
}

ensure_record() {
  local zone_id="$1"
  local name="$2"
  local type="$3"
  local content="$4"
  local record_id
  record_id="$(find_record_id "$zone_id" "$name" "$type")"
  if [ -n "$record_id" ]; then
    say "Found $type record #$record_id in zone #$zone_id for $name"
    printf '%s' "$record_id"
    return 0
  fi

  local body
  body="$(jq -n \
    --argjson user "$SMOKE_USER_ID" \
    --argjson dns_zone "$zone_id" \
    --arg name "$name" \
    --arg type "$type" \
    --arg content "$content" \
    '{dns_record: {
      user: $user,
      dns_zone: $dns_zone,
      name: $name,
      type: $type,
      content: $content,
      ttl: 3600,
      enabled: true
    }}')"
  run_or_print "create $type DNS record $name in zone #$zone_id" POST /dns_records "$body"
  if [ "$apply" -eq 1 ]; then
    record_id="$(find_record_id "$zone_id" "$name" "$type")"
  fi
  printf '%s' "$record_id"
}

ensure_server_zone() {
  local server_id="$1"
  local zone_id="$2"
  local assignment_id
  assignment_id="$(find_server_zone_id "$server_id" "$zone_id")"
  if [ -n "$assignment_id" ]; then
    say "Found DNS server zone assignment #$assignment_id for server #$server_id zone #$zone_id"
    return 0
  fi

  local body
  body="$(jq -n \
    --argjson dns_server "$server_id" \
    --argjson dns_zone "$zone_id" \
    '{dns_server_zone: {
      dns_server: $dns_server,
      dns_zone: $dns_zone,
      type: "primary_type"
    }}')"
  run_or_print "assign DNS zone #$zone_id to DNS server #$server_id" POST /dns_server_zones "$body"
}

say "DNS smoke seed target: $api_base_url"
if [ "$apply" -eq 0 ]; then
  say "Mode: dry run. Rerun with --apply to create or update rows."
else
  say "Mode: apply."
fi

if [ -z "$dns_server_id" ]; then
  dns_server_id="$(find_dns_server_id)"
fi

if [ -z "$dns_server_id" ]; then
  dns_server_body="$(jq -n \
    --argjson node "$SMOKE_DNS_NODE_ID" \
    --arg name "$dns_server_name" \
    --arg ipv4 "$dns_server_ipv4" \
    '{dns_server: {
      node: $node,
      name: $name,
      ipv4_addr: $ipv4,
      hidden: false,
      enable_user_dns_zones: true,
      user_dns_zone_type: "primary_type"
    }}')"
  run_or_print "create DNS server $dns_server_name on node #$SMOKE_DNS_NODE_ID" POST /dns_servers "$dns_server_body"
  if [ "$apply" -eq 1 ]; then
    dns_server_id="$(find_dns_server_id)"
  fi
else
  say "Found DNS server #$dns_server_id for $dns_server_name"
fi

forward_zone_id="$(ensure_zone "$forward_zone" forward_role "dev.crucio.cz WebUI DNS smoke forward zone")"
reverse_zone_id="$(ensure_zone "$reverse_zone" reverse_role "dev.crucio.cz WebUI DNS smoke reverse zone")"

if [ -n "$forward_zone_id" ]; then
  ensure_record "$forward_zone_id" "$forward_record_name" A "$forward_record_addr" >/dev/null
else
  pending "forward A record would be created after the forward zone exists."
fi

if [ -n "$reverse_zone_id" ]; then
  ensure_record "$reverse_zone_id" "$ptr_record_name" PTR "$ptr_record_value" >/dev/null
else
  pending "reverse PTR record would be created after the reverse zone exists."
fi

if [ -n "$dns_server_id" ] && [ -n "$forward_zone_id" ]; then
  ensure_server_zone "$dns_server_id" "$forward_zone_id"
else
  pending "forward zone assignment would be created after the DNS server and forward zone exist."
fi

if [ -n "$dns_server_id" ] && [ -n "$reverse_zone_id" ]; then
  ensure_server_zone "$dns_server_id" "$reverse_zone_id"
else
  pending "reverse zone assignment would be created after the DNS server and reverse zone exist."
fi

say "Done."

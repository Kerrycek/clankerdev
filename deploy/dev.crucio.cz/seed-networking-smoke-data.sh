#!/usr/bin/env bash
set -euo pipefail

# Dev-only helper for GitHub issue #23.
# Seeds harmless networking rows for dev.crucio.cz UI smoke tests through the
# local vpsAdmin API. The default mode is a dry run.

usage() {
  cat <<'EOF'
Usage:
  deploy/dev.crucio.cz/seed-networking-smoke-data.sh [--apply]

Required environment:
  SMOKE_USER_ID                 user that should own the test route IP
  SMOKE_ENVIRONMENT_ID          environment for the route IP

Optional environment:
  API_BASE_URL                  default: http://127.0.0.1:9292/v7.0
  API_AUTH_HEADER               full auth header, e.g. "X-VpsAdmin-Session: ..."
  SMOKE_NETWORK_ID              reuse an existing network instead of creating one
  SMOKE_NETWORK_INTERFACE_ID    assign the first host IP to this interface
  SMOKE_NETWORK_ADDR            default: 192.0.2.0
  SMOKE_NETWORK_PREFIX          default: 24
  SMOKE_ROUTE_ADDR              default: 192.0.2.23
  SMOKE_HOST_ADDR_ASSIGNED      default: 203.0.113.23
  SMOKE_HOST_ADDR_FREE          default: 203.0.113.24
  SMOKE_HOST_PTR                default: vps-test.dev.crucio.cz.
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
require_env SMOKE_ENVIRONMENT_ID

api_base_url="${API_BASE_URL:-http://127.0.0.1:9292/v7.0}"
network_id="${SMOKE_NETWORK_ID:-}"
network_addr="${SMOKE_NETWORK_ADDR:-192.0.2.0}"
network_prefix="${SMOKE_NETWORK_PREFIX:-24}"
route_addr="${SMOKE_ROUTE_ADDR:-192.0.2.23}"
host_addr_assigned="${SMOKE_HOST_ADDR_ASSIGNED:-203.0.113.23}"
host_addr_free="${SMOKE_HOST_ADDR_FREE:-203.0.113.24}"
host_ptr="${SMOKE_HOST_PTR:-vps-test.dev.crucio.cz.}"
network_interface_id="${SMOKE_NETWORK_INTERFACE_ID:-}"

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

first_id() {
  local key="$1"
  jq -r --arg key "$key" '.response[$key][0].id // empty'
}

find_network_id() {
  local response
  response="$(api_get /networks network q "$network_addr" ip_version 4)"
  ensure_status "$response" "lookup network"
  jq -r --arg addr "$network_addr" --argjson prefix "$network_prefix" '
    .response.networks
    | map(select(.address == $addr and .prefix == $prefix))
    | .[0].id // empty
  ' <<<"$response"
}

find_ip_id() {
  local addr="$1"
  local response
  response="$(api_get /ip_addresses ip_address addr "$addr" prefix 32)"
  ensure_status "$response" "lookup IP $addr"
  first_id ip_addresses <<<"$response"
}

find_host_id() {
  local addr="$1"
  local response
  response="$(api_get /host_ip_addresses host_ip_address addr "$addr")"
  ensure_status "$response" "lookup host IP $addr"
  first_id host_ip_addresses <<<"$response"
}

host_is_assigned() {
  local addr="$1"
  local response
  response="$(api_get /host_ip_addresses host_ip_address addr "$addr")"
  ensure_status "$response" "lookup host IP assignment $addr"
  jq -r '.response.host_ip_addresses[0].assigned // false' <<<"$response"
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

say "Networking smoke seed target: $api_base_url"
if [ "$apply" -eq 0 ]; then
  say "Mode: dry run. Rerun with --apply to create or update rows."
else
  say "Mode: apply."
fi

if [ -z "$network_id" ]; then
  network_id="$(find_network_id)"
fi

if [ -z "$network_id" ]; then
  network_body="$(jq -n \
    --arg label "dev.crucio.cz UI smoke RFC5737" \
    --arg address "$network_addr" \
    --argjson prefix "$network_prefix" \
    '{network: {
      label: $label,
      ip_version: 4,
      address: $address,
      prefix: $prefix,
      role: "public_access",
      managed: true,
      split_access: "owner_split",
      split_prefix: 32,
      purpose: "vps",
      add_ip_addresses: false
    }}')"
  run_or_print "create RFC5737 smoke network $network_addr/$network_prefix" POST /networks "$network_body"
  if [ "$apply" -eq 1 ]; then
    network_id="$(find_network_id)"
  fi
else
  say "Found network #$network_id for $network_addr/$network_prefix"
fi

route_id="$(find_ip_id "$route_addr")"
if [ -z "$route_id" ]; then
  if [ -z "$network_id" ]; then
    say "DRY RUN: route IP $route_addr would be created after the network exists."
  else
    route_body="$(jq -n \
      --argjson network "$network_id" \
      --arg addr "$route_addr" \
      --argjson user "$SMOKE_USER_ID" \
      --argjson environment "$SMOKE_ENVIRONMENT_ID" \
      '{ip_address: {
        network: $network,
        addr: $addr,
        prefix: 32,
        user: $user,
        environment: $environment
      }}')"
    run_or_print "create route IP $route_addr/32" POST /ip_addresses "$route_body"
    if [ "$apply" -eq 1 ]; then
      route_id="$(find_ip_id "$route_addr")"
    fi
  fi
else
  say "Found route IP #$route_id for $route_addr"
fi

ensure_host() {
  local addr="$1"
  local description="$2"
  local id
  id="$(find_host_id "$addr")"
  if [ -n "$id" ]; then
    say "Found $description host IP #$id for $addr"
    printf '%s' "$id"
    return 0
  fi

  if [ -z "$route_id" ]; then
    say "DRY RUN: $description host IP $addr would be created after the route IP exists."
    return 0
  fi

  local body
  body="$(jq -n \
    --argjson ip_address "$route_id" \
    --arg addr "$addr" \
    '{host_ip_address: {ip_address: $ip_address, addr: $addr}}')"
  run_or_print "create $description host IP $addr" POST /host_ip_addresses "$body"
  if [ "$apply" -eq 1 ]; then
    id="$(find_host_id "$addr")"
    printf '%s' "$id"
  fi
}

assigned_host_id="$(ensure_host "$host_addr_assigned" assigned)"
free_host_id="$(ensure_host "$host_addr_free" unassigned)"

if [ -n "$assigned_host_id" ]; then
  ptr_body="$(jq -n --arg ptr "$host_ptr" '{host_ip_address: {reverse_record_value: $ptr}}')"
  run_or_print "set PTR on host IP #$assigned_host_id" PUT "/host_ip_addresses/$assigned_host_id" "$ptr_body"

  if [ -n "$network_interface_id" ]; then
    if [ "$apply" -eq 1 ] && [ "$(host_is_assigned "$host_addr_assigned")" = "true" ]; then
      say "Host IP #$assigned_host_id is already assigned; leaving it in place."
    else
      assign_body="$(jq -n --argjson network_interface "$network_interface_id" '{host_ip_address: {network_interface: $network_interface}}')"
      run_or_print "assign host IP #$assigned_host_id to network interface #$network_interface_id" POST "/host_ip_addresses/$assigned_host_id/assign" "$assign_body"
    fi
  else
    say "No SMOKE_NETWORK_INTERFACE_ID set; leaving $host_addr_assigned unassigned."
  fi
fi

if [ -n "$free_host_id" ]; then
  say "Leaving host IP #$free_host_id unassigned for assign/delete smoke tests."
fi

say "Done."

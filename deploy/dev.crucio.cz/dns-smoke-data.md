# dev.crucio.cz DNS smoke data

Issue: https://github.com/Kerrycek/clankerdev/issues/122

Use this as the dev-lab checklist for populating the local test vpsAdmin with
authoritative DNS data. Do not run this against upstream or production DNS.

The dev-only helper is:

```sh
SMOKE_USER_ID=... SMOKE_DNS_NODE_ID=... \
  deploy/dev.crucio.cz/seed-dns-smoke-data.sh
```

It defaults to a dry run and refuses non-local/non-dev API URLs unless
`ALLOW_NON_DEV_API=1` is set. After reviewing the plan, rerun with `--apply`.

## What the helper seeds

The helper uses vpsAdmin API resources that the new WebUI already uses:

- `dns_servers` for the authoritative server visible under
  `/admin/cluster/dns-servers`
- `dns_zones` for forward and reverse DNS zones
- `dns_records` for record CRUD fixtures
- `dns_server_zones` for assigning zones to the authoritative server

Default smoke set:

- DNS server `ns-dev-lab` on `SMOKE_DNS_NODE_ID`, IPv4 `172.16.106.176`,
  user-zone serving enabled, `primary_type`
- forward zone `webui-next-dns-smoke.dev.crucio.cz`
- `A` record `www -> 203.0.113.23` in the forward zone
- reverse zone `113.0.203.in-addr.arpa` for `203.0.113.0/24`
- `PTR` record `23 -> vps-test.dev.crucio.cz.` in the reverse zone
- primary server-zone assignments for both zones

The helper is idempotent by name. Override the defaults with the `SMOKE_*`
environment variables listed by `--help` when the dev lab needs different
labels, IPs, or zone names.

## Node and service dependency notes

`dns_servers.node` must point at an existing dev-lab vpsAdmin node. This change
does not create nodes because node creation is deployment topology, not UI seed
data. Use a node dedicated to the dev lab or the local `admin.crucio.cz`
test node, then pass its ID as `SMOKE_DNS_NODE_ID`.

The WebUI/API workflows need the database rows above to be present. A live
authoritative service is only needed when humans want to validate real DNS
loading or queries outside the API/UI:

- `nodectld` must run on the selected node with its normal vpsAdmin API
  configuration and a role/profile that manages DNS server zones.
- The authoritative DNS daemon expected by that node profile must be installed
  and enabled on the same node. Confirm the daemon from the local vpsAdmin OS /
  nodectld configuration before enabling it; this repository does not vendor
  those upstream configs.
- The daemon must have writable zone storage owned by the service account used
  by nodectld and must bind only the dev-lab interface/address.
- TCP and UDP DNS service ports must be reachable inside the dev lab if live
  queries are tested. Do not expose this service as production DNS.
- Keep `/etc/resolv.conf`, resolver records, and public registrar delegation
  unchanged; this is authoritative test infrastructure only.

If `nodectld` refuses to load a seeded zone, capture the failing action/task,
the DNS server ID, the DNS zone ID, and the local service status in the PR or
follow-up issue. Do not work around it with direct production DNS changes.

## PTR/reverse workflow

The DNS helper seeds a reverse zone and a PTR record so DNS zone list/detail and
record CRUD can be exercised. The host-IP PTR workflow in vpsAdmin is separate:
run `seed-networking-smoke-data.sh` to prepare route/host IP rows and
`reverse_record_value` data for `/admin/networking/host-ip-addresses`,
`/admin/ip-addresses/:id`, and VPS Network tab tests.

Recommended combined smoke data:

- `seed-dns-smoke-data.sh` forward/reverse DNS zones and server assignments
- `seed-networking-smoke-data.sh` route IP `192.0.2.23/32`, host IPs
  `203.0.113.23` and `203.0.113.24`, and PTR
  `vps-test.dev.crucio.cz.`

## Manual smoke checklist

After applying the helper against `127.0.0.1:9292` on the dev host:

- `/admin/cluster/dns-servers`: `ns-dev-lab` is listed, editable, and shows
  user zones enabled.
- `/app/dns` or `/admin/users/:id/dns`: the forward and reverse zones are
  visible; filters `role:forward`, `role:reverse`, and `source:internal` work.
- `/app/dns/zones/:id`: zone summary loads for both seeded zones.
- Records tab: create, edit, disable/enable, and delete a disposable record in
  the forward zone.
- Servers tab: both zones show assignment to `ns-dev-lab`.
- Transfers tab: can open and list without production DNS dependencies.
- Logs tab: record changes appear after CRUD, or the missing log/task behavior
  is recorded as a backend blocker.
- `/admin/networking/host-ip-addresses`: edit the seeded host IP PTR value from
  `seed-networking-smoke-data.sh` and verify the value round-trips through the
  UI/API.

## Playwright coverage

Mocked smoke coverage already exists for the DNS UI surfaces:

```sh
npx playwright test \
  e2e/specs/admin/cluster_dns_tools_smoke.spec.ts \
  e2e/specs/app/dns_records_crud.spec.ts \
  e2e/specs/app/dns_zone_advanced_tabs_smoke.spec.ts
```

These tests do not require live DNS or mutate the dev-lab API. Use the manual
checklist above for human verification against the seeded dev data.

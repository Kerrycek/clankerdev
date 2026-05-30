# dev.crucio.cz networking smoke data

Issue: https://github.com/Kerrycek/clankerdev/issues/23

Use this as a checklist for populating the test vpsAdmin with harmless
networking data. Do not run this against upstream or production.

The dev-only helper is:

```sh
SMOKE_USER_ID=... SMOKE_ENVIRONMENT_ID=... \
  deploy/dev.crucio.cz/seed-networking-smoke-data.sh
```

It defaults to a dry run and refuses non-local/non-dev API URLs unless
`ALLOW_NON_DEV_API=1` is set. After reviewing the plan, rerun with `--apply`.
Set `SMOKE_NETWORK_INTERFACE_ID` to also assign one host IP to a disposable VPS
network interface; otherwise both host IP rows are left available for manual UI
action tests.

Recommended documentation/test ranges:

- Public IPv4 examples: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
- Private IPv4 examples: `10.106.0.0/16` or another private range owned by the
  dev lab
- IPv6 examples: `2001:db8::/32`

Minimal smoke set:

- one route IP owned by the test user and environment
- two host IP addresses under that route
- one assigned host IP address on `venet0` of a disposable test VPS
- one unassigned host IP address so assign/delete can be tested
- one PTR value such as `vps-test.dev.crucio.cz.`

UI flows to verify after the data exists:

- `/admin/ip-addresses`: open route, edit owner, assign/free route
- `/admin/ip-addresses/:id`: create host addresses, edit PTR, assign/free/delete
  host addresses
- `/admin/networking/host-ip-addresses`: filter assigned/unassigned, edit PTR,
  assign/free/delete host addresses
- VPS detail Network tab: assigned addresses and interfaces remain readable

Avoid blind SQL seed data. The helper uses the API so location, environment and
node constraints are enforced by the same backend validations as the UI.

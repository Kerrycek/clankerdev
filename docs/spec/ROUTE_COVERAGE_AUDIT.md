# Route coverage audit (router.tsx → spec)

This document ensures **every route** in `src/routes/router.tsx` has:
- a screen spec (in `SCREEN_SPECS.md`), or an explicit deferral note
- mode/scope/role access rules (in `MODE_AND_ROUTE_ACCESSIBILITY.md`)
- pagination rules for list routes (in `PAGINATION_AND_SEARCH.md` + `SCREEN_SPECS.md`)

Last updated: 2026-03-02

---

## OAuth routes (auth flow)

These are not shown in navigation, but must remain functional.

- `/oauth/login`
  - Spec: `AUTH_AND_FAILURE_SURFACES.md` (OAuth flow screens) + `../../UI_REDESIGN.md` (canonical auth / shell behavior)
  - UX notes: short “Redirecting to sign-in…” screen; must be resilient to slow redirects; must have a safe error state.
- `/oauth/callback`
  - Spec: `AUTH_AND_FAILURE_SURFACES.md` (OAuth flow screens) + `../../UI_REDESIGN.md` (canonical auth / shell behavior)
  - UX notes: show progress and a clear error if callback fails; must scrub OAuth params from history; provide path out.
- `/oauth/logout`
  - Spec: `AUTH_AND_FAILURE_SURFACES.md` (OAuth flow screens) + `../../UI_REDESIGN.md` (canonical auth / shell behavior)
  - UX notes: show progress and link back to `/`; must handle token clear failures.

Mode/scope: not applicable.

---

## Wildcard routes (Not Found)

We do not redirect unknown routes.

- `/...` (public) → NotFound
- `/app/...` → NotFound
- `/admin/...` → NotFound

Spec: `AUTH_AND_FAILURE_SURFACES.md` (Not found)

---

## Public routes (PublicLayout)

- `/` (Status overview)
  - Spec: `SCREEN_SPECS.md` → “Public overview `/`”
  - Priority: `INFORMATION_PRIORITY_MAPS.md` → Outages/News (public)
- `/outages`
  - Spec: `SCREEN_SPECS.md` → “Outages list `/outages`”
- `/outages/:outageId`
  - Spec: `SCREEN_SPECS.md` → “Outage detail `/outages/:outageId`”
- `/news`
  - Spec: `SCREEN_SPECS.md` → “News `/news`”
- `/requests/registrations/:requestId/:token`
  - Spec: `../../UI_REDESIGN.md` → §7.38 Public / Fix registration request (token)

Access:
- Always reachable; not hidden behind obsolete UI-mode rules.

Pagination:
- News and resolved outages can require keyset pagination (“Load older”); see `SCREEN_SPECS.md`.

---

## Authenticated routes: Mine scope (`/app/*`)

- `/app` (Dashboard)
  - Spec: `SCREEN_SPECS.md` → Dashboard
- `/app/vps`
  - Spec: `SCREEN_SPECS.md` → VPS list
  - Pagination: required (keyset `from_id`)
- `/app/vps/:vpsId`
  - Spec: `SCREEN_SPECS.md` → VPS detail (header + tabs)
- `/app/vps/:vpsId/network`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Network)
- `/app/vps/:vpsId/storage`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Storage)
- `/app/vps/:vpsId/features`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Features)
- `/app/vps/:vpsId/maintenance`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Maintenance)
- `/app/vps/:vpsId/console`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Console)

- `/app/datasets`
- `/app/nas`
  - Spec: `../../UI_REDESIGN.md` → §6.4 Storage contract / W5.12 NAS surface
  - Notes: primary-pool datasets shortcut; same list implementation with fixed `role=primary` preset.
  - Spec: `SCREEN_SPECS.md` → Datasets/Storage list
  - Pagination: required
- `/app/exports`
  - Spec: `../../UI_REDESIGN.md` → §7.8 Storage exports (NFS)
  - Pagination: required
- `/app/exports/:exportId`
  - Spec: `../../UI_REDESIGN.md` → §7.8 Storage exports (NFS)
- `/app/datasets/:datasetId`
  - Spec: `SCREEN_SPECS.md` → Dataset detail (overview)
- `/app/datasets/:datasetId/snapshots`
  - Spec: `SCREEN_SPECS.md` → Dataset snapshots
- `/app/datasets/:datasetId/downloads`
  - Spec: `SCREEN_SPECS.md` → Dataset downloads
- `/app/datasets/:datasetId/exports`
  - Spec: `../../UI_REDESIGN.md` → §7.8 Storage exports (NFS)
- `/app/datasets/:datasetId/plans`
  - Spec: `../../UI_REDESIGN.md` → §6.4 Storage contract / W5.10 dataset plans assignment UI
- `/app/datasets/:datasetId/expansion`
  - Spec: `../../UI_REDESIGN.md` → §6.4 Storage contract / W5.11 temporary expansions

- `/app/dns`
  - Spec: `SCREEN_SPECS.md` → DNS zones list
  - Pagination: required
- `/app/dns/zones/:zoneId`
  - Spec: `SCREEN_SPECS.md` → DNS zone records
- `/app/dns/zones/:zoneId/settings`
  - Spec: `SCREEN_SPECS.md` → DNS zone settings
- `/app/dns/zones/:zoneId/logs`
  - Spec: `SCREEN_SPECS.md` → DNS logs

- `/app/transactions`
  - Spec: `SCREEN_SPECS.md` → Transaction chains
- `/app/transactions/items`
  - Spec: `SCREEN_SPECS.md` → Transactions list
- `/app/transactions/items/:transactionId`
  - Spec: `SCREEN_SPECS.md` → Transaction detail
- `/app/transactions/:chainId`
  - Spec: `SCREEN_SPECS.md` → Transaction chain detail

- `/app/action-states`
  - Spec: `SCREEN_SPECS.md` → Action states list
- `/app/action-states/:actionStateId`
  - Spec: `SCREEN_SPECS.md` → Action state detail

- `/app/monitoring`
  - Spec: `SCREEN_SPECS.md` → Monitoring events list
  - Pagination: required (keyset `from_id`)
- `/app/monitoring/:eventId`
  - Spec: `SCREEN_SPECS.md` → Monitoring event detail

- `/app/payments`
  - Spec: `SCREEN_SPECS.md` → Payments / billing
- `/app/requests`
  - Spec: `../../UI_REDESIGN.md` → §6.9 Requests (user self-view)
- `/app/requests/:type/:requestId`
  - Spec: `../../UI_REDESIGN.md` → §6.9 Request detail (user self-view)

- `/app/profile`
  - Spec: `SCREEN_SPECS.md` → Profile / account

Route rules:
- Routes should follow the canonical redesign spec in `../../../UI_REDESIGN.md`.

---

## Authenticated routes: All scope (`/admin/*`, admins only)

Everything listed under `/app/*` has an `/admin/*` equivalent (same UI, different scope preset),
plus admin-only modules:

- `/admin` (Dashboard)
- `/admin/cluster` → redirect to `/admin/cluster/summary`
- `/admin/cluster/summary`
  - Spec: `../../UI_REDESIGN.md` → §6.12.2 Admin → Cluster summary (contract)
- `/admin/cluster/environments`
  - Spec: `../../UI_REDESIGN.md` → §6.12.8 Environments (contract)
- `/admin/cluster/locations`
  - Spec: `../../UI_REDESIGN.md` → §6.12.9 Locations (contract)
- `/admin/cluster/os-templates`
  - Spec: `../../UI_REDESIGN.md` → §6.12.5 OS templates (contract)
- `/admin/cluster/networks`
  - Spec: `../../UI_REDESIGN.md` → §6.12.10 Networks (contract)
- `/admin/cluster/networks/:networkId`
  - Spec: `../../UI_REDESIGN.md` → §6.12.10 Networks (detail contract)
- `/admin/cluster/resource-packages`
  - Spec: `../../UI_REDESIGN.md` → §6.12.10 Resource packages (contract)
- `/admin/cluster/resource-packages/:packageId`
  - Spec: `../../UI_REDESIGN.md` → §5.7.16.13 Resource packages (UX / blast radius)
- `/admin/cluster/system-config`
  - Spec: `../../UI_REDESIGN.md` → §6.12.4 System config (contract)
- `/admin/cluster/dns-resolvers`
  - Spec: `../../UI_REDESIGN.md` → §6.12.7 DNS resolvers (contract)

- `/admin/nodes`
  - Spec: `SCREEN_SPECS.md` → Admin: Nodes
  - Pagination: required when the list can grow
- `/admin/nodes/:nodeId`
  - Spec: `SCREEN_SPECS.md` → Node detail
- `/admin/migration-plans`
  - Spec: `SCREEN_SPECS.md` → Admin: Migrations
- `/admin/migration-plans/:planId`
  - Spec: `SCREEN_SPECS.md` → Migration plan detail
- `/admin/users`
  - Spec: `../../UI_REDESIGN.md` → §6.13.2 User list contract
- `/admin/users/:userId`
  - Spec: UI_REDESIGN.md → Admin: user dossier
  - Tabs: Overview, Payments, Environment configs, Security, MFA, Sessions, SSH keys, Metrics, Mail, User data, History
- `/admin/admin-info`
  - Spec: `SCREEN_SPECS.md` → Admin info / Diagnostics
  - Mode: see canonical redesign spec (obsolete UI-mode gating removed)

- `/admin/audit`
  - Spec: `SCREEN_SPECS.md` → Admin: Audit (Object history)
  - Pagination: required (keyset `from_id`, newest-first)
- `/admin/audit/:historyId`
  - Spec: `SCREEN_SPECS.md` → Admin: Audit event detail

- `/admin/requests`
  - Spec: `SCREEN_SPECS.md` → Admin: Requests
  - Pagination: required (keyset `from_id`)
- `/admin/requests/:type/:requestId`
  - Spec: `SCREEN_SPECS.md` → Admin: Request detail

- `/admin/mailer/templates`
  - Spec: `../../UI_REDESIGN.md` §6.24.4 + wireframe §7.34
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/templates/:mailTemplateId`
  - Spec: `../../UI_REDESIGN.md` §6.24.4 + wireframe §7.34
- `/admin/mailer/templates/:mailTemplateId/translations/:translationId`
  - Spec: `../../UI_REDESIGN.md` §6.24.4 (translation editor)

- `/admin/mailer/mailboxes`
  - Spec: `../../UI_REDESIGN.md` §6.24.6 + wireframe §7.35
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/mailboxes/:mailboxId`
  - Spec: `../../UI_REDESIGN.md` §6.24.6 + wireframe §7.35

- `/admin/mailer/recipients`
  - Spec: `../../UI_REDESIGN.md` §6.24.5
  - Pagination: required (keyset `from_id`)

- `/admin/mailer/log`
  - Spec: `../../UI_REDESIGN.md` §6.24.3 + wireframe §7.33
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/log/:mailLogId`
  - Spec: `../../UI_REDESIGN.md` §6.24.3 + wireframe §7.33

- `/admin/payments/incoming`
  - Spec: `SCREEN_SPECS.md` → Admin: Incoming payments
  - Pagination: required (keyset `from_id`)
- `/admin/payments/incoming/:paymentId`
  - Spec: `SCREEN_SPECS.md` → Admin: Incoming payment detail

Access:
- Role-gated: non-admins must receive a forbidden screen.
- Scope switching semantics are locked in `MODE_AND_ROUTE_ACCESSIBILITY.md`.

---

## Catch-all

- `*` → redirect to `/`
  - Spec: `ERRORS_AND_EMPTY_STATES.md` (not found / navigation)


- `/app/dns/zones/:zoneId/transfers`
  - Spec: `UI_REDESIGN.md` §6.5 Transfers / zone detail tabs
  - Notes: list + create/delete transfer peers, copyable server snippet.
- `/app/dns/zones/:zoneId/dnssec`
  - Spec: `UI_REDESIGN.md` §6.5 DNSSEC
  - Notes: DNSKEY + DS copy blocks.
- `/app/dns/zones/:zoneId/servers`
  - Spec: `UI_REDESIGN.md` §6.5 zone servers status
  - Notes: serial/load/refresh/expire state; admin can add/remove servers.
- `/admin/cluster/dns-servers`
  - Spec: `UI_REDESIGN.md` §6.12 Cluster management / DNS servers
  - Notes: list + create/edit/delete authoritative DNS servers.
- `/admin/cluster/dns-tsig-keys`
  - Spec: `UI_REDESIGN.md` §6.5 TSIG keys + cluster DNS tools
  - Notes: list + create/delete TSIG keys, reveal/copy secret.
- `/admin/nas`
  - Spec: `UI_REDESIGN.md` §6.4 Storage contract / W5.12 NAS surface
  - Notes: admin NAS alias; fixed `role=primary` preset with owner column and no VPS filter.
- `/admin/exports`
  - Spec: `UI_REDESIGN.md` §7.8 Storage exports (NFS)
  - Notes: global exports list with create flow, SFI filters, keyset pagination.
- `/admin/exports/:exportId`
  - Spec: `UI_REDESIGN.md` §7.8 Storage exports (NFS)
  - Notes: summary, mount instructions, allowed host management.
- `/admin/datasets/:datasetId/exports`
  - Spec: `UI_REDESIGN.md` §7.8 Storage exports (NFS)
  - Notes: dataset-scoped embedded exports list.
- `/admin/datasets/:datasetId/plans`
  - Spec: `UI_REDESIGN.md` §6.4 Storage contract / W5.10 dataset plans assignment UI
  - Notes: dataset-scoped plan assignments.
- `/admin/datasets/:datasetId/expansion`
  - Spec: `UI_REDESIGN.md` §6.4 Storage contract / W5.11 temporary expansions
  - Notes: dataset-scoped expansion summary, settings and history.

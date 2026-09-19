# Pagination and global search

This spec captures two cross-cutting UX requirements:

1) **Pagination** for all list pages (using HaveAPI `from_id`).
2) **Global search / quick-jump** (admin via `Cluster.Search`, non-admin limited unless backend adds support).

Last updated: 2026-09-15

## Pagination

### Why keyset pagination

HaveAPI index actions support keyset pagination via `from_id`.
This is stable and fast on large datasets.

### UX requirements

- Every list page that uses `Index` should have:
  - Next / Previous
  - Numbered pages between (based on visited history)
  - Current page indicator
  - Optional limit selector (e.g. 25/50/100)

### URL shape

We keep pagination in the URL for shareability.

Recommended query params:
- `from_id`: number (cursor)
- `page`: number (1-based, purely presentational)
- `limit`: number

Example (Mine scope preset shown):
- `/app/vps?limit=50&page=3&from_id=12345`

Notes:
- `/app` and `/admin` are **scope presets** (Mine vs All) for admins.
- The pagination query parameters are identical in either scope.

For pages that embed **multiple independent paginated lists** (e.g. an admin node detail page that shows both status samples and transactions), query params must be namespaced to avoid collisions.

Recommended pattern:
- `<prefix>from_id`, `<prefix>page`, `<prefix>limit`

Examples:
- `status_from_id`, `status_page`, `status_limit`
- `tx_from_id`, `tx_page`, `tx_limit`

This is supported by `useKeysetPagination` via the `paramPrefix` option.


### Implementation strategy

Keyset pagination does not support direct random access to page N without walking cursors.
Therefore:
- The UI maintains a **page stack** of cursors for the current filter set.
- Numbered pages represent the visited stack.
- “Previous” navigates back through the stack.

We reset the page stack when:
- filters change
- search query changes

### Cursor calculation

For descending lists (newest first):
- Page 1: no `from_id`
- Next page cursor = the **last item id** on the current page (i.e. the smallest `id` on the page)

For ascending lists (rare):
- Next page cursor = the **last item id** on the current page (i.e. the largest `id` on the page)

(Exact direction must match API defaults per endpoint.)

### Reference implementation

Code:

- Hook: `src/lib/hooks/useKeysetPagination.ts` — maintains a cursor stack, persists it in `sessionStorage`, and keeps `from_id`/`page`/`limit` synchronized with the URL.
- UI component: `src/components/ui/KeysetPagination.tsx` — Prev/Next + visited page numbers + limit selector.

Pages already migrated to the shared implementation:

- VPS list: `src/pages/app/VpsListPage.tsx`
- Transaction chains: `src/pages/app/TransactionChainsPage.tsx`
  - `TransactionChain.Index` is descending: the next request uses the last
    visible chain ID as `from_id`.
  - The UI requests `limit + 1`, renders at most `limit`, and enables Next only
    when the hidden look-ahead row exists. This distinguishes an exact-size
    terminal page from a page with more results.
  - `errors=1` reads the `failed` and `fatal` streams with the same look-ahead,
    deduplicates and orders their union, then applies the visible limit. The
    cursor and Next state are derived from that merged page, not either stream
    in isolation.
  - Pinned chains are supplemental rows and never affect the page cursor or
    look-ahead decision.
  - This look-ahead fixes the exact-terminal-page signal; it does not establish
    lossless traversal while the API filters its cursor by ID but orders first
    by `created_at`. That upstream ordering limitation remains tracked by issue
    #189.
- Action states: `src/pages/app/ActionStatesPage.tsx`
- Datasets list: `src/pages/app/datasets/DatasetsListPage.tsx`
- NAS list alias: `src/pages/app/datasets/NasDatasetsPage.tsx` (same list implementation, fixed `role=primary`, no VPS filter)
- Exports list: `src/pages/app/exports/ExportsListPage.tsx`
- Dataset snapshots: `src/pages/app/datasets/DatasetSnapshotsPage.tsx` (server-side `q`)
- Dataset downloads: `src/pages/app/datasets/DatasetDownloadsPage.tsx` (server-side `q`)
- DNS zones list: `src/pages/app/dns/DnsZonesPage.tsx`
- DNS zone records: `src/pages/app/dns/DnsZoneRecordsPage.tsx` (server-side `q`)
- DNS zone logs: `src/pages/app/dns/DnsZoneLogsPage.tsx` (server-side `q`)
- Admin node detail (embedded lists): `src/pages/app/admin/NodeDetailPage.tsx`
- Admin node detail (embedded lists with `paramPrefix`): `src/pages/app/admin/NodeDetailPage.tsx`
- Monitoring events list: `src/pages/app/MonitoringEventsPage.tsx`
- Admin requests list: `src/pages/app/admin/RequestsPage.tsx`
- Admin incoming payments list: `src/pages/app/admin/IncomingPaymentsPage.tsx`
- Member payment history: `src/pages/app/payments/PaymentsPage.tsx`
- Admin member payment history: `src/pages/app/admin/user/AdminUserPaymentsPage.tsx`
- Incident reports list: `src/pages/app/incidents/IncidentsPage.tsx`
- OOM reports list: `src/pages/app/oom/OomReportsPage.tsx`
- Profile / Admin user data templates: `src/components/user/UserDataTemplatesPanel.tsx` (server-side `q`, SFI)
- User namespaces list: `src/components/userNamespaces/UserNamespaceList.tsx` (SFI; numeric ID opens detail; exact `size` plus admin-only `user`/`block_count` filters; ascending exclusive `id > from_id`, with a hidden look-ahead row)
- User namespace maps list: `src/components/userNamespaces/UserNamespaceMapList.tsx` (SFI; numeric ID opens detail; exact `user_namespace` plus admin-only `user` filter; no server-side `q`; ascending exclusive `id > from_id`, with a hidden look-ahead row)

### Exact terminal pages

An API response containing exactly the visible limit is not evidence that a
next page exists. Where the endpoint maximum permits it, request one additional
row, render only the selected limit, and derive the next cursor from the last
visible row rather than from the hidden sentinel. Keep **Next** available when
the local cursor stack already contains a forward-visited page.

Both member and administrator user-payment histories follow this pattern.
`UserPayment.Index` uses descending pagination and explicitly orders by
`created_at DESC, id DESC`; the current frontend cursor is the smallest visible
payment ID, matching the endpoint's descending-ID cursor direction. Visible
limits are 25/50/100 for members and
25/50/100/200 for administrators, so look-ahead requests remain at or below
201 rows. This makes the exact-terminal **Next** signal reliable. Complete
traversal of historical rows whose IDs are not monotonic with `created_at`
still requires the deterministic upstream cursor/order contract tracked in
#189; an ID-only `from_id` predicate cannot prove that stronger guarantee.

User namespace and namespace-map indexes also use this pattern, with the
backend's default ascending order and exclusive `id > from_id` predicate. They
request `limit + 1`, hide the sentinel, and use the greatest visible ID as the
next cursor. Exact-size and below-limit terminal pages disable **Next** unless
the local cursor stack already contains a forward-visited page; that known
cursor remains navigable. A malformed response that does not advance beyond
the current cursor fails closed instead of creating a pagination loop.

### Smart Filter Input pages

Some lists use a unified **Smart Filter Input** (SFI) instead of many inline inputs.

Guidelines:
- Plain text becomes a server-side `q` query (when supported by backend).
- `key:value` tokens map to existing backend filter params.
- A single number can act as a quick-jump to the detail page.
- Advanced filters are available via a drawer (for discoverability).
- The active filter set is always reflected in the URL for shareability.

## Global search / quick-jump

### What the backend supports today

- `Cluster.Search` exists and is **admin-only**.
- It can locate objects such as VPSes, users, IP addresses, networks, exports and transaction chains.
- It does **not** currently search datasets or DNS zones/records.

Therefore:
- v1 global search is primarily an **admin/support jump tool**.
- Non-admin users rely on per-page search/filtering (VPS list, datasets list, DNS list), unless we implement a limited “My VPS quick-jump”.

### UX goals

Admins/support must be able to quickly find:
- VPS by hostname or ID
- users (admin)
- IP addresses / networks (admin)
- exports / transaction chains (admin)

The search surface should not overwhelm:
- default to the most likely result group first
- keep secondary result groups behind progressive disclosure when needed

### Interaction model

- Desktop: search entry point in header.
- Shortcut: `Ctrl+K` / `Cmd+K` opens command palette.
- Mobile: search icon opens full-screen search sheet.

### Scope rules (admins)

- Mine vs All is not reliably enforceable inside `Cluster.Search` results (no owner metadata).
- If an admin is in Mine scope and opens a non-owned object, the normal Mine-scope guard applies.

### Results

- Group results by resource type (VPS, User, IP address, Network, Export, Transaction chain).
- Each result is a link.


## Acceptance criteria

- Lists have next/prev + visited page numbers.
- Pagination state is shareable via URL.
- Global search works with keyboard only.
- Admin global search uses `Cluster.Search` and returns results across supported object types.


## Admin lists

Admin pages follow the same keyset pagination rules (`from_id`, `limit`, numeric `page` stack in the URL). The page UI may apply additional client-side filtering/sorting **within the loaded page**.

- **Nodes** (`/admin/nodes`)
  - Primary index: `Node.Index` (`GET /api/v7.0/nodes`) with namespaced
    params:
    - `node[from_id]`, `node[limit]` (keyset pagination)
    - exact filters `node[location]`, `node[environment]`, `node[type]`, and
      `node[hypervisor_type]`
    - admin-only `node[state]` (`active`/`inactive`/`all`)
  - `Node.Index` has no `q` or other full-text input. A single numeric value or
    `id:<number>` navigates to node detail; arbitrary text and legacy
    `q`/`search` aliases are reported as unsupported without issuing another
    list request.
  - Support accounts cannot send or select `state`: the backend blacklists that
    input for non-admins and restricts their index to active nodes.
  - Health augmentation: `Node.PublicStatus`
    (`GET /api/v7.0/nodes/public_status`) is not paginated. `issues` is a
    page-local UI filter, derived from public-status health for the current
    authenticated index page; it is never sent as `node[issues]`.
  - When the authenticated index is unavailable, the page falls back to the public status list (unpaginated).
  - Legacy `q` URLs are canonicalized before either node query: `q` and the
    stale `from_id` are removed and `page` is reset to 1, while valid `issues`,
    `limit`, and (for administrators) `state` survive. Support URLs receive the
    same pre-query cursor reset and also lose the unauthorized `state` value.
  - The filter and role contract is separate from the unresolved `from_id`
    direction/deterministic-ordering problem tracked by issue #189. Until that
    upstream pagination contract is guaranteed, complete multi-page traversal
    is not claimed here.

- **Migration plans** (`/admin/migration-plans`)
  - Index: `MigrationPlan.Index` (`GET /api/v7.0/migration_plans`) with `migration_plan[from_id]`, `migration_plan[limit]`.
  - Server-side filters:
    - `state` (`migration_plan[state]`)
    - `user` (`migration_plan[user]`)
  - The index has no free-text filter. The UI supports exact plan-ID navigation separately and removes legacy `q` links before mounting the list.

- **Migration plan migrations** (`/admin/migration-plans/:id`)
  - Index: `VpsMigration.Index` (`GET /api/v7.0/migration_plans/:id/vps_migrations`) with `vps_migration[from_id]`, `vps_migration[limit]`.

- **Admin user history** (`/admin/users/:userId/history`)
  - Specialized audit view over `ObjectHistory.Index` (`GET /api/v7.0/object_histories`) with `object_history[from_id]`, `object_history[limit]`.
  - View modes:
    - `changes` → fixed `object=User`, `object_id=:userId`
    - `actions` → fixed `user=:userId`
  - Search + filters: **server-side** via Smart Filter Input (SFI) + advanced drawer.
    - `q` (`object_history[q]`)
    - `event_type` (`object_history[event_type]`)
    - `user_session` (`object_history[user_session]`)
    - in `actions` view also: `object`, `object_id`

- **Users** (`/admin/users`)
  - Index: `User.Index` (`GET /api/v7.0/users`) with `user[from_id]`, `user[limit]`.
  - Search + filters: **server-side** (admin only).
    - `q` (`user[q]`) – OR-based search across `id/login/full_name/email/address/info`.
    - `role` (`user[role]`) – one of `user/support/admin`.
    - `level` (`user[level]`) – exact numeric level.
    - `mailer_enabled` (`user[mailer_enabled]`)
    - `lockout` (`user[lockout]`)
    - `password_reset` (`user[password_reset]`)
    - `enable_multi_factor_auth` (`user[enable_multi_factor_auth]`)
  - UI uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **Mailer log** (`/admin/mailer/log`)
  - Index: `MailLog.Index` (`GET /api/v7.0/mail_logs`) with `mail_log[from_id]`, `mail_log[limit]`.
  - The current API exposes no list filters. The UI offers keyset browsing and exact detail navigation by mail-log ID only.
  - Legacy `q`, `user`, template and date-filter URLs are normalized before the list request; stale cursor/page state is reset while a supported `limit` is preserved.

- **Mailer templates** (`/admin/mailer/templates`)
  - Index: `MailTemplate.Index` (`GET /api/v7.0/mail_templates`) with `mail_template[from_id]`, `mail_template[limit]`.
  - The current API exposes only keyset pagination for this index. The UI loads a bounded first 500 templates and applies search, exact `template_id`, and exact `user_visibility` filters locally; a visible warning explains when that bound is reached.
  - `q` searches id / `#id` / name / label / `template_id` in the loaded set.
  - Role, public and language filters are not sent because they are not part of the current API action contract.
  - Filter and numbered client-page state remains shareable in the URL.
  - Create supports all four API fields. On edit, `name` and `template_id` are intentionally read-only because they are operational identifiers used by the mailer and template registry; only `label` and `user_visibility` are submitted.
  - An ambiguous create response (transport loss, malformed response, or retryable/server HTTP status) blocks another create and offers a bounded, read-only keyset reconciliation instead of blindly repeating the POST. Translation creation follows the same rule per language.
  - Template deletion is intentionally disabled: the current API model does not cascade or restrict every user-template preference relation, so a direct delete could leave orphaned records. Translation and template-recipient relation deletes remain available.

- **Mailer recipients** (`/admin/mailer/recipients`)
  - Index: `MailRecipient.Index` (`GET /api/v7.0/mail_recipients`) with `mail_recipient[from_id]`, `mail_recipient[limit]`.
  - The current API has no search inputs. The UI loads a bounded first 500 recipients and applies `q`, `label`, `to`, `cc`, and `bcc` locally; a visible warning explains when that bound is reached.
  - UI uses Smart Filter Input (SFI) + an advanced drawer; shareable filter and numbered client-page state remains in the URL.
  - Recipient deletion is intentionally disabled because the current API model does not cascade or restrict its mail-template relations.

- **Mailer mailboxes** (`/admin/mailer/mailboxes`)
  - Index: `Mailbox.Index` (`GET /api/v7.0/mailboxes`) with `mailbox[from_id]`, `mailbox[limit]`.
  - Search + filters: **server-side**.
    - `q` (`mailbox[q]`) – label / server / user / `#id`
    - `server` (`mailbox[server]`)
    - `user` (`mailbox[user]`)
    - `enable_ssl` (`mailbox[enable_ssl]`)
  - UI uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **IP addresses** (`/admin/ip-addresses`)
  - Index: `IpAddress.Index` (`GET /api/v7.0/ip_addresses`) with `ip_address[from_id]`, `ip_address[limit]`.
  - Filters are applied **server-side**. The smart input resolves an exact user login to its ID before requesting the list; `IpAddress.Index` itself has no full-text `q` parameter.
    - `addr` (`ip_address[addr]`) – exact IP address match
    - `prefix` (`ip_address[prefix]`) – exact prefix length
    - `vps` (`ip_address[vps]`) – VPS id
    - `user` (`ip_address[user]`) – user id (admin)
    - `network` (`ip_address[network]`) – network id
    - `network_interface` (`ip_address[network_interface]`) – interface id
    - `location` (`ip_address[location]`) – location id
    - `version` (`ip_address[version]`) – 4 or 6
    - `assigned_to_interface` (`ip_address[assigned_to_interface]`) – boolean
    - `order` (`ip_address[order]`) – `desc` (newest), `asc` (oldest), `interface`
  - UI uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **Cluster DNS resolvers** (`/admin/cluster/dns-resolvers`)
  - Index: `DnsResolver.Index` (`GET /api/v7.0/dns_resolvers`) with `dns_resolver[from_id]`, `dns_resolver[limit]`, and the optional `dns_resolver[vps]` selector used outside the admin catalogue.
  - The current API does **not** declare `q`, `is_universal`, or `location` list filters. The admin UI therefore presents a paginated catalogue without search/filter controls and removes those stale parameters from old shared URLs.
  - This matches the legacy cluster UI, which also loads the resolver catalogue without filters. Filtering only the currently loaded page would be incomplete and is intentionally avoided.

- **Cluster OS templates** (`/admin/cluster/os-templates`)
  - Index: `OsTemplate.Index` (`GET /api/v7.0/os_templates`) with server-side filtering.
  - Search + filters: **server-side**.
    - `q` (`os_template[q]`) – label / name / `#id`
    - `os_family` (`os_template[os_family]`)
    - `enabled` / `supported`
    - `hypervisor_type` / `cgroup_version`
    - `enable_script` / `enable_cloud_init`
  - UI now uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **Cluster environments** (`/admin/cluster/environments`)
  - Index: `Environment.Index` (`GET /api/v7.0/environments`).
  - Search + filters: **server-side**.
    - `q` (`environment[q]`) – label / domain / description / `#id`
    - `has_hypervisor`, `has_storage`
  - UI now uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **Cluster locations** (`/admin/cluster/locations`)
  - Index: `Location.Index` (`GET /api/v7.0/locations`).
  - Search + filters: **server-side**.
    - `q` (`location[q]`) – label / domain / description / environment label / `#id`
    - `environment`, `has_hypervisor`, `has_storage`, `hypervisor_type`
    - `shares_v4_networks_with`, `shares_v6_networks_with`, `shares_any_networks_with`, `shares_networks_primary`
  - UI now uses Smart Filter Input (SFI) + an advanced drawer; shareable links preserve filter state.

- **Cluster networks** (`/admin/cluster/networks`)
  - Index: `Network.Index` (`GET /api/v7.0/networks`) with `network[from_id]`, `network[limit]`.
  - Exact filters mapped to API inputs:
    - `location` (`network[location]`)
    - `purpose` (`network[purpose]`)
  - `Network.Index` does **not** declare free-text, `ip_version`, `role`, or
    `managed` filters. The UI does not offer or send them; legacy URLs carrying
    them are canonicalized with their stale cursor before the first list GET.
  - A numeric Smart Filter Input value opens network detail. The advanced
    drawer and shareable URL expose only `location` and `purpose`.
  - The shared network lookup uses the supported exact filters to load a
    bounded candidate set and matches labels/addresses locally; it never sends
    a fictitious `network[q]` parameter.

- **Cluster resource packages** (`/admin/cluster/resource-packages`)
  - Index: `ClusterResourcePackage.Index` (`GET /api/v7.0/cluster_resource_packages`) with `cluster_resource_package[from_id]`, `cluster_resource_package[limit]`.
  - Exact server-side filters: `environment` and nullable `user` only.
    - Global/shared scope sends `cluster_resource_package[user]` with a null value.
    - Personal scope requires a concrete user ID; this avoids pretending that an incomplete client-side page is the complete personal catalogue.
    - All scope omits the user filter.
  - The API does not support `q` or `is_personal`; the UI never sends either parameter and normalizes legacy `?q=` links.
  - A bare numeric smart-filter value opens the package detail. The advanced drawer exposes the supported scope, environment, and user filters, and shareable links preserve them.

- **System config** (`/admin/cluster/system-config`)
  - List is currently loaded in full from `SystemConfig.Index` and filtered client-side.
  - UI now uses Smart Filter Input (SFI) + an advanced drawer for:
    - free-text search (`q`) over key / label / category / description
    - exact `category` filtering
  - URLs stay shareable even though filtering is local because the dataset is loaded eagerly.



## User requests

- Route: `/app/requests`
- Same server-side request filters as the admin queue, but scoped to the current user by the API.
- Smart Filter Input is available; admin-only keys are rejected in user mode.

## DNS family additions

- DNS zone transfers: keyset pagination by `from_id` inside zone detail; no free-text search yet.
- DNSSEC records: read-only list inside zone detail; no free-text search.
- DNS zone servers status: keyset pagination by `from_id` inside zone detail; admin add/remove actions.
- Admin DNS servers: server-side `q`, `hidden`, `enable_user_dns_zones`, keyset pagination.
- Admin DNS TSIG keys: server-side `q`, `user`, `algorithm`, keyset pagination.
- User DNS TSIG keys (`/app/dns/tsig-keys`): the index request is scoped by
  the exact authenticated `user` and optional exact `algorithm` filters. The
  HaveAPI action applies the ascending, exclusive cursor predicate
  `id > from_id`. The UI requests the visible limit plus one, hides
  the look-ahead row, and uses the greatest visible ID as the next cursor. An
  exactly full terminal page therefore disables **Next** without issuing an
  empty follow-up request. Explicit backend ordering is tracked separately in
  issue #189.


- **Admin networking / Host IP addresses** (`/admin/networking/host-ip-addresses`)
  - Index: `HostIpAddress.Index` (`GET /api/v7.0/host_ip_addresses`) with keyset pagination.
  - Filters:
    - `q`
    - `user`
    - `vps`
    - `assigned`

- **Admin networking / IP assignment audit** (`/admin/networking/ip-address-assignments`)
  - Index: `IpAddressAssignment.Index` (`GET /api/v7.0/ip_address_assignments`) with keyset pagination.
  - Filters:
    - `q`
    - `user`
    - `vps`
    - `active`
    - `order`

- **Admin networking / Live monitor** (`/admin/networking/live`)
  - Index: `NetworkInterfaceMonitor.Index` (`GET /api/v7.0/network_interface_monitors`).
  - Filters:
    - `q`
    - `user`
    - `vps`
    - `node`
    - `order`
  - Polling list; no keyset cursor.

- **Admin networking / Top users** (`/admin/networking/traffic-users`)
  - Index: `NetworkInterfaceAccounting.UserTop` (`GET /api/v7.0/network_interface_accountings/user_top`).
  - Filters:
    - `q`
    - `year`
    - `month`
  - Cursor: `from_bytes`.

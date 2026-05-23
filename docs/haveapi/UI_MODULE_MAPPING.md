# WebUI Next → HaveAPI module mapping

This is a **developer-oriented** reference showing which HaveAPI resources/actions
power each major area of WebUI Next.

The goal is to make future development and upgrades practical:
- when a UI page breaks, you can quickly locate the server-side source
- when an API action changes, you can identify affected UI modules

> Notes:
> - The exact parameters (namespaces) are defined by HaveAPI. WebUI Next should always
>   follow the live schema (integrated mode uses `window.vpsAdmin.description`, standalone
>   mode may fetch `OPTIONS /v7.0/`).
> - Some server-side actions are blocking and return an `action_state_id` / transaction chain.

## Public pages (no login)

### Overview (`/`)
Uses public actions:
- `Cluster::PublicStats`
- `Node::PublicStatus`
- `Outage::Index`
- `NewsLog::Index`
- `HelpBox::Index` (for public noticeboard/info blocks)

### Outages (`/outages`, `/outages/:id`)
- `Outage::Index`, `Outage::Show`
- `OutageUpdate::Index` (timeline)
- `Outage::{Entity,Handler}::Index` (affected systems + handlers)

## Authentication / sessions

Depending on deployment mode:

- Integrated (vpsAdmin legacy login): token/description injected via `config.js.php` / BFF
- Standalone OAuth2: browser OAuth2 flow using the same auth provider

Session management is anchored in:
- `UserSession::*` resources/actions (list, show, close)

## User workspace (`/app/...`)

### VPSes
- `Vps::Index` / `Vps::Show`
- Action endpoints like start/stop/restart, passwd, console token
- Nested resources:
  - `Vps::NetworkInterface::*`
  - `Vps::Mount::*`
  - `Vps::Feature::*`
  - `Vps::MaintenanceWindow::*`

### Datasets
- `Dataset::Index` / `Dataset::Show`
- `Dataset::Snapshot::*`
- `Dataset::SnapshotDownload::*`
- `Dataset::Property::*` (when property editor is implemented)

### DNS
- `DnsZone::Index` / `DnsZone::Show` / `DnsZone::Create` / `DnsZone::Update` / `DnsZone::Delete`
- `DnsZone::DnsRecord::*` (record CRUD)
- `DnsRecordLog::Index` (zone logs / auditing)
- `DnsRecord::DynamicUpdate` (public dynamic update endpoint)

### Transactions / action states
- `TransactionChain::Index` / `Show`
- `Transaction::Index` / `Show`
- `ActionState::Index` / `Show` (blocking action monitoring)

### Profile / security
- `UserPublicKey::*` (SSH public keys)
- `UserSession::*` (list + close/revoke)

## Admin workspace (`/admin/...`)

Admin workspace is for support+ (level ≥ 21), but many operations require superadmin (role `:admin`).

### Nodes
- `Node::Index` / `Node::Show`
- `Node::Status` / `Node::PublicStatus`
- `Node::SetMaintenance` (from Maintainable mixin)

### Migration plans
- `MigrationPlan::*` (index/show/create/update depending on permissions)

### Cluster
- `Cluster::FullStats`
- `Cluster::Search`

## Dynamic features to keep in mind

Some actions/resources are defined dynamically; see:
- `docs/haveapi/DYNAMIC_EXTENSIONS.md`


# Domain coverage and reverse traceability

Reviewed source: `156a7c043e543b5f4a51fc962d16e31bd6eaa00f`, 2026-09-29.
This reverse map starts from the code surface, not only recovered recent requests.
The [generated inventory](IMPLEMENTATION_INVENTORY.md) lists 256 route declarations
(including layouts/indexes/redirects) and 63 API modules. Each module is assigned
once below so omissions are visible. The audit checks that assignment, not the
completeness of every action, permission or backend field. Counts are not test coverage.

## Module coverage

| Area / requirements | API modules | Behavioral documentation and scope |
| --- | --- | --- |
| Shared transport and type definitions; REQ-011/012/013/046 | [haveapi](../../src/lib/api/haveapi.ts), [haveapiEnvelope](../../src/lib/api/haveapiEnvelope.ts), [app](../../src/lib/api/app.ts), [appTypes](../../src/lib/api/appTypes.ts), [userTypes](../../src/lib/api/userTypes.ts) | [Contract](API_CONTRACTS.md). Request envelopes, errors, metadata and shared types. app/appTypes/userTypes are composition/type modules, not extra screens. |
| Shell preferences and lookup; REQ-005/009/013 | [webuiUserSettings](../../src/lib/api/webuiUserSettings.ts), [languages](../../src/lib/api/languages.ts), [clusterSearch](../../src/lib/api/clusterSearch.ts), [userLookups](../../src/lib/api/userLookups.ts) | [Contract](CONFIGURATION.md). Keyed preferences, language catalog and scoped object lookup/search; these feed multiple routes. |
| VPS lifecycle and configuration; REQ-014/015/017/018/020/021/023/028 | [vps](../../src/lib/api/vps.ts), [vpsAccess](../../src/lib/api/vpsAccess.ts), [vpsFeatures](../../src/lib/api/vpsFeatures.ts), [vpsMaintenance](../../src/lib/api/vpsMaintenance.ts), [vpsMounts](../../src/lib/api/vpsMounts.ts) | [Contract](ACTION_CONTRACTS.md#vps-and-resources). Create/power/delete/console, access, feature settings, maintenance and mounts; migration form has its own contract below. |
| User-data; REQ-042/046 | [vpsUserData](../../src/lib/api/vpsUserData.ts) | [Contract](API_CONTRACTS.md). Shared owner/VPS data adapter; pending server filter/cursor dependency is explicit. |
| Storage and export; REQ-044/047/048 | [datasets](../../src/lib/api/datasets.ts), [exports](../../src/lib/api/exports.ts) | [Contract](ACTION_CONTRACTS.md#storage-nas-snapshots-and-exports). Datasets, NAS, snapshots, plans, downloads, local/remote restore, exports and hosts; cursor proof remains bounded. |
| DNS; REQ-049 | [dns](../../src/lib/api/dns.ts), [dnsTransfers](../../src/lib/api/dnsTransfers.ts), [dnsTsigKeys](../../src/lib/api/dnsTsigKeys.ts), [dnsSecretScrubber](../../src/lib/api/dnsSecretScrubber.ts) | [Contract](ACTION_CONTRACTS.md#dns-and-networking). Zones/records, servers, transfers, DNSSEC/TSIG and secret scrubbing; save differs from publication. |
| Networks and addresses; REQ-043/050 | [networking](../../src/lib/api/networking.ts), [networks](../../src/lib/api/networks.ts), [locationNetworks](../../src/lib/api/locationNetworks.ts), [networkInterfaces](../../src/lib/api/networkInterfaces.ts), [ipAddresses](../../src/lib/api/ipAddresses.ts), [dnsResolvers](../../src/lib/api/dnsResolvers.ts) | [Contract](WORKFLOWS.md#dns-and-networking). Member traffic/address facts; admin networks, location attachment, interfaces, IP history and resolver configuration. |
| Users and credentials; REQ-029/039/040/041 | [users](../../src/lib/api/users.ts), [userDossier](../../src/lib/api/userDossier.ts), [userEnvironmentConfigs](../../src/lib/api/userEnvironmentConfigs.ts), [userMail](../../src/lib/api/userMail.ts), [userNamespaces](../../src/lib/api/userNamespaces.ts), [lifetimes](../../src/lib/api/lifetimes.ts) | [Contract](ACTION_CONTRACTS.md#account-and-user-administration). Profile/admin edits, lifecycle history, security/impersonation, MFA/keys/tokens, environment limits, recipient preferences and UID/GID namespaces. |
| Application review; REQ-030/031/032/033/034/035/036/038 | [requests](../../src/lib/api/requests.ts) | [Contract](ACTION_CONTRACTS.md#request-review). Registration/account-change queues, reconsideration, correction and pending localized reason presets. |
| Payments and finance; REQ-052 | [payments](../../src/lib/api/payments.ts), [finance](../../src/lib/api/finance.ts), [userAccounts](../../src/lib/api/userAccounts.ts) | [Contract](WORKFLOWS.md#payments-and-finance). Member payments, administrator assignment/bulk review, paid-until/monthly amount and forecast snapshots. |
| Task evidence and operational reports; REQ-012/051 | [actionStates](../../src/lib/api/actionStates.ts), [transactions](../../src/lib/api/transactions.ts), [monitoring](../../src/lib/api/monitoring.ts), [incidents](../../src/lib/api/incidents.ts), [oom](../../src/lib/api/oom.ts) | [Contract](WORKFLOWS.md#tasks-transactions-monitoring-incidents-and-oom). Action state versus chain/item, monitoring event decisions, incidents, OOM reports/rules/tasks and failure states. |
| Nodes and infrastructure; REQ-025/026/027/028 | [nodes](../../src/lib/api/nodes.ts), [nodeHistory](../../src/lib/api/nodeHistory.ts), [nodeCreateReconciliation](../../src/lib/api/nodeCreateReconciliation.ts), [cluster](../../src/lib/api/cluster.ts), [infra](../../src/lib/api/infra.ts), [clusterResources](../../src/lib/api/clusterResources.ts), [clusterResourcePackages](../../src/lib/api/clusterResourcePackages.ts), [osTemplates](../../src/lib/api/osTemplates.ts), [systemConfig](../../src/lib/api/systemConfig.ts) | [Contract](WORKFLOWS.md#nodes-cluster-and-migrations). Node/pool controls/history, cluster/environment/location maintenance, resource definitions/packages/assignments, OS templates and system configuration. Creation reconciliation is an uncertainty helper. |
| Migration plans; REQ-028 | [migrations](../../src/lib/api/migrations.ts) | [Contract](ACTION_CONTRACTS.md#migration). Plan and entry creation, start/cancel/delete; per-VPS migration itself uses the VPS adapter. |
| Mail and page content; REQ-053 | [mailer](../../src/lib/api/mailer.ts), [mailTemplateCreateReconciliation](../../src/lib/api/mailTemplateCreateReconciliation.ts), [helpBoxes](../../src/lib/api/helpBoxes.ts), [newslog](../../src/lib/api/newslog.ts) | [Contract](WORKFLOWS.md#security-advisories-audit-mail-and-content). Templates/translations/recipients, mailboxes/handlers/logs, help boxes and news. Reconciliation helper is not a second create endpoint. |
| Public status and advisory management; REQ-054/055 | [public](../../src/lib/api/public.ts), [outages](../../src/lib/api/outages.ts), [outageScopePaging](../../src/lib/api/outageScopePaging.ts), [securityAdvisories](../../src/lib/api/securityAdvisories.ts), [securityAdvisoryRelations](../../src/lib/api/securityAdvisoryRelations.ts), [securityAdvisoryUpdates](../../src/lib/api/securityAdvisoryUpdates.ts), [audit](../../src/lib/api/audit.ts) | [Contract](WORKFLOWS.md#security-advisories-audit-mail-and-content). Anonymous status/outages/advisories, scoped outage paging, privileged advisory relations/updates and audit records. |

## Routes and non-adapter boundaries

Route aliases, nested tabs and redirect/index entries are enumerated rather than
counted as independent features. Review the inventory’s parent layers as well as
page-level guards; neither URL presence nor a module link proves authorization.
Public/auth entry, member profiles, VPS/storage/DNS/network/operations and admin
users/requests/finance/cluster/content have corresponding sections in
[WORKFLOWS.md](WORKFLOWS.md). For an added route, document its action/state contract
in that area and inspect direct-link, invalid-ID, owner and role-denied behavior.

Important implementation outside src/lib/api must not disappear from review:

- BFF/bootstrap/session and impersonation: [architecture](ARCHITECTURE.md),
  [storage](CONFIGURATION.md), [account contracts](ACTION_CONTRACTS.md#impersonation).
- Layout, preferences, i18n, focus/dialogs and responsive behavior:
  [product design](PRODUCT_DESIGN.md); visual references are representative only.
- Draft/uncertainty locks and cross-tab identity: [write boundaries](ARCHITECTURE.md#writes-and-concurrency).
- External maps/heatmaps/console and HTML rendering: [security map](TROUBLESHOOTING.md#security-review-map).
- Build/proxy/deployment and issue automation: [operations](OPERATIONS.md),
  [issue-runner policy](../../deploy/ai-issue-runner/README.md).
- KB contracts, new hostname and private evidence transfer: [handover](HANDOVER.md).

## What remains unproven

All listed modules have a documentation destination; this is **domain coverage**,
not an exhaustive legacy parity verdict. The action catalog intentionally expands
critical workflows and recent changes rather than copying every TypeScript field.
For changed behavior, follow the [semantic review](DOCUMENTATION_REVIEW.md#semantic-review-required-for-every-behavior-change)
and update the relevant contract/evidence. New modules must be assigned here;
helper/type modules should be identified as such rather than inventing a user story.

Open proof includes full impersonation lifecycle, legacy expert action/field
comparison, exact-candidate live workflows, operator rehearsal and restricted
evidence transfer. See [requirement evidence](EVIDENCE_MATRIX.md) and handover gates.
An unknown historic rationale stays unknown; a source-derived preservation rule
does not become an explicit maintainer request merely by being put in this table.

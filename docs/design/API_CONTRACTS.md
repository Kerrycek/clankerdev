# API contracts and compatibility

Requirements: REQ-018–023, 035–055, 059. Source of request details is the checked
adapter plus the matching deployed backend revision, not a guessed legacy form.
[Adapter inventory](IMPLEMENTATION_INVENTORY.md) gives all current entry points.

## Cross-cutting contract

HaveAPI resources return envelopes and metadata. The client configures version,
metadata namespace and authentication header. Preserve typed failures, validation
messages, permission errors and transport ambiguity. Never equate missing/failed
data with an empty successful collection or silently broaden owner scope.

For each endpoint change review: method/path; supported filters; input units;
nullable/missing fields; role/ownership; ordering/cursor; success receipt; error
body/status; transaction/action-state behavior; cancellation/idempotency limits.
Frontend/server versions are independent and must be recorded together for live
claims. Local adapter tests verify serialization, not deployed backend capability.

| Contract | Implemented/required behavior | Evidence and caution |
| --- | --- | --- |
| UI settings | PUT `/webui_user_settings/{namespace}/{key}` with value-only resource body; URI-encode namespace/key. | [adapter](../../src/lib/api/webuiUserSettings.ts); collection PUT + POST fallback caused the persistence bug fixed by PR519. |
| Session JSON | Same-origin JSON with accessToken, sessionKey, sessionExpiresAt; anonymous values null; no secrets in executable config. | [server](../../bff/server.js), [auth](../../src/app/auth.tsx); retain origin/security checks. |
| Resource overrides | Explicit admin override only where backend action supports it. | PR503; do not infer that every create/edit endpoint accepts one universal flag. |
| Custom soft deletion | Admin lifecycle PUT for the supported future lifetime transition; member uses normal DELETE. | PR518; do not send invented expiry parameters to DELETE or use a delete-then-edit race. |
| Hard deletion | Explicit privileged mode; disregard a leftover soft-expiry draft. | PR518; validate actual backend permission and receipt. |
| Console entry | Acquire/reuse console token through existing API; bounded request on entry. | PR517; do not create unbounded replacement sessions during polling. |
| Registration reconsideration | Derive supported actions from actual request state/created-user constraints. | PR510; a generic state dropdown must not advertise unsupported transitions. |
| Effective timezone | Resolve actual account/server timezone when account field is absent. | PR502; Europe/Prague is a real zone ID, not a hardcoded label for all accounts. |
| Node heatmap | Use configured legacy base URL, validated node FQDN/type/maintenance eligibility. | [URL model](../../src/lib/nodeHeatmap.ts); missing config omits unavailable actions. |
| Async mutations | Require an appropriate action-state receipt, then track completion. | [action states](../../src/lib/api/actionStates.ts); success without required identity is uncertain. |

## Intentional capability and filter limits

These are the checked frontend contracts at the handbook baseline, not a new
certification of every deployed API version. A field displayed on an object is
not automatically a supported list filter. Pagination and includes metadata are
separate from filtering; filtering only the loaded page must not be presented as
a search of the whole collection.

| Collection | Supported filter boundary | Source / regression entry point |
| --- | --- | --- |
| Exports | Owner (`user`); no global text, dataset, snapshot, host or state filter in this adapter. Detail-by-ID is a separate request. | [adapter](../../src/lib/api/exports.ts), [fixture contract](../../e2e/specs/app/exports_filter_contract.spec.ts) |
| Networks | `location` and `purpose`; do not forward text, IP-version, role or managed-state filters merely because those attributes exist on a network. | [adapter](../../src/lib/api/networks.ts), [URL/filter fixture](../../e2e/specs/admin/cluster_networks_filter_contract.spec.ts) |
| Migration plans | `state` and `user`; no free-text query. This does not limit the separate destination-node picker for a VPS migration. | [adapter](../../src/lib/api/migrations.ts), [fixture contract](../../e2e/specs/admin/migration_plans_filter_contract.spec.ts) |
| Transaction items | `transaction_chain`, `node`, `type`, `success`, `done`; no item-name/text search. Transaction **chains** have a different contract which does accept `name`, as well as state, object and user/session filters. | [both adapters](../../src/lib/api/transactions.ts), [item-filter fixture](../../e2e/specs/app/transaction_items_filter_accessibility.spec.ts) |
| User namespaces / maps | No text or label search. Namespaces support `size`; maps support `user_namespace`. Owner filtering, and namespace `block_count`, are exposed only in admin scope with admin fields enabled and no fixed owner. Removing an invalid/disallowed URL filter resets cursor/page. | [scope/URL rules](../../src/components/userNamespaces/userNamespaceFilterSemantics.ts), [fixture contract](../../e2e/specs/app/user_namespace_filter_contract.spec.ts) |
| Resource packages | Adapter filters are `environment` and `user`, not package-label text. Global/personal/all scope normalization is handled by the list model. | [adapter](../../src/lib/api/clusterResourcePackages.ts), [model](../../src/pages/app/admin/cluster/ResourcePackagesListModel.ts), [model tests](../../src/pages/app/admin/cluster/ResourcePackagesListModel.test.ts) |

These test links are verification entry points, not a claim of a fresh live run.
Any extension needs a verified endpoint contract and scope/pagination regression
coverage; adding a search input alone does not establish server support.

### Node creation versus editing

The [node lifecycle model](../../src/pages/app/admin/nodes/NodeLifecycleModel.ts)
keeps role, location and bootstrap CPU/memory/swap capacity out of the edit payload,
although they participate in creation. Updates contain only changed `active`,
`name`, `ip_addr`, `max_tx`, `max_rx` and `max_vps` fields. Blank optional limits
must not become zero: clearing a populated limit sends null only when its API
metadata permits null; otherwise validation rejects the edit. An already-unset
limit is omitted. See [model cases](../../src/pages/app/admin/nodes/NodeLifecycleModel.test.ts).
Do not infer editability from the create form or silently add unsupported update
fields when reorganizing the node page.

## Pagination: known blockers

The common UI uses `from_id`/visited cursor history, but that alone does not define
ordering. The next cursor must agree with each backend's ordering and inclusivity.
A minimum ID is unsafe when time-ordered data has nonmonotonic IDs; equal timestamps
need deterministic tie handling. An empty page, a short page, an explicit next
cursor and an API error are different outcomes.

| Area | Requirement | Current tracked work | Release constraint |
| --- | --- | --- | --- |
| VPS user-data | Supported owner/format filters and honest search; stable multipage traversal. | Issue241, [PR496](https://github.com/Kerrycek/clankerdev/pull/496) | Pending; depends on backend work excluded by maintainer. |
| IP assignment history | Ordered cursor, tied times, owner scope, end/recovery. | Issue208, [PR507](https://github.com/Kerrycek/clankerdev/pull/507) | Pending; no lossless guarantee on current deployed contract. |
| Dataset/snapshot lists | Match actual dataset/snapshot order and cursor. | Issue189, [PR509](https://github.com/Kerrycek/clankerdev/pull/509) | Pending; frontend-only assumptions cannot fix unsupported server order. |

A prior isolated user-data run recorded three pages (25/25/1), owner/format/search,
error/end and cleanup checks against UI `3ac1be67` / API `320af0e1`. It does not
certify the deployed main or IP/dataset/snapshot cases, and its database timestamps
were not an adversarial time-order fixture. Keep this evidence scoped.

Backend PR43 concerns user payments and was present in test API `486350466`; it
is not the user-data/IP fix. Backend PR44 was later rejected by the maintainer.
Do not merge dependent work or revive frontend PR242 based on earlier approval.
A new agreed contract must precede release of the dependent fixes.

Required cursor matrix: at least three pages; nonmonotonic IDs versus timestamps;
tied timestamps; filtered/owner-specific lists; foreign-owner denial; malformed
cursor and API errors; previous/next/back/reload; empty/final page; no duplication
or omission. Local fixture success is not enough to prove the server's ordering.

## Dev deletion configuration limitation

Investigation recorded a missing default lifetime for VPS soft deletion in the dev
API environment. The frontend can expose supported modes and custom expiry, but
cannot decide the service's retention policy. Confirm whether the original delete
was accepted before retrying. The maintainer must choose the default policy before
an authorized shared configuration change; do not change a live VPS to test it.

## Backend proposal procedure

Capture sanitized reproduction, exact UI/API pins, current request/response,
expected supported behavior, owner/role boundary, ordering assumptions and tests.
Prepare a scoped proposal separately. Do not modify upstream repositories, shared
schemas or services without explicit matching authorization. Local references and
previous PR approval do not confer blanket permission.

## Concrete client contracts

The [action contracts](ACTION_CONTRACTS.md) specify request state transitions,
reason/placement rules, migration timing/IP serialization, deletion modes, resource
overrides and DNS validation. They are the reviewed frontend contract at the stated
revision; deployed backend permission/capacity remains authoritative. Contract
changes must identify the matching backend resource/action/version and have
adversarial tests, not just update an adapter type.

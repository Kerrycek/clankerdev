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

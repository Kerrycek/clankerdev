# vpsAdmin WebUI Next — functionality map

This document is a living map of product capabilities. It records what a user
or administrator needs to accomplish, the backend behavior that makes the
capability possible, how the legacy WebUI exposed it, and what WebUI Next
currently implements. It is not a route checklist and a route being present
does not mean that its workflow has reached parity or is finished.

## How to maintain this map

- Update the relevant capability in the same pull request as a material UX,
  API-contract, permission, or workflow change.
- Record intentional departures from the legacy UI and explain which product
  capability remains preserved.
- Keep backend facts tied to API/model sources. Do not infer permissions or
  side effects from button labels.
- Keep implementation claims tied to source and automated or live test
  evidence. Distinguish mocked browser tests from live API validation.
- Add newly discovered gaps even when they are not yet scheduled.

### Status vocabulary

| Status | Meaning |
| --- | --- |
| `mapped / implemented` | Capability, current workflow, and test evidence are documented; no known blocking gap is recorded. |
| `mapped / partial` | The main workflow exists, but a known capability, contract, safety, or UX gap remains. |
| `inventory only` | Routes/source exist, but legacy parity, API behavior, and end-to-end workflow have not yet been mapped here. |
| `not implemented` | A verified product capability has no WebUI Next implementation. |

### Evidence baseline

- WebUI Next reference before the admin-request redesign: `origin/main` at
  `c261a5b75c32b9ff7f08119bd182f6d77901e488` (2026-09-12). The admin-request
  section below maps the redesign in the same worktree as this document, not
  only that reference commit.
- New UI implementation: this repository, primarily `src/`, `bff/`, and
  `e2e/`.
- Backend contract and side effects: the read-only upstream vpsAdmin source,
  primarily `plugins/requests/api/` for the request capabilities below.
- Legacy behavior: the read-only upstream PHP WebUI, primarily
  `webui/forms/users.forms.php` and `webui/pages/page_adminm.php` for the
  request capabilities below.
- Practical target: `https://dev.crucio.cz`. A mocked Playwright test proves UI
  behavior against its fixture contract; it does not by itself prove that the
  deployed API accepts the same inputs.

The repository's older canonical-document pointers currently reference an
external `UI_REDESIGN.md` that is not part of this repository checkout. Several
derived route documents also still point at quarantined spec stubs. Until those
links are repaired, this map must cite concrete code/API/test evidence and must
not silently restore historical documents as current requirements.

---

## Transaction-chain audit pagination

**Status:** `mapped / partial`

The transaction-chain audit at `/app/transactions` and
`/admin/transactions` preserves the legacy capability to inspect asynchronous
work by exact chain, state, operation name, concern class/object, user, and user
session. Arbitrary user scope is admin-only; My view keeps exact filtering by
the current user's own session. Transaction-item diagnostics and the broader
task workflows are separate capability slices outside this section.

`TransactionChain.Index` uses descending keyset pagination. WebUI Next asks for
one more record than the selected visible page size, renders only the selected
25/50/100 rows, and derives the next cursor from the last visible chain. Next
is enabled only when the hidden look-ahead record proves another page exists;
an exact-size final page therefore no longer opens an empty page. A previously
visited forward cursor remains usable through the shared local cursor stack.

The combined `errors=1` view performs the same look-ahead independently for
the backend's `failed` and `fatal` states, deduplicates their union, orders it
by descending chain ID, and only then trims the visible page. Pinned chains are
supplemental status rows: they do not consume the page size or influence its
cursor and Next state.

Evidence:

- Backend contract and authorization:
  `api/lib/vpsadmin/api/resources/transaction_chain.rb` and
  `api/spec/api/resources/transaction_chain_read_spec.rb` in the read-only
  upstream vpsAdmin checkout.
- Legacy audit and filter workflow: `webui/pages/page_transactions.php` in the
  read-only upstream checkout.
- WebUI Next page and cursor stack:
  `src/pages/app/TransactionChainsPage.tsx` and
  `src/lib/hooks/useKeysetPagination.ts`.
- Mocked desktop/mobile browser contract:
  `e2e/specs/app/transaction_chains_keyset_pagination.spec.ts`.

The Playwright contract covers user/admin routes, exact terminal pages, a real
look-ahead boundary, Prev/Next cursor continuity, and the merged error-state
stream. It does not mutate or certify live transaction data. This fix makes
the final-page signal exact, but it does not claim lossless traversal while the
API applies an ID cursor to a query ordered first by `created_at`; that upstream
ordering limitation remains tracked by issue #189.

---

## Global object discovery

**Status:** `mapped / implemented`

Authenticated users need a search entry point that stays usable from every
application route. Administrators use the admin-only `Cluster.Search` action to
jump across supported cluster objects. Members cannot call that action; WebUI
Next instead searches only their permitted VPS, IP-address, and DNS-zone
surfaces, with the backend remaining authoritative for ownership.

The legacy administrator UI kept a small `jumpto` field in its global chrome,
submitted it to `Cluster.Search`, and either opened a unique result or rendered
the returned object list. WebUI Next preserves that global discovery capability
while using two viewport-specific entry points in `src/components/layout`:

- desktop keeps the inline header search and the `Ctrl/Cmd+K` or `/` command
  palette shortcut;
- below the `sm` breakpoint, a dedicated search button opens the existing
  full-screen command palette and focuses its input;
- public, OAuth, login-required, and forbidden-admin screens do not mount the
  authenticated application header.

The mobile button and desktop inline form are mutually exclusive, so a compact
touch target never masquerades as a text field with no writable width. Both
entry points use the same member/admin search implementations; changing the
responsive launcher does not change API filters or authorization.

Evidence:

- legacy workflow: read-only upstream `webui/pages/page_jumpto.php` and
  `webui/template/template.html`;
- backend authorization and response contract: read-only upstream
  `api/lib/vpsadmin/api/resources/cluster.rb`;
- current header, palette, and full-screen modal:
  `src/components/layout/AppHeader.tsx`, `AppLayout.tsx`,
  `CommandPalette.tsx`, and `src/components/ui/Modal.tsx`;
- mocked browser coverage: `e2e/specs/app/header_mobile_controls.spec.ts`,
  `command_palette.spec.ts`, and `user_global_search.spec.ts`.

The browser tests prove responsive containment, focus, and deterministic search
behavior against mocks. They do not grant or verify a deployed account's live
search permissions.

---

## Incident report listing and exact filters

**Status:** `mapped / implemented`

The incident-report lists at `/app/incidents` and `/admin/incidents` use the
backend's declared exact filters. They do not offer full-text search: the
`incident_reports` index has no `q`, `query`, `search`, `text`, or `subject`
filter contract.

| Scope | Exact list filters |
| --- | --- |
| All authenticated roles | `vps`, `ip_address_assignment`, `ip_addr`, `codename` |
| Admin only | `user`, `filed_by`, `mailbox` |
| Pagination | `limit` and descending-ID keyset cursor `from_id` |

Entering a numeric ID opens that incident; it is navigation, not a list
filter. The smart input accepts the supported `key:value` forms and reports
plain text, full-text aliases, and unknown keys without issuing a replacement
list request. Applying a supported filter resets the cursor. Direct-entry URLs
are normalized before the first list request: obsolete `q`, unauthorized
admin-only fields, and their stale cursor are removed while supported fields
and `limit` are preserved.

Only an authenticated administrator in the global admin view gets arbitrary
`user`, `filed_by`, and `mailbox` filter controls and the related includes.
Non-admin roles cannot choose or send arbitrary admin-only filters. In My view,
privileged admin and support accounts may send only their own user ID as an
implicit owner scope; that value is not exposed as a selectable filter or URL
parameter. Regular users rely on the backend's mandatory owner restriction,
which remains the authority for isolation and is applied before exact filters
and pagination.

Evidence:

- Backend filter and authorization contract:
  `api/lib/vpsadmin/api/resources/incident_report.rb` in the read-only upstream
  vpsAdmin checkout.
- Legacy exact-filter surface: `webui/forms/incidents.forms.php` in the
  read-only upstream checkout.
- WebUI Next request wrapper and parsing:
  `src/lib/api/incidents.ts` and
  `src/pages/app/incidents/incidentListSemantics.ts`.
- WebUI Next list workflow: `src/pages/app/incidents/IncidentsPage.tsx`.
- Contract tests: `src/lib/api/incidents.test.ts`,
  `src/pages/app/incidents/incidentListSemantics.test.ts`, and
  `e2e/specs/app/incidents_smart_filter.spec.ts`.

The Playwright coverage uses a strict mocked API to prove request
serialization, direct-entry URL hygiene, role gating, keyset retention, and
desktop/mobile containment. It does not prove a deployed backend's data or
authorization configuration; that still requires read-only live smoke checks
with separate admin and non-admin sessions. No create or other mutation is
part of that live verification.

### Safe admin incident creation

**Status:** `mapped / implemented`

The backend `incident_report#create` action is administrator-only and blocking.
It requires a VPS, subject, and text, creates the incident, and starts the
related transaction chain. The legacy WebUI submitted the form synchronously
and redirected to the affected VPS after success. WebUI Next preserves that
outcome while showing an explicit pending state and retaining its local VPS
lock until the request settles.

Submit and Cancel are both unavailable while creation is pending. Cancel is a
router-link styled as a button, so visual pointer blocking alone is not a safe
disabled state: keyboard or programmatic activation must not leave the form
while the blocking request can still succeed. Shared disabled/loading link
buttons now leave sequential focus order and suppress navigation, propagation,
and consumer click callbacks. Enabled router-link and anchor behavior is
unchanged. The compatibility `LinkButton` delegates to the same contract.

Evidence:

- Backend authorization, required inputs, blocking declaration, and transaction
  side effect: `api/lib/vpsadmin/api/resources/incident_report.rb` in the
  read-only upstream vpsAdmin checkout.
- Legacy form and successful redirect:
  `webui/forms/incidents.forms.php` and `webui/pages/page_incidents.php` in the
  read-only upstream checkout.
- WebUI Next workflow and shared control:
  `src/pages/app/admin/IncidentReportNewPage.tsx`,
  `src/components/ui/Button.tsx`, and `src/components/ui/LinkButton.tsx`.
- Unit and mocked browser coverage:
  `src/components/ui/Button.test.tsx` and
  `e2e/specs/app/vps_report_incident_action.spec.ts`.

The Playwright scenario deliberately delays a mocked create response to prove
that keyboard and programmatic Cancel activation stay on the form, then lets
the request complete and verifies the existing VPS redirect. It is not live
mutation certification and does not validate a deployed API or permission
configuration.
---

## Core VPS inventory pagination

**Status:** `mapped / partial`

The shared VPS inventory at `/app/vps` and `/admin/vps` follows the deployed
HaveAPI `from_id` contract: the endpoint advances with the exclusive predicate
`id > from_id`. WebUI Next requests one bounded lookahead row, renders only the
selected 25, 50, or 100 rows, and uses the greatest visible VPS ID as the next
cursor. The hidden row distinguishes a full page with more data from an
exactly full terminal page. Previously visited forward cursors remain
available after returning to an earlier page, and a stale cursor that produces
an empty page offers Previous instead of trapping the user in the empty state.
Browser Back and Forward restore the URL's filter set and its deep cursor
without a page-one request using stale local filter drafts.

Administrator filters for owner, node, location, namespace map, and hostname
remain server-side and reset pagination before the filtered request. In the
member workspace, privileged users in My view send their own owner ID while
regular users rely on the backend's mandatory owner restriction. Runtime-state
and IP-shaped searches remain client-side filters of the fetched page; they are
not full-inventory searches.

Evidence:

- Backend resource: `api/lib/vpsadmin/api/resources/vps.rb` in the read-only
  upstream vpsAdmin checkout, which applies HaveAPI `with_pagination`.
- WebUI Next request and page-window logic:
  `src/pages/app/VpsListPage.tsx` and
  `src/pages/app/vps/vpsListSemantics.ts`.
- Unit and strict mocked-browser coverage:
  `src/pages/app/vps/vpsListSemantics.test.ts`,
  `e2e/specs/app/vps_list_keyset_pagination.spec.ts`, and
  `e2e/specs/app/admin_scope_filters_requests.spec.ts`.

The upstream VPS index does not yet declare an explicit deterministic order,
so this UI follows the deployed ascending ID behavior but cannot itself
guarantee ordering if the backend changes it. That upstream hardening remains
tracked separately.

---

## Identity lifecycle and requests

The requests plugin models two related but different workflows:

- a **registration request**, submitted before an account exists and capable of
  creating an account and optionally its first VPS when approved;
- a **change request**, submitted by an existing user to change personal
  account information.

Both share the same state vocabulary, audit/notification infrastructure, and
admin resolution endpoint shape. They must remain visibly distinguishable in
the UI because their review data, side effects, and safe actions differ.

### Shared backend lifecycle

| Concern | Current contract |
| --- | --- |
| States | `awaiting`, `approved`, `denied`, `ignored`, `pending_correction` |
| Admin resolution actions | `approve`, `deny`, `ignore`, `request_correction` |
| List order/pagination | Descending ID with keyset `from_id` and `limit`; registration and change are separate API resources. |
| Admin list filters declared by the deployed/upstream API | `user`, `state`, `api_ip_addr`, `client_ip_addr`, `client_ip_ptr`, `admin` |
| Authorization | Index/show require authentication; admins may see all, non-admins are owner-restricted. Resolve is admin-only. |
| Common resolution side effects | The request is updated through a transaction chain, records the resolving admin and response, and normally sends request-state mail. `ignored` intentionally skips user notification in the backend transaction-chain implementation. |
| Same-state protection | Resolving to the request's current state is rejected by the backend. Other admin state changes remain possible. |

Backend sources:

- `plugins/requests/api/resources/base.rb`
- `plugins/requests/api/models/user_request.rb`
- `plugins/requests/api/models/transaction_chains/requests/create.rb`
- `plugins/requests/api/models/transaction_chains/requests/resolve.rb`
- `plugins/requests/api/models/transaction_chains/requests/update.rb`

### Capability: admin request review queue and decision

**Status:** `mapped / implemented`

#### Purpose and actors

Give an administrator a reliable work queue for reviewing new registrations
and requested profile changes, understanding the request and its risk, making a
deliberate decision, and following any resulting asynchronous operation. A
non-admin must not access this surface or its mutations.

#### Routes and current UI

- `/admin/requests` — combined registration/change queue.
- `/admin/requests/:type/:requestId` — full admin detail and resolution.
- `/admin/users/:userId` links back to requests filtered for that existing user.

Current implementation:

- `src/pages/app/admin/RequestsPage.tsx`
- `src/pages/app/admin/RequestsFilters.tsx`
- `src/pages/app/admin/RequestsListContent.tsx`
- `src/pages/app/admin/RequestsBulkActions.tsx`
- `src/pages/app/admin/RequestDetailPage.tsx`
- `src/pages/app/admin/RequestDetailModel.ts`
- `src/pages/app/admin/RequestFraudChecks.tsx`
- `src/pages/app/admin/RequestApproveOptions.tsx`
- `src/pages/app/admin/RequestResolveOverridesForm.tsx`
- `src/pages/app/admin/RequestResolveResources.ts`
- `src/pages/app/admin/RequestResolveMutation.ts`
- `src/pages/app/admin/RequestMutationUncertainty.tsx`
- `src/pages/app/admin/RequestReviewActions.tsx`
- `src/pages/app/admin/RequestReviewModel.ts`
- `src/pages/app/admin/RequestReviewTypes.ts`
- `src/pages/app/admin/RequestResolveReview.tsx`
- `src/pages/app/admin/RequestAddressMapLink.tsx`
- `src/pages/app/admin/RequestsModel.ts`
- `src/lib/api/requests.ts`
- `src/lib/requestsBadges.ts`

#### API surface used by WebUI Next

| Capability | Endpoint |
| --- | --- |
| List registration requests | `GET /v7.0/user_request/registrations` |
| Show registration request | `GET /v7.0/user_request/registrations/:id` |
| Resolve registration request | `POST /v7.0/user_request/registrations/:id/resolve` |
| List change requests | `GET /v7.0/user_request/changes` |
| Show change request | `GET /v7.0/user_request/changes/:id` |
| Resolve change request | `POST /v7.0/user_request/changes/:id/resolve` |

The UI merges the two independently paginated lists by descending ID. Both are
STI views of the same globally numbered request table, so they safely share one
exclusive `from_id` cursor. Each endpoint fetches one lookahead row beyond the
visible page size; the merged lookahead decides whether **Next** is available,
while the cursor always comes from the last visible row. Its default admin queue
requests only `awaiting`; `pending_correction` is a separate queue and
`state=all` is explicit. Filter state and keyset position are kept in the URL.
The list sends only structured filters declared by the Requests API; it does not
send the unsupported `q` parameter.

#### Registration review data and side effects

A registration request contains:

- proposed identity: login, full name, organization name/ID, e-mail, address,
  and year of birth;
- requested initial service: OS template and location;
- account preferences: currency, language, and optional IANA time zone;
- context: referral answer, note, API/client IP and PTR, created/updated time;
- IP and e-mail check lifecycle, messages/errors, detailed signals, and fraud
  scores.

Approving a registration always creates the user account. `create_vps`
controls whether the first VPS is created, `activate` controls activation, and
`node` may explicitly place the VPS. If a VPS is requested and no node is
supplied, the backend chooses one compatible with the requested location and OS
template. The returned action state, when present, is tracked in the WebUI Next
task drawer.

Backend sources:

- `plugins/requests/api/resources/registration.rb`
- `plugins/requests/api/models/registration_request.rb`

#### Change-request review data and side effects

A change request belongs to an existing user and contains a reason plus any of
`full_name`, `email`, and `address`. Approval applies the supplied values to the
existing account. A safe review therefore needs to communicate the actual
`current value → requested value` delta, not merely repeat the requested value.

Backend sources:

- `plugins/requests/api/resources/change.rb`
- `plugins/requests/api/models/change_request.rb`

#### Legacy workflow and preserved capabilities

Legacy sources:

- `webui/forms/users.forms.php`, functions `approval_requests_list()` and
  `approval_requests_details()`.
- `webui/pages/page_adminm.php`, functions `request_approve()`,
  `request_deny()`, `request_ignore()`, and `request_correction()`.

The legacy list displayed a large inline definition list under every row and
offered direct approve/deny/ignore links. Its full detail displayed all
registration fields, distinguished pending/failed/successful IP and mail
checks, exposed their detailed signals, showed old and requested values for a
change request, and generated the registration resolution form from the API
parameters.

WebUI Next intentionally replaces the legacy inline workflow with one review
path:

- the default screen is the `awaiting` work queue; visible state segments switch
  between `awaiting`, `pending_correction`, and an explicit all-state history,
  while a separately labelled segment switches request type. Technical API
  filters remain in a progressively disclosed advanced drawer with focus
  containment, Escape dismissal, and focus restoration;
- every compact desktop row or mobile card opens the canonical detail. The
  desktop request ID is a real link, the whole mobile card is a click target,
  and the ID link remains the row's single keyboard navigation stop. Bulk
  selection is an explicit mode with mixed-selection semantics for assistive
  technology. Inline expansion, inline decisions, and the duplicate expand-all
  workflow were removed;
- the main input opens a numeric request ID, suggests matching unregistered
  applicants from the visible queue by login/name/e-mail, or resolves an
  existing applicant account for the user filter. It no longer advertises
  unsupported free-text API search, and stale `q` query parameters are removed;
- an ID opened from the main input is accepted only when exactly one Show
  response matches the requested ID and its endpoint subtype. API failure is
  reported separately from a definitive not-found response. Typed detail URLs
  independently validate both subtype and exact ID and fail closed;
- the detail shows every registration field used by the request/approval
  contract: identity and organization, address and referral context, requested
  OS template/location, and currency/language/time-zone preferences;
- IP and mail checks independently show `pending`, `failed`, or `success`, keep
  the fraud score separate, surface provider messages/errors, and disclose the
  full available signal set on demand;
- change requests compare the current account value with the requested value.
  Current user data is fetched when possible, with an explicit degraded-state
  warning when only embedded or unavailable data can be shown. Unchanged,
  unavailable, empty-current, and intentional clear-to-empty values have
  distinct presentations;
- the admin list/detail and all resolution controls require the exact `admin`
  role, not merely admin-shell mode or a support role. Resolution controls are
  present only for `awaiting` requests. Registration additionally supports
  `request_correction`; the action is not offered for a change request because
  the backend has no correction/resubmission route for it;
- clicking a decision opens an action-specific confirmation with matching
  title, impact text, and submit label rather than asking for the action twice.
  Required reasons are enforced and limited to 500 characters; optional reason
  copy explains that it may be visible to the applicant. The confirmation
  names the applicant and shows the exact outbound response. On mobile the
  confirmation uses the full viewport and a responsive action footer;
- registration approval exposes create-VPS, account-activation, and conditional
  node placement. Compatible-node metadata is loaded without requiring the
  advanced override panel, and nodes are filtered by location, enabled/supported
  vpsAdminOS template metadata, and a strict v1/v2 cgroup allowlist; unknown or
  invalid cgroup values fail closed. A node is sent only when Create VPS is
  enabled;
- progressive overrides cover the complete registration resolve schema or all
  change fields. They are initialized from the request for understandable
  editing, but approval serializes only explicitly touched values, including an
  intentional empty-string clear; untouched current values are not redundantly
  resent. Required numeric/resource overrides cannot be cleared: invalid values
  are identified outside the collapsed advanced section, linked to their
  controls for assistive technology, and block submission. Correction sends the
  editable correction data expected by the backend;
- bulk mode is explicit and contextual rather than permanently occupying the
  queue. Only actions common to every selected `awaiting` row are available,
  a confirmation shows the exact request IDs/types, action, exact reason, and
  impact before any write. Every action change clears the old reason so text
  cannot leak into another decision. Partial failures remain
  selected, and registration approval is deliberately excluded so its
  account/VPS effects must be reviewed individually;
- immediately before every detail or bulk Resolve POST, the client repeats a
  Show request and requires the exact ID, subtype, and `awaiting` state. A stale
  target is refreshed without sending the mutation. A transport failure during
  this read-only preflight creates no uncertainty lock, remains retryable, and
  does not prevent bulk processing of untouched targets. Timeout/5xx/network
  results only after a mutation begins retain a durable per-request lock; bulk
  execution stops at the first ambiguous result, disables that locked target,
  and leaves all untouched rows selected. Clearing uncertainty requires opening
  tasks and re-reading the exact request; only a recognized resolved state
  clears automatically, while `awaiting` requires explicit confirmation and a
  missing/unknown response keeps the lock;
- list links carry the complete originating overview URL as `returnTo`.
  Detail/back and successful resolution preserve filters and pagination; the
  validator accepts only the admin request overview and fails closed for an
  external URL or another route;
- the detail Show query makes one initial attempt. A transport/server failure
  exposes an in-place Retry that refetches only the same GET while Back always
  uses the sanitized `returnTo`; neither recovery action can submit a mutation.
  An invalid typed URL, an exact HTTP 404, a legacy HTTP-200 HaveAPI not-found
  envelope without a transport status, or a response whose exact ID/subtype
  does not match the URL is definitive: the page shows only an explicit safe
  return to the request overview and never renders resolution controls;
- registration addresses are geocoded automatically for an embedded
  OpenStreetMap preview, with retry and not-found states;
- resulting action-state and transaction links are exposed when the API
  supplies them.

These changes preserve the core list/show/resolve capability, the full legacy
review data, and supported overrides while removing legacy one-click mutations
and the competing inline/full-detail workflows. They do not change backend
states, permissions, score thresholds, or approval side effects.

#### Known limitations and deliberate follow-up

1. **Direct ID lookup still queries two resources.** Registration and change
   have separate Show endpoints and no authoritative cross-type lookup. The UI
   queries both and accepts only an exact ID/subtype match from exactly one
   endpoint; ambiguous, malformed, or mismatched responses fail closed. Normal
   navigation from a list row already knows the type and skips this lookup.

2. **Current values for change requests depend on user data availability.** A
   failed current-user lookup cannot manufacture an old value; the detail uses
   embedded data where available and displays a warning otherwise. A backend
   response containing an immutable before/after snapshot would be stronger.

3. **The address map is an external-data flow.** The browser sends the full
   registration address to Nominatim/OpenStreetMap. Retry and not-found states
   improve reliability, but availability and privacy still depend on that
   external service and this behavior must remain documented.

4. **Applicant text search is necessarily local/indirect.** The Requests API
   does not declare a general `q` filter. The UI can suggest unregistered
   applicants only from the currently loaded request page; its server-backed
   suggestions search existing users and then apply the supported `user`
   filter. Searching every historical unregistered applicant would require a
   backend-supported filter or search endpoint.

5. **The preflight is not an atomic mutation condition.** Re-reading exact ID,
   subtype, and `awaiting` immediately before Resolve substantially narrows the
   stale-review window, but another administrator can still resolve the request
   between that GET and the POST. Eliminating this residual race requires the
   backend Resolve action to accept and atomically enforce an expected state or
   version.

6. **There is no dedicated “review next” command.** Returning after a decision
   now preserves the exact queue context, but the administrator still chooses
   the next row from that queue. This is a possible efficiency enhancement, not
   a parity or safety blocker.

7. **Live API mutation certification remains intentionally incomplete.** An
   approval can create an account and create/activate a VPS. A full live test
   requires a disposable registration fixture and an agreed cleanup contract;
   deterministic mocks are not evidence of those production side effects.

#### Test evidence for the redesign worktree

Current local evidence at the time this map was updated:

- TypeScript `tsc --noEmit`: **PASS**.
- Full Vitest run: **208 files, 1048 tests passed**, including target identity,
  preflight, payload/clear semantics, resource labels, query invalidation,
  durable-lock references, fail-closed `returnTo`, and risk-state models.
- `e2e/specs/admin/requests_operations_smoke.spec.ts`, Chromium: **30/30
  passed**. Coverage includes the canonical row/card-to-detail path, exact
  wrong-ID/type failure, stale detail and bulk preflight without a Resolve POST,
  ambiguous-result locks, exact bulk target/reason confirmation, reason-action
  switching, intentional clears, minimal template metadata, compatible nodes,
  no-change/clear/empty-value comparison, API outage versus not-found, fraud
  states/signals, automatic map states, and safe return context.
- Focused request-detail recovery tests: **26/26 Vitest assertions passed** in
  `RequestDetailModel.test.ts` and `RequestDetailPage.test.tsx`; the dedicated
  Playwright spec passed **3/3 Chromium** scenarios plus **1/1 mobile** recovery
  scenario. They cover an in-document 503 → Retry → success sequence with
  exactly two GETs and zero POSTs, filtered/default/malicious `returnTo`, exact
  HTTP 404 and legacy HaveAPI not-found envelopes, invalid URLs, and wrong
  ID/subtype responses without resolution controls.
- Targeted mobile/responsive run: **5/5 passed**, including 320 px containment,
  whole-card navigation, mixed selection, decision-first detail layout, and the
  full-viewport responsive confirmation.
- Full PR-equivalent local gate: **PASS** — Tailwind/pattern lint, CSP audit,
  i18n audit (**4455/4455**), script tests (**88/88**), BFF tests (**15/15**),
  TypeScript, production build (**2730 modules**), and the Vitest run above all
  passed.
- Existing `e2e/specs/app/admin_requests_keyset_pagination.spec.ts` covers
  merged independent cursors, and
  `e2e/specs/app/admin_scope_filters_requests.spec.ts` covers admin versus
  owner filter scope.

The Playwright coverage above runs against deterministic HaveAPI mocks. In
addition, the deployable source was served from an isolated temporary Vite
preview on the `admin.crucio.cz` host and exercised with a fresh four-hour admin
session through the real local API: **50 desktop rows, 50 mobile rows, desktop
and mobile detail opened, 0 writes, 0 observed API errors**. The decision modal
was opened only to verify its disabled no-reason state. This was not a public
deployment and does not certify destructive Resolve side effects; those still
require the disposable-fixture guard described above.

### Capability: authenticated “My requests” history

**Status:** `mapped / implemented`

#### Purpose and actors

Let an authenticated user see the state and administrator response for their
own registration and personal-data change requests without exposing another
user's request data. This is a history/status surface, not an admin decision
surface.

#### Routes and implementation

- `/app/requests`
- `/app/requests/:type/:requestId`

Sources:

- `src/pages/app/requests/MyRequestsPage.tsx`
- `src/pages/app/requests/MyRequestDetailPage.tsx`
- `src/pages/app/requests/MyRequestsModel.ts`
- `src/pages/app/requests/useMyRequestsPagination.ts`
- `src/lib/api/requests.ts`

The list combines registration and change history, supports type/state filters,
and paginates the two API resources with independent cursors before merging
them. The registration detail displays the submitted identity, requested
template/location, account preferences, referral/note, state, timestamps, and
admin response. A change detail displays the requested values and reason.

#### Ownership and permissions

The API owner-restricts non-admin index/show calls. WebUI Next adds a second,
fail-closed ownership check before rendering any row or detail. When an admin
account deliberately opens the user-mode surface, it sends an explicit owner
filter because admins are not owner-scoped by the backend.

#### Intentional differences from admin review

- No admin-only filters, IP/fraud diagnostics, operational links, or resolution
  actions are rendered.
- The list defaults to all of the signed-in user's history instead of the admin
  `awaiting` work queue.
- Status and the administrator's response are the primary information.

#### Test evidence

- `e2e/specs/app/user_requests_smoke.spec.ts`
  - owner-only list/detail behavior;
  - explicit owner scoping for an admin using self view;
  - fail-closed handling of foreign or ownerless API data;
  - independent-cursor merged pagination without skipped history.
- `src/lib/api/requests.test.ts`
  - owner assertions, safe parameters, and fail-closed wrappers.

No blocking gap is recorded for this capability at the baseline. Any future
ability to edit or resubmit a request belongs to the correction capability
below and must not weaken owner isolation here.

### Capability: tokenized registration correction and resubmission

**Status:** `mapped / implemented`

#### Purpose and actors

Allow a registration applicant who does not yet have an account to correct a
request after an administrator asks for more information. Access is granted by
the opaque request-specific token in the URL, not by an authenticated session.

#### Route and implementation

- `/requests/registrations/:requestId/:token`

Sources:

- `src/pages/public/RegistrationCorrectionPage.tsx`
- `src/lib/api/requests.ts`
- `src/lib/timeZones.ts`
- `plugins/requests/api/resources/registration.rb` in the backend source.

#### API and lifecycle

| Step | Endpoint | Backend guard/result |
| --- | --- | --- |
| Preview correction | `GET /v7.0/user_request/registrations/:id/:token` | Unauthenticated, but requires matching ID, access token, and `pending_correction` state. Returns the admin response and editable request fields. |
| Resubmit correction | `PUT /v7.0/user_request/registrations/:id/:token` | Same token/state guard. Validates the registration and schedules an update transaction. |
| Lifecycle result | backend update transaction | Updated request returns to `awaiting`, advances mail-thread state, and notifies the relevant parties. |

The form currently lets the applicant edit login, full name, organization,
e-mail, address, year of birth, referral answer, note, OS template, location,
currency, language, and time zone. It loads public location/template/language
choices and keeps the request's existing option visible when necessary.
Required fields gate submission and API validation errors remain visible. The
nullable time zone is prefilled without falling back to the browser zone. The
picker shares the account-preferences IANA option semantics, pins useful
current/server/browser choices, and exposes server default as an explicit clear
that sends `time_zone: null` rather than omitting the key.

#### Legacy capability and current workflow

The product capability comes from the Requests plugin's public `Preview` and
tokenized `Update` actions. WebUI Next provides a dedicated responsive public
form, shows the administrator's correction message before the fields, and does
not require the applicant to obtain an account session that cannot yet exist.

`request_correction` is intentionally offered by WebUI Next only for
registration requests. The backend has no equivalent tokenized preview/update
route for change requests; putting a change request into
`pending_correction` would strand the user.

#### Nullable time-zone safety

The tokenized PUT wrapper requires `time_zone: string | null`, matching the
backend registration schema and preventing accidental omission from the
resubmission payload. A null/undefined preview selects server default without
auto-selecting the browser zone. A legacy invalid preview value remains visible
with an error and blocks submission until the applicant selects a valid IANA
zone or explicitly clears it. The existing exact ID, token, and
`pending_correction` backend guards remain unchanged.

#### Test evidence

- `e2e/specs/app/public_registration_correction_smoke.spec.ts`
  - token preview, time-zone prefill/change, exact namespaced PUT value,
    explicit own `null` clear key, successful resubmission, invalid-token
    fail-closed behavior, and no horizontal overflow;
  - targeted run: three scenarios in Chromium and mobile Chromium, six passed.
- `src/pages/public/RegistrationCorrectionPage.test.tsx`
  - page-level prefill/change/clear behavior, accessible label/help, and
    invalid legacy-zone submission guard.
- `src/lib/api/requests.test.ts`
  - token path encoding and namespaced update payload for both an IANA string
    and an explicit `null` clear.
- `src/lib/timeZones.test.ts`
  - shared picker emits only valid, deduplicated contextual IANA choices.

The targeted API, utility, and page Vitest run passes 22 tests across three
files. The full Vitest suite passes 1,043 tests across 207 files, and TypeScript
typechecking also passes.

The automated flow is mocked. A live test must use a disposable registration,
exercise the `pending_correction → awaiting` transition, verify token expiry by
state, and clean up the fixture; do not test this by mutating a real applicant.

---

## OAuth authorization start and callback recovery

**Status:** `mapped / implemented`

### Purpose and routes

The OAuth BFF keeps the client secret and access/refresh tokens out of the
static frontend while giving browser users a safe way to start or recover from
sign-in:

- `/oauth/login` stores a sanitized same-origin `next` path, creates a
  short-lived single-use state value, and redirects to the configured identity
  provider;
- `/oauth/callback` validates and consumes state before exchanging the
  authorization code, rotates the session ID after authentication, and returns
  a successful login to the validated `next` path (default `/app`);
- `/oauth/error` is the clean, BFF-owned recovery destination for callback
  failures.

Provider denial, a missing code, invalid/expired state, and token-exchange
failure all clear the pending state and `next` value and respond with a `303`
to the exact path `/oauth/error`. The callback never copies `code`, `state`,
`error`, or `error_description` into that redirect or its HTML. The error page
uses Czech or English according to `Accept-Language`, fits narrow viewports,
and offers two real navigation targets: retry at
`/oauth/login?next=%2Fapp` and return to the public status at `/`.

The BFF marks both the failure redirect and error document `no-store` and
`no-referrer`, with a restrictive CSP and framing/content-type protections.
Deployment nginx configs select `no-referrer` for the complete `/oauth/`
namespace and hide any upstream `Referrer-Policy`, so the public proxy emits
one unambiguous policy rather than combining it with the site's normal
`strict-origin-when-cross-origin` policy.

Implementation and automated evidence:

- `bff/server.js`
- `bff/oauth-error-page.js`
- `bff/server.test.js` — real BFF routes and sessions against a local fake token
  endpoint, including all failure classes, state cleanup, successful callback,
  and safe bilingual output;
- `bff/security.test.js` — redirect-target sanitization and OAuth state
  invariants;
- `scripts/oauth-nginx-policy.test.mjs` — checked-in dev/kra configs and both
  generated clankerdev nginx variants.

These tests exercise the real local BFF boundary with a fake identity provider;
they do not claim a live provider login was performed.

### Password-recovery hand-off

An OAuth server that finishes password recovery by starting a fresh WebUI
authorization should use the BFF login route, not a client-rendered SPA route.
Configure `oauth2_clients.authorization_start_uri` per host as:

- `https://clankerdev.vpsfree.cz/oauth/login?next=%2Fapp`
- `https://dev.crucio.cz/oauth/login?next=%2Fapp`

Set `authorization_start_requires_user_action=false` for the seamless restart.
The audited backend password-recovery work at revision `791ab3a` is not merged
into upstream master and its feature flag defaults to disabled. This mapping
therefore documents the correct new-UI hand-off but does not claim that
end-to-end password recovery is currently enabled or deployed.

---

## Transaction-item diagnostics and reliable page boundaries

**Status:** `mapped / implemented`

The shared transaction-item list at `/app/transactions/items` and
`/admin/transactions/items` is the drill-down for asynchronous operational
work. It exposes the backend's exact `transaction_chain`, `node`, `type`,
`done`, and `success` filters; a numeric transaction ID opens its detail rather
than pretending to be a full-text search. Regular users remain restricted by
the backend to their own transactions, while the administrator response also
contains operational fields such as user, type, urgency, priority, input, and
output.

`Transaction::Index` applies descending keyset pagination and explicitly orders
by `transactions.id DESC`; `from_id` is an exclusive boundary. WebUI Next asks
for the selected visible limit plus one, renders only the visible rows, and
uses the extra row only as proof that another page exists. The next cursor is
always the last visible transaction ID. This intentionally improves on the
legacy `Pagination\System` count-equals-limit heuristic, which offered a false
Next action whenever the final page happened to be exactly full. The largest
UI page requests 501 records, within the API maximum of 1000.

Evidence:

- backend contract and authorization:
  `api/lib/vpsadmin/api/resources/transaction.rb` and
  `api/spec/api/resources/transaction_read_spec.rb` in the read-only upstream
  checkout;
- legacy chain/item workflow and paginator:
  `webui/pages/page_transactions.php` and `webui/lib/pagination.lib.php` in the
  read-only upstream checkout;
- WebUI Next request and list implementation:
  `src/lib/api/transactions.ts`, `src/pages/app/TransactionsListPage.tsx`, and
  `src/pages/app/transactions/TransactionItemsRouteGuard.tsx`;
- deterministic desktop/mobile contract coverage:
  `e2e/specs/app/transactions_items_keyset_pagination.spec.ts`.

The Playwright test proves the lookahead request, hidden sentinel, exclusive
cursor continuity, exact-terminal Next state, previous-page history, and both
user/admin route variants against a strict mock. It performs no live mutation.
A read-only live smoke check can confirm deployed rendering and authorization,
but real data cannot deterministically guarantee an exact page boundary.

---

## Dataset backup-plan automation

### Capability: understand, assign, and remove automatic dataset plans

**Status:** `mapped / implemented`

#### Purpose and actors

A dataset plan is an administrator-defined set of automatic actions applied to
one dataset. The plans currently registered by the backend schedule group
snapshots or copies to backup storage. An owner may assign or remove only the
environment plans whose respective `user_add` or `user_remove` flag permits it.
An administrator may manage all plans available in the dataset's environment.

#### Backend contract and effects

| Capability | Endpoint and contract |
| --- | --- |
| List assigned plans | `GET /v7.0/datasets/:datasetId/plans`; owner-restricted for a regular user, admin-accessible, and capable of including `environment_dataset_plan__dataset_plan`. |
| List plans available in the environment | `GET /v7.0/environments/:environmentId/dataset_plans`; a regular user is restricted to `user_add=true`, while an admin may list all; `dataset_plan` is includable. |
| Assign | `POST /v7.0/datasets/:datasetId/plans` with the exact namespaced body `{ "plan": { "environment_dataset_plan": ID } }`. The backend verifies that the plan belongs to the dataset's environment and enforces `user_add` for non-admins. |
| Remove | `DELETE /v7.0/datasets/:datasetId/plans/:assignedPlanId`. The path ID is the `DatasetInPoolPlan` assignment ID, not the environment-plan or base-plan ID; the backend enforces `user_remove` for non-admins. |
| Explain the plan | The nested base `DatasetPlan` exposes `label` and `description`; the environment relation adds the displayed label and permission flags. |

Assign and remove both perform dataset object-state checks. Registering or
unregistering a plan creates or removes the scheduled dataset actions defined
by that plan. Current implementations include repeatable group-snapshot and
backup-copy actions.

Backend sources in the read-only upstream repository:

- `api/lib/vpsadmin/api/resources/dataset.rb`, resource `Dataset::Plan`;
- `api/lib/vpsadmin/api/resources/environment.rb`, resource
  `Environment::DatasetPlan`;
- `api/lib/vpsadmin/api/resources/dataset_plan.rb`;
- `api/lib/vpsadmin/api/dataset_plans.rb`.

#### Legacy and current workflows

The legacy dataset edit form in `webui/forms/dataset.forms.php` listed each
environment-plan label beside the nested base-plan description, then exposed a
single environment-plan selector. Its add/delete actions in
`webui/pages/page_dataset.php` sent the environment-plan ID on create and the
assigned-plan ID on delete.

WebUI Next exposes the capability at:

- `/app/backups?tab=plans`, including direct dataset selection through
  `dataset=:id`;
- `/app/datasets/:datasetId/plans` and `/app/nas/:datasetId/plans`;
- `/admin/datasets/:datasetId/plans` and `/admin/nas/:datasetId/plans`.

The backup center explains the purpose before a dataset is selected. Once a
dataset is selected, the assigned list requests the full nested relation and
shows the backend description as the primary explanation, with the technical
base-plan label retained as subdued source metadata. Missing, null, whitespace,
or unresolved descriptions get an explicit safe fallback. The assignment
dialog likewise previews the description before submission. Client-side gates
mirror `user_add` and `user_remove`, fail closed for unresolved regular-user
permission data, and retain the backend's administrator bypass. The POST body
and delete target remain unchanged.

Current sources:

- `src/pages/app/backups/BackupCenterPage.tsx`;
- `src/pages/app/backups/BackupCenterDatasetWorkspaceView.tsx`;
- `src/pages/app/datasets/DatasetPlansPage.tsx`;
- `src/lib/api/datasets.ts`;
- Czech and English storage locale modules under `src/i18n/locales/`.

#### Test evidence and limits

- `src/lib/api/datasets.test.ts` verifies both nested include query parameters.
- `src/pages/app/datasets/DatasetPlansPage.test.tsx` renders the real page and
  covers descriptions and all fallback shapes, exact includes and mutation IDs,
  regular-user gates, unresolved permission data, and the administrator bypass.
- `e2e/specs/app/backup_center.spec.ts` directly opens
  `/app/backups?tab=plans&dataset=10` on desktop and mobile, verifies explanatory
  copy, descriptions, include parameters, exact assignment payload, and
  document-width containment against deterministic HaveAPI mocks.

These tests validate the browser/API contract without mutating a real dataset.
A live assignment would create scheduled work and therefore requires a
disposable dataset and an agreed cleanup plan; it is not implied by the mocked
evidence.

## User payment history traversal

**Status:** `mapped / partial`

Authenticated members can inspect their accepted-payment history on
`/app/payments`; administrators can inspect the same history for a selected
member on `/admin/users/:userId/payments`. The administrator surface keeps the
related account settings and manual-payment controls, but browsing history is
read-only and does not invoke those mutations.

`UserPayment::Index` owner-restricts ordinary members, accepts an exact `user`
scope for administrators, applies descending keyset pagination, and orders by
`created_at DESC, id DESC`. Both WebUI Next surfaces use the endpoint's existing
descending ID cursor, ask for one additional row, render only the selected
limit, and expose **Next** only when that hidden look-ahead row exists (or a
forward page was already visited). This avoids an empty page when the final
result contains exactly 25, 50, 100, or the administrator-only 200 rows. The
largest request is 201 rows, below the HaveAPI maximum of 1,000.

The current backend cursor predicate is ID-only even though time is the primary
sort key. Historical rows whose IDs are not monotonic with `created_at` can
therefore still be skipped by complete multi-page traversal. Issue #189 tracks
the required deterministic upstream order/cursor contract; this frontend fix
claims only truthful exact-terminal detection under the current API.

The legacy administrator-wide payment history uses `from_id`, but its shared
paginator infers another page from `count == limit`; it therefore has the same
exact-terminal false positive. The legacy per-user payment panel lists a
single bounded result without pagination controls. WebUI Next intentionally
provides consistent traversable history in both member and administrator
contexts while preserving the API's role boundary.

Evidence:

- Backend ordering, filtering, and authorization:
  `plugins/payments/api/resources/user_payment.rb` in the read-only upstream
  checkout.
- Legacy administrator and per-user presentations:
  `webui/forms/users.forms.php` and `webui/lib/pagination.lib.php` in the
  read-only upstream checkout.
- WebUI Next API wrapper and surfaces: `src/lib/api/payments.ts`,
  `src/pages/app/payments/PaymentsPage.tsx`, and
  `src/pages/app/admin/user/AdminUserPaymentsPage.tsx`.
- Deterministic desktop/mobile contract coverage:
  `e2e/specs/app/payments_page.spec.ts` and
  `e2e/specs/admin/user_payments_smoke.spec.ts`.

The browser tests use strict HaveAPI mocks with monotonic IDs/timestamps to
prove the look-ahead boundary, current ID-cursor continuity, owner/admin request
shapes, and visible row limit. Authorization and owner restriction are evidenced
by the cited upstream resource rather than emulated by the browser mock. The
tests do not prove traversal of non-monotonic live history, certify live payment
data, or perform a real payment/account mutation.

---

## DNS record change history

**Status:** `mapped / implemented`

The authenticated zone log at `/app/dns/zones/:zoneId/logs` lists record
changes for one mandatory `dns_zone` scope. Its optional server-side filters
match the HaveAPI contract exactly: record `name`, record `type`, and
`change_type`. All three are exact-match filters. The backend does not declare
a general `q` input, so WebUI Next neither advertises nor sends one.

The controls keep an editable draft and send a request only after **Apply
filters**. Applied state is stored in the URL. Before the first list request,
the page removes a stale `q`, blank names, unsupported type/change values, and
their stale cursor. Applying or clearing valid filters likewise resets
`from_id` and page to the first keyset page, while the selected page size
remains intact. Change badges translate the real enum values `create_record`,
`update_record`, and `delete_record`; an unknown future value remains visible
as neutral raw text.

Contract and implementation evidence:

- backend: `api/lib/vpsadmin/api/resources/dns_record_log.rb` and
  `api/models/dns_record_log.rb` in the read-only upstream repository;
- legacy structured filters: `webui/forms/dns.forms.php` in the read-only
  upstream repository;
- WebUI Next: `src/pages/app/dns/DnsZoneLogsPage.tsx` and
  `src/lib/api/dns.ts`;
- focused checks: `src/lib/api/dns.test.ts` and
  `e2e/specs/app/dns_zone_logs_keyset_pagination.spec.ts`.

The Playwright check uses a strict deterministic HaveAPI mock and covers exact
query serialization, URL/apply/clear behavior, keyset reset, enum badges, and
desktop/mobile containment. It does not prove that a deployed API accepts the
filters, returns production-shaped history, or enforces zone ownership. A
read-only live smoke check should inspect the three filtered GET requests with
an owned test zone; no DNS mutation is needed for that verification.

---
## Pending mutation confirmation safety

**Status:** `mapped / implemented`

Administrators and users must retain visible context while a confirmed write is
still awaiting its API result. The shared confirmation dialog therefore treats
`confirmLoading` and `cancelDisabled` as one cancellation contract: the Cancel
button, Escape key, and backdrop click are all inert until cancellation is
allowed again. This prevents a slow write from being hidden while its outcome
is still unknown. When a confirmation is opened from a drawer, Escape ownership
also stays with the foreground overlay: a newer modal can close without taking
the drawer and its pending confirmation with it.

Node maintenance is the concrete admin workflow used for browser verification.
The backend exposes the admin-only
`POST /v7.0/nodes/:node_id/set_maintenance` action with required `lock` and an
optional reason. The legacy WebUI submits the maintenance form and waits for
that API action before redirecting or showing the failure. WebUI Next keeps its
responsive confirmation visible during the same in-flight interval and closes
it after the successful result.

Evidence:

- Backend contract: `api/lib/vpsadmin/api/maintainable.rb` in the read-only
  upstream checkout.
- Legacy workflow: `webui/pages/page_cluster.php` in the read-only upstream
  checkout.
- Shared UI contract: `src/components/ui/ConfirmDialog.tsx`,
  `src/components/ui/Drawer.tsx`, and `src/components/ui/ConfirmDialog.test.tsx`.
- Delayed admin mutation coverage:
  `e2e/specs/admin/node_detail_control_center.spec.ts`.

The component test exercises every dismissal path directly from pending props.
The Playwright test uses a delayed mocked maintenance endpoint to prove that
keyboard, pointer, and visible button dismissal remain blocked without sending
a duplicate write. Neither test performs or certifies a live maintenance
mutation.

---

### MFA known-device history and pagination

Status: `mapped / implemented` for the active-device list, responsive review,
local page filter, pagination, and explicit Forget action in both the account
and administrator user views.

#### Purpose and backend contract

The legacy administrator UI presents known login devices so an operator can
review browser, operating-system, address, last-seen, and temporary MFA-trust
information and explicitly forget a device. It accepts a bounded limit but does
not expose cursor navigation. WebUI Next keeps that security-review purpose,
adds the same panel to the owner's MFA page, and retains an explicit confirmed
Forget action.

The API resource is nested at `users/:userId/known_devices`. It returns only
active `UserDevice` rows for the path owner and authorizes either an
administrator or that exact owner. Its HaveAPI pagination cursor is exclusive
and ascending (`id > from_id`); there is no arbitrary-user query filter to
invent or widen.

#### Current WebUI Next workflow

- `/app/profile/mfa` reviews the signed-in owner's devices, while
  `/admin/users/:userId/mfa` uses the same panel for the exact path user.
- Each page requests one bounded lookahead row (26, 51, or 101), renders and
  summarizes only the selected 25, 50, or 100 visible rows, and never exposes
  the sentinel through the local filter.
- Next uses the greatest valid visible ID. An exact terminal page disables
  forward navigation instead of opening an empty page.
- A previously visited forward edge is replaced from the current successful
  response and later remembered edges are hidden. If removal empties the
  current cursor page, the URL is replaced with the closest previous page, so
  neither page controls nor browser history can reopen the obsolete edge.
- Background refresh keeps the current page structure mounted while disabling
  navigation, so periodic polling cannot drop a focused page control.
- Changing the local page filter removes `from_id` and returns to page 1 before
  the replacement page request; browser Back and Forward hydrate the input and
  restore only the cursor belonging to that historical filter state.

Current sources:

- `src/components/user/UserKnownDevicesPanel.tsx`;
- `src/components/user/UserKnownDevicesModel.ts`;
- `src/components/user/UserKnownDevicesList.tsx`;
- `src/lib/api/userDossier.ts`.

#### Test evidence and limits

- `src/components/user/UserKnownDevicesModel.test.ts` verifies hidden
  lookahead rows, maximum visible cursors, exact terminal pages, and fail-closed
  invalid IDs.
- `e2e/specs/app/known_devices_keyset_pagination.spec.ts` uses a finite mock
  that enforces `id > from_id` and the requested limit. Desktop and mobile runs
  cover owner and administrator paths, non-overlapping pages, terminal state,
  local-filter reset, responsive containment, and forward-edge rebuilding after
  a confirmed in-memory Forget.

The browser tests do not forget a real device or mutate a live account. The
upstream index does not declare an explicit deterministic order; that broader
backend contract risk remains tracked separately in issue #189.

---

## Cluster network list and exact filters

**Status:** `mapped / implemented`

The administrator network list at `/admin/cluster/networks` follows the
declared `Network.Index` contract. Its only server-side selection inputs are
`location` and `purpose`; `limit` and ascending-ID `from_id` provide keyset
pagination. IP version, role, managed state, labels, and addresses remain
network object fields, but the index action does not declare them as filters.

The list therefore exposes only `location:` and `purpose:` exact filters.
Entering a numeric ID opens network detail. Plain text and the historical
`q`, `ip_version`, `role`, and `managed` forms produce an explicit validation
message without issuing another list request. Bookmarks containing those
unsupported parameters are replaced with a canonical URL and reset to page 1
before the list component mounts, so an unfiltered response is never presented
as filtered. The shared network picker similarly loads a bounded result set
using only supported exact API inputs and performs its label/address matching
locally.

Evidence:

- Backend contract: `api/lib/vpsadmin/api/resources/network.rb` in the
  read-only upstream checkout.
- Legacy list behavior: `webui/forms/cluster.forms.php` in the read-only
  upstream checkout; it requests the network list without the invented
  filters.
- WebUI Next implementation: `src/lib/api/networks.ts`,
  `src/pages/app/admin/cluster/NetworksPage.tsx`, and
  `src/components/ui/NetworkLookupInput.tsx`.
- Automated contract evidence: `src/lib/api/networks.test.ts`,
  `src/pages/app/admin/cluster/networkFilterSemantics.test.ts`,
  `src/components/ui/NetworkLookupInput.test.ts`, and
  `e2e/specs/admin/cluster_networks_filter_contract.spec.ts`.

The Playwright test uses deterministic HaveAPI mocks to prove request
serialization, URL normalization, validation, and desktop/mobile controls. It
does not claim that a deployed API contains particular network records.

---

## Cluster resource packages

**Status:** `mapped / implemented`

Resource packages group cluster-resource adjustments that administrators can
assign to users. A shared package has no owner or environment and can be
created, edited, assigned, and removed independently. A personal package is
owned by one user in one environment and cannot be deleted independently.

`ClusterResourcePackage.Index` supports keyset pagination plus exact
`environment` and nullable `user` filters. It has no full-text or
`is_personal` input. WebUI Next therefore defaults the catalogue to shared
packages with `user: null`, requires a concrete user before loading the
personal scope, and omits the user filter only for the explicit all scope.
Label search was removed because applying it to one paginated page would claim
incomplete results; an ID still opens the detail directly.

The legacy cluster page also lists shared packages with `user: null`; personal
packages are normally reached through a user's resource view. WebUI Next keeps
that reliable default while retaining exact user/environment inspection in the
advanced filters.

Implementation and evidence:

- `src/pages/app/admin/cluster/ResourcePackagesPage.tsx`
- `src/lib/api/clusterResourcePackages.ts`
- `src/lib/api/clusterResourcePackages.test.ts`
- `e2e/specs/admin/cluster_resource_packages_filter_contract.spec.ts`

The browser coverage uses a contract-sensitive mock on desktop and mobile. The
filter contract was also checked read-only against the deployed API source;
no live resource package was mutated.

---

## Admin node index filtering and health view

**Status:** `mapped / partial`

### Purpose and actors

The node list at `/admin/nodes` lets administrators and support staff inspect
the cluster inventory and current health, then open an exact node detail.
Administrators may include inactive nodes; support accounts are intentionally
active-only, matching the backend restriction rather than presenting a state
control that the API would ignore.

### Index, filter, and status contract

| Concern | Current contract |
| --- | --- |
| Authenticated inventory | `Node.Index` (`GET /v7.0/nodes`) accepts `from_id` and `limit` plus exact `location`, `environment`, `type`, and `hypervisor_type` filters. |
| State | `state` accepts `active`, `inactive`, or `all` for administrators only. `Node.Index` blacklists it for non-admins and restricts support output to active nodes, so the support UI neither displays nor sends it. |
| Text search | The action has no `q` or other full-text input. The UI does not claim name, domain, or FQDN search and never sends `node[q]`. |
| Exact navigation | A single numeric value or `id:<number>` opens `/admin/nodes/:id`; it is navigation, not an index filter. |
| Health and issues | Unpaginated `Node.PublicStatus` (`GET /v7.0/nodes/public_status`) augments the authenticated rows. `issues` is computed from public-status health after the current index page is loaded, so it is explicitly page-local and is never sent as `node[issues]`. |
| Degraded read path | If the authenticated index fails, the page can still show the unpaginated public-status list; if public status fails, it can show authenticated metadata without health. |

The smart input retains useful page-local `issues` filtering and exact numeric
navigation. Arbitrary text, including `q:` and `search:` aliases, produces
actionable unsupported-search feedback without changing the canonical URL or
issuing a replacement list request.

Direct-entry URLs are normalized before either the inventory or public-status
query mounts. A legacy `q` value is removed, the stale `from_id` is removed,
and presentational `page` is reset to 1 while valid `issues`, `limit`, and an
administrator's `state` survive. For support accounts, a stale or forged
`state` is also removed before the first request. This prevents the page from
showing an active filter whose corresponding API input was ignored.

### Evidence and remaining gap

- Backend input and authorization contract:
  `api/lib/vpsadmin/api/resources/node.rb` in the read-only upstream vpsAdmin
  checkout.
- Legacy cluster overview without a full-text-search claim:
  `webui/forms/cluster.forms.php` in the read-only upstream checkout.
- WebUI Next request and list behavior: `src/lib/api/nodes.ts`,
  `src/pages/app/admin/NodesPage.tsx`,
  `src/pages/app/admin/NodesFilters.tsx`, and
  `src/pages/app/admin/NodesModel.ts`.
- Contract tests: `src/lib/api/nodes.test.ts`,
  `src/pages/app/admin/NodesModel.test.ts`, and
  `e2e/specs/admin/nodes_filter_contract.spec.ts`.

The deterministic tests cover serialization, direct-entry URL hygiene, the
admin/support role boundary, unsupported text, page-local issues, and numeric
navigation against HaveAPI mocks. They do not establish a deployed server's
multi-page behavior. The remaining partial status is specifically the separate
`from_id` cursor-direction and deterministic-ordering contract in issue #189;
issue #227 corrects filter/search semantics but does not resolve or mask that
pagination risk.

---

## OOM report list traversal

**Status:** `mapped / partial`

OOM reports are troubleshooting records for memory-pressure kills. Members and
support users can browse reports for their own VPSes on `/app/oom-reports`;
administrators can use the same owner-oriented view or inspect the global list
on `/admin/oom-reports`. Browsing the list is read-only and does not create,
change, or remove the separate OOM notification rules.

`OomReport::Index` owner-restricts non-administrators and blacklists their
`user` filter. Administrators may filter the global list by user. The resource
also accepts exact VPS, node, location, environment, rule, and cgroup filters,
plus inclusive since/until time bounds. It applies HaveAPI descending ID
pagination and then orders the result by `oom_reports.created_at DESC`.

WebUI Next offers visible limits of 25, 50, or 100 reports. It requests one
additional row, renders only the selected limit, derives `from_id` from the
last visible report, and enables **Next** only when the hidden look-ahead row
exists or the local cursor stack already contains a visited forward page. The
largest request is therefore 101 rows, below HaveAPI's maximum of 1,000. This
removes the empty next page at an exact terminal boundary and preserves forward
navigation after returning to an earlier page.

The legacy report form requests exactly its visible limit. Its shared paginator
also assumes another page whenever the response count equals that limit, so it
has the same exact-terminal false positive. Following that false signal to an
empty WebUI Next result also removed its paginator, leaving browser Back as the
only recovery. Legacy does preserve known forward history; the inverted
`!pagination.hasForward` gate was specific to the former WebUI Next
implementation and disabled **Next** despite an already visited forward page.

Backend evidence comes from the read-only upstream
`api/lib/vpsadmin/api/resources/oom_report.rb`,
`api/lib/vpsadmin/supervisor/node/oom_reports.rb`, and the pinned HaveAPI
pagination implementation. Legacy evidence comes from
`webui/forms/oom_reports.forms.php` and `webui/lib/pagination.lib.php`. Current
implementation and deterministic desktop/mobile coverage are in
`src/pages/app/oom/OomReportsPage.tsx` and
`e2e/specs/app/oom_reports_smart_filter.spec.ts`.

The browser test proves the 26-row request and hidden sentinel, a two-page
50-report boundary, visible-row cursor continuity, the exact terminal state,
and Prev → reload → Next behavior using strict HaveAPI mocks. It does not claim
a live OOM report or rule mutation.

Complete traversal remains an upstream limitation: `from_id` filters by ID,
while the primary order is `created_at`, and node ingestion sets that timestamp
from the reported event time. IDs that are non-monotonic with event time, or
reports sharing the same timestamp, can still be skipped or repeated. Issue
#189 tracks the required deterministic aligned order/cursor contract; this
frontend change claims only the narrower UI guarantees above.

---

## User namespace and UID/GID map browsing

**Status:** `mapped / implemented`

User namespaces define the UID/GID range available to an account. Namespace
maps label reusable per-VPS UID/GID translations within one namespace. WebUI
Next exposes the owner workflow under
`/app/profile/user-namespaces/{namespaces,maps}` (and the equivalent
administrator self-profile routes), the global administrator workflow under
`/admin/user-namespaces/{namespaces,maps}`, and the applicable map selector in
VPS configuration.

### Exact index and role contract

| Resource | Supported exact filters | Role-aware owner behavior |
| --- | --- | --- |
| `GET /v7.0/user_namespaces` | `size`, `block_count`, `user`, plus `limit`/`from_id` | The backend forces an ordinary user to their own `user_id` and permits only `size` plus pagination. The UI therefore omits `user` and `block_count`. An administrator is not owner-restricted, so self and foreign fixed-owner views send that exact `user`; the global admin list may send exact `user` and `block_count`. |
| `GET /v7.0/user_namespace_maps` | `user_namespace`, `user`, plus `limit`/`from_id` | The backend owner-restricts a non-admin through the namespace and permits `user_namespace` plus pagination. The UI therefore omits `user`. Administrator self, foreign-VPS, and filtered global views send the exact owner. |

Neither index declares `q` or label search. A numeric smart-input value opens
the exact namespace/map detail and supported `key:value` tokens apply only the
filters above. Old links containing `q`, a URL owner on a fixed/non-admin view,
or a non-admin `block_count` are canonicalized before the list component is
mounted. The guard resets stale cursor/page state while preserving real
`size`, `block_count`, or `user_namespace` filters applicable to that view, so
there is no broad pre-normalization request that merely looks filtered.

Both indexes use the backend's default ascending, exclusive
`id > from_id` contract. The list requests one look-ahead row, renders only the
selected limit, and derives the next cursor from the greatest visible ID. A
hidden sentinel is never rendered; exact-size and below-limit terminal pages
disable **Next** unless the local stack already contains a forward-visited
cursor, and a non-advancing response fails closed to avoid loops.
Namespace-map lists explicitly request the `user_namespace` expansion so the
displayed namespace size and owner come from the resolved resource; the VPS
configuration selector remains a lightweight reference-only consumer.

The profile landing count, profile lists and map-creation namespace selector
all use the same role rule. VPS configuration relies on backend owner scope for
ordinary owners and sends the VPS owner explicitly for an administrator,
including a foreign-owner VPS. Create, rename, delete, and map-entry mutation
payloads and gates are unchanged by this index-contract correction.

Evidence:

- Backend resources in the read-only upstream checkout:
  `api/lib/vpsadmin/api/resources/user_namespace.rb` and
  `api/lib/vpsadmin/api/resources/user_namespace_map.rb`.
- Legacy filter/owner behavior:
  `webui/forms/userns.forms.php`, `webui/forms/vps.forms.php`, and
  `webui/pages/page_adminvps.php` in the read-only upstream checkout.
- WebUI Next API and role/URL semantics:
  `src/lib/api/userNamespaces.ts` and
  `src/components/userNamespaces/userNamespaceFilterSemantics.ts`.
- Current list and VPS consumers:
  `src/components/userNamespaces/UserNamespaceList.tsx`,
  `src/components/userNamespaces/UserNamespaceMapList.tsx`, profile namespace
  pages, and `src/pages/app/vps/VpsConfigurationPage.tsx`.
- Strict wrapper and semantics tests:
  `src/lib/api/userNamespaces.test.ts` and
  `src/components/userNamespaces/userNamespaceFilterSemantics.test.ts`.
- Mocked desktop/mobile contract coverage:
  `e2e/specs/app/user_namespace_filter_contract.spec.ts`, plus the existing
  mutation workflow in `e2e/specs/app/profile_user_namespaces.spec.ts`.

The browser tests use deterministic HaveAPI mocks. They prove the exact first
request, URL hygiene, role distinctions, profile/admin/VPS consumers,
ascending two-page navigation, browser Back/Forward restoration, hidden
look-ahead rows, exact and below-limit terminal states, expansion parameters,
programmatic drawer labels, mobile overflow safety, and that existing map
mutations still use their prior contract. Read-only contract tests reject any
unexpected write; they do not claim a live authorization audit or perform live
mutations.

---

## Remaining product inventory

The areas below are confirmed by current routes/source. Their status is
deliberately `inventory only`: this table does not claim legacy parity, API
completeness, or production readiness. Promote an area to a detailed capability
section only after inspecting the legacy purpose, backend actions/permissions,
current UX, and end-to-end evidence.

### Public surfaces

| Area | Confirmed WebUI Next surface | Status |
| --- | --- | --- |
| Service overview/status | `/` | `inventory only` |
| Outages | `/outages`, `/outages/:outageId` | `inventory only` |
| News | `/news` | `inventory only` |
| Security advisories | `/security-advisories`, `/security-advisories/:advisoryId` | `inventory only` |
| OAuth authorization and callback recovery | `/oauth/login`, `/oauth/callback`, `/oauth/error` | `mapped / implemented` |
| OAuth logout and broader session recovery | `/oauth/logout`, SPA session-expiry handling | `inventory only` |

### Authenticated user surfaces

| Area | Confirmed capability surface | Status |
| --- | --- | --- |
| Dashboard | user overview and summary cards | `inventory only` |
| VPS | list/create; overview, configuration, access, network, storage, features, maintenance, history, lifecycle, console | `inventory only` |
| Datasets and NAS | lists; dataset overview, snapshots, downloads, exports, expansion; NAS creation | `inventory only` |
| Dataset backup-plan automation | backup-center workspace and dataset/NAS plan details; see the mapped capability above | `mapped / implemented` |
| Backup Center | cross-dataset overview, snapshots, generated downloads, and restore guidance; plan assignment is mapped separately above | `inventory only` |
| Exports | list and detail | `inventory only` |
| DNS | zones; records, transfers, DNSSEC, servers, settings, logs; user TSIG keys (pagination mapped below) | `mapped / partial` |
| Networking | user addresses/traffic/live networking surface | `inventory only` |
| Operations | transaction-chain audit pagination is mapped above; transaction-item diagnostics, action states, monitoring events, and broader task behavior are tracked as separate slices | `mapped / partial` |
| Support events | incidents including report creation; OOM reports, details, and rules; OOM list traversal is mapped above | `inventory only` |
| Payments | user payment/billing surface; history traversal is mapped above | `inventory only` |
| Account | profile, resources, security, MFA, mail, keys, sessions, metrics tokens, user data | `inventory only` |
| User namespaces | owner namespace/map browsing and VPS map selection; see the mapped capability above | `mapped / implemented` |

### Administrator surfaces

| Area | Confirmed capability surface | Status |
| --- | --- | --- |
| Admin dashboard | global operational overview | `inventory only` |
| VPS, datasets, NAS, exports, DNS | admin-scoped versions of the core service surfaces | `inventory only` |
| Networking | IP addresses/detail, host IPs, assignments, live view, traffic by user | `inventory only` |
| Users | list/detail; resources/usage with distinct loading, empty, and retryable error states; payments, environment config, security, MFA, sessions, keys, metrics, mail, user data, history | `inventory only` |
| User namespaces | namespace and map lists/details; see the mapped capability above | `mapped / implemented` |
| Finance | global overview, income forecast, incoming-payment list/detail/assignment and reconciliation | `inventory only` |
| Audit | history list and event detail | `inventory only` |
| Incidents, outages, monitoring, OOM | admin operational/support surfaces | `inventory only` |
| Security advisories | admin lifecycle and affected-object workflow | `inventory only` |
| Mailer | templates/translations, mailboxes, recipients, logs | `inventory only` |
| Content | news and contextual help-box administration | `inventory only` |
| Cluster | summary, environments, locations, OS templates, networks, resource packages, system config, DNS resolvers/servers/TSIG keys; the resolver catalogue/CRUD follows the real pagination-only API and legacy unfiltered list | `inventory only` |
| Cluster resource packages | shared/personal catalogue, exact scope filters, detail items and assignments | `mapped / implemented` |
| Nodes | list/detail, lifecycle and pool maintenance controls; index filtering and health are mapped above | `mapped / partial` — multi-page ordering remains issue #189 |
| Migration plans | plan list/detail and migration scheduling/control | `inventory only` |
| Admin diagnostics | `/admin/admin-info` | `inventory only` |

### Cross-cutting capabilities still to map

| Capability | Confirmed implementation evidence | Status |
| --- | --- | --- |
| Role/mode routing | user and admin shells, route guards, mode switcher | `inventory only` |
| Authentication/session recovery | OAuth BFF, session expiry handling, login/logout routes | `inventory only` |
| Authorization/action gating | role checks, API preflight helpers, lock/action-state gating | `inventory only` |
| Asynchronous work | action states, transaction chains/items, task drawer and notifications | `inventory only` |
| Search/filter/pagination | smart filters, server/client filtering, keyset components across lists | `inventory only` |
| Error/loading/empty states | shared state components and route-level error boundaries | `inventory only` |
| Responsive/accessibility behavior | desktop/mobile list variants, drawers, focus-trap tests, localized labels | `inventory only` |
| Localization/preferences | Czech/English resources, UI preferences, theme and time-zone handling | `inventory only` |
| Deployment/live parity | build metadata, dev deployment scripts, live route sweep and optional parity suite | `inventory only` |

---

## User DNS TSIG key pagination

### Capability: browse an owner-scoped TSIG key list without repeating pages

The authenticated user route `/app/dns/tsig-keys` lists the current user's
TSIG keys, optionally filtered by algorithm. Every index request includes the
authenticated user ID, and the client rejects the complete raw response if any
row belongs to another user. This keeps the page fail-closed if the backend's
owner scoping ever regresses.

The backend `DnsTsigKey.Index` action uses HaveAPI keyset pagination with the
ascending, exclusive cursor predicate `id > from_id`. The page therefore
requests one more row than the selected visible limit, renders only the visible
rows, and uses the greatest visible ID as the next cursor. The hidden look-ahead
row is the sole evidence that another page exists. Previously, this user route
used a descending-page cursor and treated an exactly full response as proof of
another page; that could repeat already visible rows and expose an empty
terminal page.

Current sources:

- `src/pages/app/dns/DnsTsigKeysPage.tsx`;
- `src/pages/app/dns/dnsTsigKeyPagination.ts`;
- `src/lib/api/dns.ts`;
- upstream `api/lib/vpsadmin/api/resources/dns_tsig_key.rb` (read-only contract
  reference).

### Test evidence and limits

- `src/pages/app/dns/dnsTsigKeyPagination.test.ts` verifies the ascending
  cursor, hidden look-ahead row, exact terminal page, and empty-page behavior.
- `e2e/specs/app/dns_tsig_keys.spec.ts` covers the two-page browser workflow on
  desktop and mobile: owner filter, `limit + 1`, cursor URL, non-overlapping
  rows, terminal **Next**, and backward navigation.
- Existing end-to-end coverage verifies owner scoping, one-time secret display,
  creation, and fail-closed handling of a foreign-owner response.

The deterministic tests prove the client/API contract without creating or
deleting a real TSIG key. The upstream action does not currently declare an
explicit order; issue #189 remains the broader hardening task for stable
ordering across DNS indexes.

# Architecture and runtime boundaries

Source reviewed at `156a7c04` (2026-09-29); [requirements](REQUIREMENTS.md) REQ-001, 005–013, 056–063.
This describes observed implementation, not a proposed backend rewrite.

```mermaid
flowchart LR
  Browser[Browser: React SPA] -->|same-origin config/session/OAuth| Nginx
  Nginx --> Static[Immutable frontend dist]
  Nginx --> BFF[Node OAuth BFF]
  BFF -->|code exchange / refresh| OAuth[API OAuth provider]
  Browser -->|HaveAPI auth header / JSON| API[HaveAPI resources]
  API --> Tasks[Action states / transaction chains / node services]
  Browser -->|console URL / token| Console[Console service]
  Browser -->|explicit heatmap / address map| External[Configured external visualization services]
```

## Frontend composition

- [bootstrap](../../src/bootstrap.ts) loads runtime configuration before the app.
  The early `index.html` script applies locally known theme/language preferences.
- [route providers](../../src/routes/RouteProvidersLayout.tsx) compose auth,
  settings, theme, i18n, document title/focus and toasts around routed content.
- [router](../../src/routes/router.tsx) declares public/member/admin routes;
  imported finance/advisory route groups add gates. Lazy routes split modules;
  keyed object routes prevent state leaking between different IDs.
- [AppLayout](../../src/components/layout/AppLayout.tsx) owns authenticated shell,
  scope navigation, task surfaces and synchronization feedback. Feature pages live
  in `src/pages`; shared UI and operation primitives live in `src/components`.
- [HaveAPI client](../../src/lib/api/haveapi.ts) and typed domain adapters under
  `src/lib/api` translate requests/envelopes. React Query drives remote data and
  invalidation. Page-local models hold draft/review state; pure helpers are unit
  tested. The [inventory](IMPLEMENTATION_INVENTORY.md) lists adapters and routes.

## Authentication and session lifecycle

The BFF exists because an OAuth client secret cannot safely live in a static SPA.
It exchanges codes and stores OAuth state/tokens on the server. `/config.js` is
public runtime configuration, not a token transport. `/session.json` is a
same-origin JSON endpoint supplying the access token plus stable session identity
and expiry to an authenticated browser. The SPA calls HaveAPI directly; the BFF
is not a general API proxy. Never describe access tokens as completely absent
from the browser: refresh/client-secret handling is server-side, but the browser
requires the access token for API calls.

Current session fields are `accessToken`, `sessionKey`, `sessionExpiresAt`;
anonymous responses use null values. Stable session identity separates a logical
session from access-token rotations. Read [BFF docs](../../bff/README.md),
[auth provider](../../src/app/auth.tsx), [session helper](../../src/lib/auth/bffSession.ts),
and [idle session model](../../src/lib/auth/idleSession.ts).

The BFF serializes refresh/logout operations per verified cookie in one process.
The queue does not make a multi-worker shared file store safe; supported deployment
runs one process per file store. Browser expiry/activity logic must not interpret
background resource polling as human activity. Logout/expiry must not be undone
by a later stale response. Auth storage and UI preference persistence are separate.

## Permissions and object scope

The API exposes numeric user levels. [roles.ts](../../src/lib/roles.ts) maps user
(>=1), support (>=21) and admin (>=90), with unknown otherwise. User/admin are the
product views; support can enter selected admin surfaces but must not inherit
admin-only finance or security operations. UI navigation is not authorization.
Route/page/action gates and server permission checks each remain necessary.

An administrator's My view must preserve ownership scope. Never widen a query
because a link is hidden or because a cached object is already present. Changing
user/session/scope must not reuse private cached results or mutation locks across
identities. Direct deep links and role-denied responses need regression coverage.

## Writes and concurrency

[Local mutation locks](../../src/components/layout/useLocalMutationLocks.ts) and
[lock storage](../../src/components/layout/localMutationLockStorage.ts) preserve
pending/uncertain operation intent across rerenders/tabs/reloads where supported.
Domain guards and snapshots bind actions to reviewed targets/values. Server action
states and transaction chains remain the authority for asynchronous outcomes.

A successful HTTP status alone does not prove an operation receipt or completion.
API failures are distinguished from network ambiguity. Reconciliation happens
before resubmission. Query invalidation/refetch updates affected views after known
results; it must not discard an unrelated draft or reset an uncertain lock.

## Configuration, integrations and trust

Runtime configuration chooses API URL/version/auth header, router basename and UI
settings persistence. It is public: never put OAuth secrets there. The browser's
HaveAPI header must match API CORS/auth configuration. The configured default is
`X-HaveAPI-OAuth2-Token` for the OAuth deployment.

Console and heatmap URLs require the implementation's secure URL checks. Address
maps and heatmaps are external services and can fail independently of the core
form; useful text/error fallback must remain. HTML mail/content previews and DNS
secret-bearing responses require their existing containment/scrubbing controls.
Do not “fix” these by broadening CSP or logging response bodies.

## Build, deployment and boundaries

Vite builds the SPA. A small Node service provides OAuth BFF endpoints, behind
nginx with SPA history fallback. `/session.json` and OAuth endpoints must never
fall through to `index.html`. `build-info.json` identifies the frontend build;
BFF process/release provenance must be checked separately, not inferred from it.

The product is Kerrycek/clankerdev. `vpsfreecz/vpsadmin` is the API/legacy reference;
KB contracts have a separate repository and independent UI/API revisions. Frontend
release approval is not backend migration, shared API configuration or KB
publication approval. See [operations](OPERATIONS.md).

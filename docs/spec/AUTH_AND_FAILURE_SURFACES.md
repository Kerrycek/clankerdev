# Auth and failure surfaces

This document specifies **how the UI behaves when something goes wrong**:
- unauthenticated access
- forbidden access
- not-found routes
- OAuth redirect/callback failures
- unexpected runtime errors

It is a cross-cutting consistency spec: every module must follow these rules.

---

## Goals

1) **No silent redirects that hide errors**
- 404 should render a 404 page.
- 403 should render a 403 page.
- Auth required should render an auth-required page.

2) **Actionable recovery**
Every failure surface must provide at least two safe actions:
- a path back to the public status pages
- a path back to the app (or a sign-in action if anonymous)

3) **Safe to share**
All error screens must be safe to screenshot / copy-paste to maintainers:
- never display tokens
- never display full OAuth `code`/`state` values
- prefer generic, non-sensitive diagnostics

4) **Consistent across desktop + mobile**
Failure surfaces must be readable and usable in a narrow viewport.

---

## Auth status model

The app uses an explicit auth status model:

- `loading`: checking current session (`/users/current`)
- `anonymous`: no valid session (HTTP 401)
- `forbidden`: authenticated transport present, but server refuses the account (HTTP 403)
- `error`: could not verify session due to network/server issues
- `authenticated`: session verified and user data loaded

### HaveAPI `token` renewal

For legacy HaveAPI `token` authentication, sessions are **time-limited**.
WebUI Next keeps the session alive for as long as the UI is open (matching the
legacy webui behavior) so users do not get "randomly logged out" while the tab sits idle.

Implementation details live in `docs/haveapi/TOKEN_RENEWAL.md`.

### Mapping rules

When calling `/users/current`:

- HTTP 200 + `status: true` → `authenticated`
- HTTP 401 → `anonymous`
- HTTP 403 → `forbidden`
- everything else (network errors, 5xx, invalid JSON) → `error`

Rationale:
- treating 401 as `anonymous` avoids showing a scary error when a token expires
- treating 403 as `forbidden` avoids telling a user to “sign in again” when the account is not allowed

---

## AuthGate screens

### 1) Loading

UI:
- spinner + “Loading…”

Test id:
- `auth.loading`

### 2) Anonymous

UI:
- title: “Sign in required”
- explanation text
- optional error detail text (if present)

Actions:
- primary: `Sign in`
- secondary: `Go to status`

Test id:
- `auth.login-required`

### 3) Forbidden

UI:
- title: “Access denied”
- explanation: account is not allowed to access API

Actions:
- `Sign out` (local OAuth logout)
- `Go to status`

Test id:
- `auth.forbidden`

### 4) Auth check failed

UI:
- title: “Can’t load your session”
- explanation: network/back-end failure
- render the canonical error message

Actions:
- `Reload`
- `Try signing in`
- `Go to status`

Test id:
- `auth.session-error`

### 5) Admin access required

UI:
- title: “Admin access required”
- message: user is signed in, but is not an admin

Actions:
- primary: `Go to My view` (`/app`)
- secondary: `Go to status`

Test id:
- `auth.admin-required`

---

## OAuth flow screens

OAuth routes are first-class UX surfaces. They must render useful feedback and safe failure states.

### `/oauth/login`

Default:
- spinner: “Redirecting to sign-in…”

Failure:
- title: “Sign-in redirect failed”
- show safe error message

Actions:
- `Retry` (reload)
- `Go to status`

Test id:
- `oauth.login.page`

### `/oauth/callback`

Default:
- spinner: “Finishing sign-in…”

Failure:
- title: “Sign-in failed”
- show safe error message

Actions:
- `Sign in again`
- `Go to status`

Security:
- remove query params from browser history (`replace`) to avoid leaking OAuth params

Test id:
- `oauth.callback.page`

### `/oauth/logout`

Default:
- spinner: “Signing out…”

Failure:
- title: “Sign out failed”
- show safe error message

Actions:
- `Retry` (reload)
- `Go to status`

Test id:
- `oauth.logout.page`

---

## Not found

We do not redirect unknown routes.

Route behavior:
- Public layout has a wildcard child route: renders a NotFound page.
- App layout (`/app`) has a wildcard child route: renders a NotFound page.
- Admin layout (`/admin`) has a wildcard child route: renders a NotFound page.

UI:
- title: “Page not found”
- show requested path (safe)

Actions:
- `Go to status`
- `Open app` or `Go to app` depending on context

Test id:
- `notfound.page`

---

## Forbidden

Forbidden surfaces are rendered when the router error boundary receives a 403 or a module decides to surface a 403.

UI:
- title: “Access denied”
- message
- show requested path (safe)

Actions:
- `Go to status`
- `Open app` or `Go to app`

Test id:
- `forbidden.page`

---

## Unexpected errors

The router error boundary (`ErrorPage`) must:

- detect route errors:
  - 404 → render NotFound UI
  - 403 → render Forbidden UI
- for all other errors:
  - show a human-friendly message
  - allow copying safe details
  - provide recovery actions

Actions:
- `Reload`
- `Go to status`

Test id:
- `error.page`

---

## Related specs

- `docs/spec/TEST_IDS.md`
- `docs/spec/E2E_TEST_PLAN.md`
- [Authentication workflow](../design/WORKFLOWS.md#public-entry-and-authentication) and [shell design](../design/PRODUCT_DESIGN.md#audiences-and-information-architecture)

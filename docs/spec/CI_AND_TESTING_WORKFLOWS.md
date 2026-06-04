# CI and Testing Workflows

This document defines how we run automated checks and tests.

The goal is to keep the project **boringly consistent** and to prevent regressions in:
- UI behavior contracts (locks, gating, pagination, test IDs)
- i18n key parity (EN/CS)
- token discipline (no raw Tailwind values)
- build/typecheck health

## Continuous integration

### CI workflow

A GitHub Actions workflow is provided:
- `.github/workflows/ci.yml`

It runs on every push and pull request and executes:
1. `npm ci`
2. `npm run ci:pr`

`npm run ci:pr` is the stable pull-request gate. It currently runs:
- `npm run lint` (Tailwind token lint + banned-pattern lint)
- `npm run audit:i18n`
- `npm run typecheck`
- `npm test` (Vitest)

`npm run ci:check` is the stricter full local audit target. It also runs:
- `npm run audit:i18n-structure`
- `npm run audit:pages`
- `npm run audit:structural`
- `npm run audit:component-contracts`
- `npm run audit:active-docs`
- `npm run audit:overlays`
- `npm run audit:lookup-primitives`
- `npm run audit:api-barrel-imports`
- `npm run audit:ui-strings:check`
- `npm run audit:mutations:check`

Some full-audit checks are currently cleanup targets and should not block every PR until they are green on `main`.

In addition, a separate workflow runs a **Playwright PR smoke subset** on every pull request (see below).

CI also uploads `work/audits/` as an artifact (useful when reviewing failures).

## End-to-end tests (Playwright)

### Current state

This repo includes a large Playwright scaffold:
- `playwright.config.ts`
- `e2e/fixtures/*` (HaveAPI mock router + app bootstrap helpers)
- `e2e/specs/*`
- `@playwright/test` pinned in `package-lock.json`

The default PR suite uses deterministic HaveAPI fixtures and mocked authenticated sessions. It does not store or use
real passwords.

### Pull request smoke workflow

On every pull request, GitHub Actions runs a small Tier 0 PR smoke subset:
- `.github/workflows/e2e-smoke.yml`

It runs:
- `npm run e2e:pr` (`@pr-smoke` on chromium, then `@pr-smoke-mobile` on mobile-chrome)

This PR gate covers mocked critical paths: public overview, authenticated dashboard/VPS entry, tasks drawer behavior,
transaction/action-state detail payloads, VPS lifecycle payloads, and admin VPS create scope handling. Promote tests into
`@pr-smoke` only when they are deterministic enough to block pull requests.

On failure, the workflow uploads Playwright artifacts:
- `playwright-report` (HTML)
- `e2e/test-results` (screenshots/videos/traces)

The workflow uses per-ref concurrency with `cancel-in-progress: true`, so only the newest run for a branch continues.

### Broad smoke workflow

The broader app/admin smoke workflow is:
- `.github/workflows/e2e-broad-smoke.yml`

It runs on pushes to `main` and manually:
- `npm run e2e:smoke` (`@smoke` on chromium)
- `npm run e2e:smoke:mobile` (`@smoke-mobile` on mobile-chrome)

Use `npm run e2e:broad` locally to run both projects. This layer includes mocked dashboard/auth, user/admin scope
switching, VPS list and detail tasks behavior, transaction/action-state expand/collapse payloads, storage snapshots,
backup/download flows, mount flows, admin surfaces, and session-expiry handling.

### Nightly/full workflow

The longer parity workflow is:
- `.github/workflows/e2e-nightly.yml`

It runs on the Prague morning schedule and manually:
- `npm run e2e:full` on chromium
- `npm run e2e:smoke:mobile` on mobile-chrome

Use `npm run e2e:nightly` locally to mirror the scheduled command set. Keep long user/admin parity coverage here unless a
workflow is short and stable enough for broad smoke or PR smoke.

### Local runs

```bash
cd clankerdev

# One-time (installs browsers)
npm run e2e:install

# Run full e2e with Playwright starting the Vite dev server
npm run e2e

# PR, broad smoke, and nightly/full E2E layers
npm run e2e:pr
npm run e2e:broad
npm run e2e:nightly

# Release candidate gate (CI scripts + smoke e2e)
# (Run `npm run e2e:install` once first.)
# Create an RC notes file (recommended)
npm run rc:notes
npm run rc:check

# Optional: enable screenshot matrix specs
E2E_START_SERVER=1 E2E_SCREENSHOTS=1 node scripts/playwright.mjs test
```

#### Notes
- `E2E_BASE_URL` defaults to `http://127.0.0.1:5173`.
- If you start the server yourself, omit `E2E_START_SERVER` and set `E2E_BASE_URL`.
- Real OAuth login is intentionally not part of the default PR suite. If needed, add a separate staging-only workflow
  using credentials from CI secrets.
- To inspect a trace from CI, download `playwright-test-results`, then run
  `npx playwright show-trace path/to/trace.zip`.

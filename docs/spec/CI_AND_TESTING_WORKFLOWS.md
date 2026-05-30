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
2. `npm run ci:check`

`npm run ci:check` currently runs:
- `npm run lint` (Tailwind token lint + banned-pattern lint)
- `npm run audit:i18n`
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
- `npm run typecheck`
- `npm test` (Vitest)

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
- `npm run e2e:pr:desktop` (`@pr-smoke` on chromium)
- `npm run e2e:pr:mobile` (`@pr-smoke-mobile` on mobile-chrome)

The broader `@smoke` / `@smoke-mobile` suite is intentionally separate while old parity specs are being hardened.
Promote tests into `@pr-smoke` only when they are deterministic enough to block pull requests.

On failure, the workflow uploads Playwright artifacts:
- `playwright-report` (HTML)
- `e2e/test-results` (traces/videos)

### Local runs

```bash
cd clankerdev

# One-time (installs browsers)
npm run e2e:install

# Run full e2e with Playwright starting the Vite dev server
npm run e2e

# Tier 0 smoke subset
npm run e2e:pr
npm run e2e:smoke
npm run e2e:smoke:mobile

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

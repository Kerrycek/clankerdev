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
- `npm run audit:ui-strings:check`
- `npm run audit:mutations:check`
- `npm run typecheck`
- `npm test` (Vitest)

In addition, a separate workflow runs a **Playwright smoke subset** on every pull request (see below).

CI also uploads `webui-next/work/audits/` as an artifact (useful when reviewing failures).

## End-to-end tests (Playwright)

### Current state

This repo includes a large Playwright scaffold:
- `playwright.config.ts`
- `e2e/fixtures/*` (HaveAPI mock router + app bootstrap helpers)
- `e2e/specs/*`

However, `@playwright/test` is intentionally **not** pinned in `package-lock.json` yet.
This avoids adding a heavy dependency until we decide on the final CI/runtime integration.

### Pull request smoke workflow

On every pull request, GitHub Actions runs a Tier 0 smoke subset:
- `.github/workflows/e2e-smoke.yml`

It runs Playwright via a pinned `npx` version and uses tags:
- `@smoke` (chromium)
- `@smoke-mobile` (mobile-chrome)

Selection is done via `--grep "(^|\\s)@smoke(\\s|$)"` and `--grep "(^|\\s)@smoke-mobile(\\s|$)"` so the tags do not overlap.

On failure, the workflow uploads Playwright artifacts:
- `playwright-report` (HTML)
- `e2e/test-results` (traces/videos)

### Manual CI workflow

A GitHub Actions workflow is provided for on-demand e2e runs:
- `.github/workflows/e2e.yml`

It is triggered manually via `workflow_dispatch` and runs Playwright via a pinned `npx`:
- installs browsers with `npx -y @playwright/test@<version> install --with-deps`
- runs tests with `npx -y @playwright/test@<version> test`

The default pinned Playwright version is configured as workflow input.


The manual workflow always uploads Playwright artifacts:
- `playwright-report`
- `e2e/test-results`

### Local runs (without adding Playwright to package-lock)

You can run e2e locally without adding `@playwright/test` to the repo yet.
We keep a pinned Playwright version in:
- `e2e/PLAYWRIGHT_VERSION`

```bash
cd webui-next

# One-time (installs browsers)
npm run e2e:install

# Run full e2e with Playwright starting the Vite dev server
npm run e2e

# Tier 0 smoke subset
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

### Roadmap: fully pin Playwright

Once we are ready, we should:
- add `@playwright/test` to `devDependencies`
- update `package-lock.json`

At that point we can also switch the smoke workflow from `npx` to `npm run e2e:smoke`.

Until then, the authoritative CI execution paths are:
- PRs: `e2e-smoke.yml` (Tier 0 smoke)
- ad-hoc: `e2e.yml` (full suite)

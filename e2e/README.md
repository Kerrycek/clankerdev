# E2E tests (Playwright)

This directory contains **end-to-end test fixtures and specs**.

We intentionally keep e2e out of the TypeScript build (`tsconfig.include` does not include this folder)
so we can evolve the suite incrementally without blocking feature development.

Authoritative plan:
- `docs/spec/E2E_TEST_PLAN.md`

Execution workflows:
- `docs/spec/CI_AND_TESTING_WORKFLOWS.md`

Key rules
- Prefer user-facing role/text locators for workflow assertions.
- Use `data-testid` selectors for stable app shell, route identity, and dense data grids (see `docs/spec/TEST_IDS.md`).
- Prefer deterministic fixtures + Playwright network interception.
- Do not store passwords or real tokens in the repo. Use mocked sessions by default; use env variables only for explicit staging runs.
- Use the Design Sandbox for screenshot regression (`docs/spec/DESIGN_SANDBOX.md`).

## Test layers

Playwright is split into three practical layers:

- PR smoke: `npm run e2e:pr`
  Runs the short, deterministic `@pr-smoke` desktop subset plus `@pr-smoke-mobile` on mobile Chrome. This is the pull
  request gate and should stay focused on critical paths that are stable enough to block review.
- Broad smoke: `npm run e2e:broad`
  Runs mocked `@smoke` app/admin coverage on desktop plus `@smoke-mobile` mobile coverage. This is the wider main/manual
  signal for app surfaces, admin surfaces, storage, tasks, transaction details, and session handling.
- Nightly/full: `npm run e2e:nightly`
  Runs the full mocked desktop suite plus the mobile broad smoke subset. This is the overnight/manual parity signal for
  longer user and admin workflows.

Use `npm run e2e:full` when you only want the full desktop parity suite.

## Running locally

```bash
cd clankerdev

# One-time (downloads browsers)
npm run e2e:install

# Run e2e with Playwright starting Vite (see playwright.config.ts)
npm run e2e

# PR smoke, broad smoke, and nightly/full layers
npm run e2e:pr
npm run e2e:broad
npm run e2e:nightly

# Optional: enable screenshot matrix
E2E_START_SERVER=1 E2E_SCREENSHOTS=1 node scripts/playwright.mjs test
```

## CI behavior and artifacts

- `.github/workflows/e2e-smoke.yml` runs `npm run e2e:pr` for pull requests and pushes to `main`.
- `.github/workflows/e2e-broad-smoke.yml` runs broad smoke on pushes to `main` and manually.
- `.github/workflows/e2e-nightly.yml` runs full/nightly parity on the Prague morning schedule and manually.
- Workflow concurrency cancels older runs for the same ref, which keeps intermediate commits from producing redundant
  notifications.
- Playwright keeps screenshots, videos, and traces on failure (`playwright.config.ts`). CI uploads `playwright-report`
  and `e2e/test-results` only for failed jobs.
- Download the artifacts from the failed GitHub Actions job. Open `playwright-report/index.html` for the report, or open a
  trace zip with `npx playwright show-trace path/to/trace.zip`.

## Adding workflow coverage

Prefer mocked HaveAPI tests for default CI coverage:

1. Add or extend a spec under `e2e/specs/app`, `e2e/specs/admin`, or `e2e/specs/public`.
2. Bootstrap auth with `bootstrapVpsAdminWindow()` and install deterministic API responses with `installHaveApiMock()`.
3. Name the test with the role, workflow, and expected behavior, for example
   `admin VPS list: action button opens confirm without row navigation`.
4. Use role/text locators for user-visible behavior and `data-testid` locators for dense grids, app shell controls, and
   route identity.
5. Tag only stable critical paths with `@pr-smoke`. Tag broader deterministic app/admin workflows with `@smoke`, and add
   `@smoke-mobile` only when the behavior is mobile-specific or important on mobile.
6. Avoid fixed sleeps. Wait for visible UI, URLs, network requests, or `expect.poll()` when state changes asynchronously.

Real-environment smoke is intentionally separate from default CI. If needed, add a staging-only workflow that uses CI
secrets and document the environment, credentials source, and expected blast radius in that workflow or `deploy/`.

## Live/manual dev checks

Use `npm run e2e:live:manual` only for explicit human-run checks against
`dev.crucio.cz`. The live parity spec is skipped unless `E2E_LIVE_PARITY=1` is
set and object IDs are provided through environment variables. It opens real
VPS and dataset workflows and checks confirmation gates without submitting
destructive actions. See `deploy/dev.crucio.cz/live-parity-workflows.md`.

## Auth model

Most tests use `bootstrapVpsAdminWindow()` plus `installHaveApiMock()` to emulate an authenticated HaveAPI session.
This avoids committing credentials and keeps PR tests deterministic.

Real OAuth login against `dev.crucio.cz` is intentionally not part of the default suite. If we add it later, it should
run as an explicit staging-only job with credentials supplied by CI secrets.

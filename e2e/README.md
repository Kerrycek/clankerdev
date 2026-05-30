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

## Running locally

```bash
cd clankerdev

# One-time (downloads browsers)
npm run e2e:install

# Run e2e with Playwright starting Vite (see playwright.config.ts)
npm run e2e

# Smoke subset (Tier 0)
npm run e2e:pr
npm run e2e:smoke
npm run e2e:smoke:mobile

# Optional: enable screenshot matrix
E2E_START_SERVER=1 E2E_SCREENSHOTS=1 node scripts/playwright.mjs test
```

## Auth model

Most tests use `bootstrapVpsAdminWindow()` plus `installHaveApiMock()` to emulate an authenticated HaveAPI session.
This avoids committing credentials and keeps PR tests deterministic.

Real OAuth login against `dev.crucio.cz` is intentionally not part of the default suite. If we add it later, it should
run as an explicit staging-only job with credentials supplied by CI secrets.

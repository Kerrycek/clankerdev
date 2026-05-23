# E2E tests (Playwright)

This directory contains **end-to-end test fixtures and specs**.

We intentionally keep e2e out of the TypeScript build (`tsconfig.include` does not include this folder)
so we can evolve the suite incrementally without blocking feature development.

Authoritative plan:
- `docs/spec/E2E_TEST_PLAN.md`

Execution workflows:
- `docs/spec/CI_AND_TESTING_WORKFLOWS.md`

Key rules
- Tests must use `data-testid` selectors (see `docs/spec/TEST_IDS.md`).
- Prefer deterministic fixtures + Playwright network interception.
- Use the Design Sandbox for screenshot regression (`docs/spec/DESIGN_SANDBOX.md`).

## Running locally (without pinning Playwright in package-lock yet)

Until we add `@playwright/test` to `devDependencies`, you can run Playwright via a pinned `npx`.

```bash
cd webui-next

# One-time (downloads browsers)
npm run e2e:install

# Run e2e with Playwright starting Vite (see playwright.config.ts)
npm run e2e

# Smoke subset (Tier 0)
npm run e2e:smoke
npm run e2e:smoke:mobile

# Optional: enable screenshot matrix
E2E_START_SERVER=1 E2E_SCREENSHOTS=1 node scripts/playwright.mjs test
```

## TODO

- Add `@playwright/test` dependency and pin it in `package-lock.json`.

# Clean checkout and contributor walkthrough

Reviewed against runtime `156a7c04`. This is a local setup procedure, not permission
to use shared accounts or mutate a service. See [configuration](CONFIGURATION.md)
for the important difference between fixture, standalone and BFF deployments.

## Install and run checks

Use a clean clone/worktree at the revision being reviewed. Supported Node is
^20.19.0, ^22.12.0 or >=24; CI uses Node 22 and npm 9.9.4. Both lockfiles matter:
the repository root and bff are separate npm packages, not a workspace install.

From the repository root:

```sh
node --version
npm --version
npm ci
npm ci --prefix bff
npm run env:check
npm run audit:design-docs
npm run test:bff
npm run ci:pr
npm run build
```

`npm ci` at the root alone does **not** install BFF dependencies. CI also runs
`npm audit --omit=dev --audit-level=critical` for the frontend and
`npm audit --omit=dev --audit-level=high --prefix bff`. Investigate findings; do
not apply an unreviewed forced dependency upgrade to make a check green.

The dev server is `npm run dev` (default 5173, strict port). Build output is dist,
which is ignored and must not be committed. `npm run preview` serves a static
build; it does not supply a working OAuth BFF or turn fixtures into live tests.

## Browser checks without service credentials

```sh
npm run e2e:install
npm run e2e -- e2e/specs/public/theme_language_bootstrap.spec.ts --project=chromium
```

The npm e2e wrapper starts Vite and uses synthetic fixtures. For the normal PR
selection use `npm run e2e:pr`; it includes desktop and mobile. Current checked-in
projects are `chromium` and `mobile-chrome` (Pixel 5). Historical WebKit evidence
was a separate configured run, not a project available in this default config.
The runner reads `e2e/PLAYWRIGHT_VERSION`; inspect wrapper/config changes together.
On Linux browser installation may need OS dependencies; follow the pinned
Playwright install output rather than disabling browser sandbox/security checks.

Use a free local port or stop only your own dev server. The harness may reuse an
existing server outside CI, so verify it serves this checkout. Do not set
E2E_BASE_URL to a shared host or inject E2E_STORAGE_STATE for the fixture walkthrough.
A retained trace/video can contain credentials in authenticated scenarios: default
outputs are `e2e/test-results` and `playwright-report`, both ignored.

For a focused unit test use e.g.:

```sh
npm test -- src/pages/app/admin/RequestReviewActions.test.ts
```

Read the scenario before running any `e2e:live:*` command. They are separate tools,
can mutate resources, and require an explicitly owned synthetic environment,
independent UI/API pins, receipts and cleanup. Never supply production credentials
to discover whether a test is safe.

## Local API and authentication integration

For offline fixture work, no token/config file is needed. For real integration,
choose an isolated API and registered OAuth client first. The shipped samples
contain service-default URLs, not a provisioned sandbox.

- Copy `.env.example` to `.env.local` only when overrides are needed. VITE values
  are public build/dev inputs. Never add a client secret or bearer token there.
- `public/config.local.js.example` is an optional alternative for local runtime
  overrides. It loads after config.js only on dev/loopback and intentionally fills
  missing values. Delete unused local overrides before comparing deployed behavior.
  Vite copies public files into dist: inspect the artifact and exclude any private
  local configuration before packaging. Gitignore is not a packaging guarantee.
- The deployed OAuth BFF uses Secure cookies and one trusted proxy hop. A plain
  HTTP Vite page plus a second BFF port is not a working same-origin login setup.
  Use a local **HTTPS** reverse proxy routing config/session/OAuth to the BFF and
  application/assets to Vite. Preserve forwarded HTTPS/host headers. Register the
  exact external callback and configure the API's CORS/auth header for that origin.
- Provide BFF environment privately as described in [BFF README](../../bff/README.md),
  including an explicit redirect, client credentials and fresh signing secret.
  Choose a writable private SESSION_STORE_PATH. One BFF process per store; keep
  its listener on loopback. Do not change cookie security to work around setup.

## Where to make a change

| Change | Starting point and accompanying review |
| --- | --- |
| Route/navigation | src/routes/router.tsx and imported route groups; direct permission gates, title/focus, sidebar tests, regenerate inventory |
| API behavior | src/lib/api domain adapter and model; method/units/null/owner/receipt contract, serialization tests and real API compatibility |
| Feature layout/action | src/pages plus shared primitives; compare role/state guards, cs/en, mobile, focus and uncertain outcomes |
| Text | Both src/i18n locale trees; i18n audits, applicant-message language distinct from operator locale |
| Styling | Semantic tokens in src/styles/index.css and shared UI primitives; both themes and long translated text |
| Authentication | bff plus src/app/auth.tsx/runtimeBootstrap and src/lib/auth; origin, session identity, rotation/logout races and store boundaries |
| Deployment | deploy host runbook/script plus config provenance, rollback and explicit target approval |

Update the affected contract/evidence row and its own work-log file. Source/tests
are the implementation reference; the [decision history](DECISIONS.md) prevents
reintroducing layouts the maintainer already rejected. [Documentation review](DOCUMENTATION_REVIEW.md)
explains how to review semantic completeness instead of relying on link checks.

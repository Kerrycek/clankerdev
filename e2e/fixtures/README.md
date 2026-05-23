# Fixtures

Fixtures should represent a **minimal subset** of HaveAPI responses used by e2e tests.

Rules:
- keep fixtures small
- prefer fixed timestamps
- include only fields the UI reads
- document scenarios (user-advanced, user-basic, admin-mine, admin-all, locks-vps)

The authoritative structure is defined in:
- `docs/spec/E2E_TEST_PLAN.md`

## Fixture router helper

Most specs should use the shared helpers:
- `bootstrapVpsAdminWindow(page, ...)` (sets `window.vpsAdmin` runtime config)
- `installHaveApiMock(page, ...)` (routes HaveAPI calls to deterministic handlers)

This keeps specs short and ensures we stay consistent with the runtime bootstrap.

# E2E fixture router

This repo uses a small fixture router to keep Playwright specs deterministic and consistent.

Files:
- `e2e/fixtures/bootstrap.ts`
- `e2e/fixtures/haveapi.ts`

## Bootstrapping the SPA

Most tests should set `window.vpsAdmin` before the app loads:

```ts
import { bootstrapVpsAdminWindow } from '../../fixtures';

test.beforeEach(async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    apiUrl: '/api',
    apiVersion: '7.0',
    sessionToken: 'TEST',
    webuiNext: { enableDesignSandbox: true },
  });
});
```

## Mocking HaveAPI

Install a network interceptor for `/api/v7.0` calls:

```ts
import { installHaveApiMock } from '../../fixtures';

await installHaveApiMock(page, {
  // Roles: user >= 1, support >= 21, admin >= 90
  user: { id: 1, login: 'e2e', level: 1 },
  handlers: {
    'GET vpses': ({ searchParams }) => {
      const fromId = searchParams.get('vps[from_id]');
      return {
        vpses: fromId ? [{ id: 250, hostname: 'vps250.example' }] : [{ id: 300, hostname: 'vps300.example' }],
      };
    },
  },
});

```

## Seeding tracked action states

Some UX (toasts, blocking progress modal) depends on tracked action states stored in `sessionStorage`.
Use the helper to seed them before the app loads:

```ts
import { seedTrackedActionStates } from '../../fixtures';

await seedTrackedActionStates(page, [
  {
    id: 42,
    addedAt: 1_700_000_000_000,
    actionLabelKey: 'action.vps.start.label',
    objectLabel: 'vps42.example',
  },
]);
```

### Handler key format

Handler keys can be:
- `METHOD <relative-path>` (preferred), e.g. `GET vpses`, `POST datasets/10/snapshots`
- `<relative-path>` (matches any method), e.g. `transaction_chains`
- `METHOD <full pathname>` or `<full pathname>` as a last resort

Relative paths are resolved under `/api/v{version}/`.

### Built-in defaults

The router provides small defaults so list pages do not crash due to background chrome requests:
- `GET users/current` -> current user (from `options.user`)
- `GET action_states` -> empty list
- `GET transaction_chains` -> empty list

Everything else returns `options.fallbackResponse` wrapped as a success envelope.

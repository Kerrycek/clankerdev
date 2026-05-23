# Mutation surface audit

This project relies on a **consistent mutation contract** so the UI stays responsive
and safe under asynchronous backend operations.

The contract (simplified):

1. **Preflight**: check whether the object is busy (transaction chains) before mutating.
2. **Local lock**: acquire a short local lock immediately on click (keeps the UI safe
   across route changes and prevents double-submits).
3. **ActionState tracking**: when the API returns `action_state_id`, track it so:
   - the Tasks drawer shows the operation
   - completion produces an in-app notification/toast
   - lock release can bind to `action_state_id`
4. **Invalidate/refetch**: refresh affected queries when the action finishes.

Because we add new pages/features continuously, it is easy to accidentally add a mutation
that does not follow this pattern.

The **mutation audit script** is a cheap static check that highlights likely drift.

## Running the audit

From repo root (`webui-next`):

```bash
npm run audit:mutations
```

> Note: the script can also be run directly via `node scripts/audit-mutations.mjs`.
> If the optional `typescript` package is available (normal dev install), it uses a TS AST parser.
> Otherwise it falls back to a regex/brace-scan heuristic (still useful for CI-lite checks).


This writes a report to:

- `work/audits/mutations.md`

You can also print JSON:

```bash
node scripts/audit-mutations.mjs --json
```

Or fail the command when warnings exist:

```bash
node scripts/audit-mutations.mjs --fail-on-warn
```

## What the audit checks

The audit scans `src/**` for `useMutation(...)` calls and then applies heuristic rules.

### Warning codes

- `missing-trackActionState`
  - The mutation calls `getMetaActionStateId(...)` but does **not** call
    `trackActionState(...)`.
  - This is almost always a bug: the operation is async but it won’t show up in Tasks,
    and lock release/invalidations may not bind correctly.

- `trackActionState-no-object`
  - The mutation tracks an action state but does not bind it to an object
    (`trackActionState(id, { object: ... })`).
  - Some actions are truly “global” and can ignore this, but for object actions the
    object binding is what enables consistent local-lock release and targeted invalidations.

- `missing-local-lock`
  - The mutation tracks an **object action state** but does not acquire a local lock.
  - This usually leads to a “double click starts two operations” class of issues.

- `missing-local-lock-release`
  - The mutation acquires a local lock but never releases it.
  - Locks bound to `action_state_id` are released on completion, but we still expect
    a best-effort release in `onSettled` so failed requests do not leave stale locks.

## Ignore directives

Some warnings are acceptable (e.g. a global background action that does not bind to a
single object).

You can silence warnings for a specific mutation by adding a comment **directly above**
the mutation statement:

```ts
// audit:ignore
const m = useMutation({ ... })
```

Or silence only a specific warning code:

```ts
// audit:ignore trackActionState-no-object
const m = useMutation({ ... })
```

## Relationship to runtime gating

The audit is a complement to runtime gating (preflight checks, busy badges, action
matrices). It does not replace them.

If the audit flags a mutation, fix it using the standard helpers:

- `chrome.acquireLocalLock(...)` / `chrome.releaseLocalLock(...)`
- `chrome.trackActionState(actionStateId, { object: ... })`
- `preflight*NotBusy(...)` helpers

See:

- `docs/spec/STATE_LOCKS_AND_TRANSITIONS.md`
- `docs/spec/ACTION_GATING_ENGINE.md`
- `docs/spec/LIVE_UPDATES_STRATEGY.md`

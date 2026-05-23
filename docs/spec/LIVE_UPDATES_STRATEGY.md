# Live updates strategy (polling, invalidation, responsiveness)

This spec defines how the UI stays "live" and consistent without becoming heavy or jittery.

The current backend surface (v1) provides:
- resource `Show` and `Index` actions (standard HTTP)
- task objects: **ActionState** + **TransactionChain**
- an efficient long-poll endpoint: `ActionState::Poll`
- per-chain "concerns" that identify affected objects

We use this to implement "near real-time" behaviour across the UI.

Last updated: 2026-02-01

---

## Goals

- **Perceived liveness**: state/locks update quickly enough that users trust the UI.
- **Responsiveness**: interactions do not block on background refresh.
- **Cheapness**: avoid per-row polling; prefer a small number of shared refresh loops.
- **Consistency**: refresh intervals and invalidation rules are centralized.

## Non-goals

- True push-based realtime (SSE/WebSockets) in v1.
  (If we add server push later, it should plug into the same client state model.)

---

## Central concept: refresh tiers

We define a few refresh tiers and reuse them everywhere.
Components must not invent their own ad-hoc intervals.

All polling cadences must come from `src/lib/refreshTiers.ts`.

| Tier | Visible tab | Hidden tab | Typical usage |
|---|---:|---:|---|
| **A** | 5s | 20s | task/activity drawers, busy indicators, “monitor” pages |
| **B** | 15s | 60s | detail pages (recent activity, DNS chain discovery) |
| **C** | 30s | 120s | secondary status tables, profile session list |
| **Slow** | 60s | 300s | heavier metrics + public status indexes |
| **ActionState poll** | 3s | 10s | action state tracking details |
| **Fast poll** | 2s | 5s | blocking/interactive wait loops (e.g. password wait modal) |

### Tier A – Active tasks + locks (global)

Used for:
- active ActionStates
- active TransactionChains
- lock map derived from chain concerns

Target latency:
- update within **~5 seconds** while the tab is visible

Recommended refresh:
- visible tab: **every 5s**
- hidden tab: **every 20s**

Implementation note:
- Implemented via `useDocumentVisibility()` + tier helpers from `src/lib/refreshTiers.ts`.

### Tier B – Object detail pages (context)

Used for:
- VPS detail while locked
- Dataset detail while locked

Default:
- no periodic refetch when idle
- refetch when:
  - a tracked task touching the object changes state
  - the user navigates back to the tab

Optional:
- while object is locked, refetch secondary `Show`/secondary lists every **~15s**.

Note:
- Some “critical” busy indicators (e.g. VPS actions availability) may use Tier A polling on the
  object’s chain index to meet the ~5s lock/busy latency acceptance criteria.

### Lists

Lists should be stable and not jitter.

Exception: *monitor lists* (Transactions, Transaction chains, Action states, Migration plans)
may poll at Tier A because their primary purpose is to show progress.

Rules:
- no background refetch just to "wiggle numbers"
- list state updates come from:
  - global lock map (Tier A)
  - user actions (search/pagination/manual refresh)
  - invalidation on task completion (Tier A event)

---

## Lock index (derived from transaction chains)

### Inputs

- `TransactionChain::Index` (poll)
- `transaction_chain.concerns` parsed via tolerant extractor
- chain state classification (finished vs active)

### Output

A lock map (ideally shared globally via layout/context, but may be local to a page):
- key: `{class_name, row_id}`
- value: list of locks + the most relevant lock summary

Implementation status:
- v0.6.x implements lock indexes in “busy-heavy” pages (e.g. VPS list, tasks pages)
  and relies on concern-based invalidation + detail polling elsewhere.
- A global lock map in AppLayout/ChromeContext remains a planned optimization.

### Polling strategy

We prefer to fetch only active chains.

If the API exposes a dedicated “active chains” index (or an efficient filter), use Tier A.
Otherwise, poll newest N chains and client-filter active ones (increase N cautiously).

If the API supports filtering a *single* state:
- poll `state=running` every 5s
- poll `state=queued` and `state=staged` every 15s
- poll `state=rollbacking` every 10s

If the API supports filtering multiple states (comma-separated or array):
- poll `state=queued,staged,running,rollbacking` every 5s

If the API does not support useful filtering:
- poll newest N chains and client-filter active ones
- increase N cautiously (e.g., 200) to avoid missing long-running active chains

### Correctness fallback (detail pages)

List pages may miss very old long-running chains.
Therefore:
- object detail pages must also query
  `TransactionChain::Index?class_name=...&row_id=...`
  to ensure accurate local lock state.

---

## ActionState tracking

### When we track

- whenever an API call returns `_meta.action_state_id`
- the UI adds it to the tracked set immediately

### How we update

- use `ActionState::Poll` for tracked IDs
- for non-tracked but recent action states (Tasks drawer), use Index refresh (lower frequency)

Recommended:
- tracked action states: poll every **2–3s**
  (or long-poll with `timeout` and `update_in` if supported)

### Linking to locks

We prefer chain concerns for object locks.
ActionState objects may not have stable object references.

We may still link ActionState → TransactionChain via best-effort heuristics:
- explicit relation fields
- label heuristic

(Existing helper: `extractRelatedTransactionChainIdFromActionState`.)

---

## Invalidation rules

Implemented in UI:
- When an `ActionState` finishes, we invalidate React Query caches for any related objects we can identify:
  - initiating object refs (tracked metadata + local lock bindings)
  - **best-effort**: if we can link the action state to a `TransactionChain`, we also invalidate objects listed in `transaction_chain.concerns`
- We also invalidate lightweight global task lists and the "busy" chain index query.


When a tracked task changes state:

1) If it is related to a transaction chain:
- invalidate queries for any objects listed in chain concerns

2) If we only know the action was triggered on object X (local):
- invalidate `Show` for object X
- optionally invalidate lists for the module if cheap

3) Always:
- refresh lock index (Tier A)
- show completion/failure toast

---

## Throttling and lifecycle

We must throttle in these cases:
- browser tab hidden (`document.visibilityState === 'hidden'`)
- user on mobile backgrounded
- network errors / offline

Rules:
- never "unlock" actions because refresh failed
- keep last known lock state for a short TTL (e.g., 30–60s)

Implementation notes:
- Lock-state TTL helpers live in `src/lib/lockState.ts`:
  - `deriveChainLockState(...)` — used for object detail pages where `busyTransaction` is derived from `TransactionChain::Index`
  - `isDataStale(...)` — used for list "busy" indexes to avoid showing rows stuck busy forever

---

## User-visible connection/sync state

The UI must remain responsive even when the backend is slow or unreachable.

Policy:
- **We do not block navigation** just because background polling fails.
- We do provide a **clear, compact indicator** in the app chrome so users know when data may be stale.

Implementation (v0.6.x):
- `AppLayout` monitors:
  - browser online/offline (`useNetworkStatus()` based on `navigator.onLine`)
  - errors on Tier A background queries (`ActionState::Index`, `TransactionChain::Index`)
- When offline or errors occur, the header renders `shell.sync-indicator`.
- Clicking the indicator shows a small popover with:
  - the human explanation (localized)
  - last error (if any)
  - **Retry** (manual refetch of the Tier A queries)
  - **Reload** (hard refresh)

Rationale:
- avoids silent failure ("why is nothing updating?")
- keeps the UI cheap by reusing existing Tier A queries
- keeps controls discoverable without cluttering the default happy-path UI

---

## Consistency requirements

- Refresh intervals are defined in **one** place.
- All lock/action availability comes through the shared gating layer.
- Any component that needs "live" must consume the shared lock/task context.

---

## Acceptance criteria

- If a transaction chain starts affecting a VPS, the VPS UI reflects "Busy" and disables mutating actions within ~5s.
- When the chain finishes, the UI re-enables actions and refreshes state within ~5s.
- List pages do not jitter (no constant rerenders due to background refetch of static lists).
- When the browser tab is hidden, polling slows down.


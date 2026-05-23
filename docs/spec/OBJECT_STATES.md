# Object states

This spec defines a **single, project-wide model** for how the UI understands and presents:

- lifecycle states (e.g., active/suspended/deleted)
- runtime states (e.g., VPS running/stopped)
- maintenance locks
- transaction/busy locks
- transitions ("starting…", "migrating…")

The purpose is to keep the product consistent and prevent ad-hoc per-page state logic.

Last updated: 2026-01-25

Related:
- `STATE_LOCKS_AND_TRANSITIONS.md` (lock detection + local transition locks)
- `ACTION_GATING_ENGINE.md` (how states/locks affect action availability)
- `LIVE_UPDATES_STRATEGY.md` (how the UI becomes "live" without random polling)
- `STATE_AND_LOCK_WIDGETS.md` (canonical UI widgets)

---

## State dimensions

We model state as a **small number of orthogonal dimensions**.
Every object detail header and list row renders these dimensions consistently.

### 1) Lifecycle state ("what the object *is*")

Lifecycle state comes from `object_state` (Lifetimes) where available.

UI lifecycle labels:
- `Active`
- `Suspended`
- `Soft deleted` (if applicable)
- `Deleted` / `Inactive`
- `Unknown`

Lifecycle is *not* the same as "running".
A VPS may be `Active` but `Stopped`.

### 2) Runtime state ("what the object is *doing*")

Runtime state is object-specific.

For VPS (primary):
- `Running`
- `Stopped`
- `Running (Rescue)`
- `Unknown` (no status data available)

Runtime state must never be encoded by color only.

### 3) Busy state ("an operation is in progress")

Busy state is derived from:
- active transaction chains that **concern** the object (best available backend signal)
- local in-flight actions started by this UI session (transition lock)

Busy is represented as a badge/pill:
- `Busy` (generic)
- optionally with a short verb in Advanced: `Starting…`, `Migrating…`, `Updating…`

Busy is *not* the same as runtime.

### 4) Maintenance lock state ("mutations are blocked")

Maintenance locks are backend-enforced and may apply via parents.

UI maintenance labels:
- `Maintenance` (lock)
- `Maintenance (master)` (master_lock)

Maintenance is shown as a blocking badge and normally disables mutations.

### 5) Access restriction state ("user may be blocked")

If the current user/account is suspended or non-active:
- show a global banner
- disable all mutating actions (view-only UI)

This is separate from per-object lifecycle.

---

## Canonical backend fields used by the UI

This section documents what the UI should expect to exist **today**.

### VPS

Inputs used:
- `vps.object_state` (Lifetimes; e.g., `active`, `suspended`, `soft_delete`, `hard_delete`)
- `vps.maintenance_lock` and `vps.maintenance_lock_reason` (Maintainable)
- `vps.is_running` (nullable boolean)
- `vps.in_rescue_mode` (nullable boolean)

Notes:
- `is_running === null/undefined` means "unknown" (status not available).
- A running/stopped label must be visible even if status is unknown.

### Dataset

Inputs used:
- `dataset.object_state` (typically `active` / `deleted`)
- dataset properties (quota, refquota, etc.)

Maintenance:
- many dataset mutations are blocked by maintenance on the **pool**;
  the backend enforces this; the UI must surface it via a "Maintenance" badge on the dataset header
  (even if the dataset object itself does not expose `maintenance_lock`).

### DNS

Inputs used:
- `dnsZone` enabled/disabled fields (zone-level)
- record enabled/disabled fields (record-level)

(Exact field names are API-defined; the UI should remain robust to missing optional fields
and treat unknown as "Unknown" state rather than guessing.)

### Transaction chains

Inputs used:
- `TransactionChain.state` (e.g. running / queued / done / failed)
- `TransactionChain.concerns` (class_name + row_id)

We treat chains in states:
- `queued`, `running`, `halted` (and any non-final state)

as **busy locks**.

Final states:
- `done`, `failed`, `fatal`, `resolved`

are not considered locks.

---

## Computed UI state model

The UI computes a small, stable state object for every displayed resource.

### Computed types (conceptual)

```ts
type LifecycleState = 'active'|'suspended'|'soft_delete'|'hard_delete'|'deleted'|'unknown'

type RuntimeState =
  | { kind: 'running'; rescue: boolean }
  | { kind: 'stopped' }
  | { kind: 'unknown' }

type BusyState =
  | { kind: 'none' }
  | { kind: 'local'; label?: string }
  | { kind: 'transaction'; chainIds: number[]; label?: string }

type MaintenanceState =
  | { kind: 'none' }
  | { kind: 'lock'; reason?: string }
  | { kind: 'master_lock'; reason?: string }

type EffectiveState = {
  lifecycle: LifecycleState
  runtime?: RuntimeState // omitted for non-runtime objects
  busy: BusyState
  maintenance: MaintenanceState
  blockedByAccount: boolean
}
```

Rule: components render from `EffectiveState` only, not from raw fields.

---

## Precedence rules

When multiple state dimensions apply, we do **not** merge them into a single label.
We render multiple small badges in a consistent order.

Badge order (left → right):

1) Lifecycle (`Suspended`, `Soft deleted`, `Deleted`)
2) Runtime (`Running`, `Stopped`, `Running (Rescue)`, `Unknown`)
3) Busy (`Busy`, `Starting…`, `Updating…`)
4) Maintenance (`Maintenance`, `Maintenance (master)`)

Rationale: the user should instantly see "what it is" (lifecycle), "what it's doing" (runtime),
"why it is blocked" (busy/maintenance).

---

## Unknown and missing data

Unknown data must be treated explicitly.

### VPS status missing

If `is_running` is missing:
- show runtime badge `Unknown`
- still allow power actions, but:
  - prefer a single "Power" dropdown in Basic (to reduce confusion)
  - Advanced may show Start/Stop/Restart actions in a dropdown (not three primary buttons)
  - when the user triggers an action, apply local transition lock immediately

### Avoid inference from UI artifacts

We must **not** infer state from:
- "usage stats missing"
- colors
- last task label

Only explicit backend fields + transaction chain concerns + local locks.

---

## Transitions (starting/stopping/updating)

Transitions are represented as **BusyState.kind = local** immediately after the user triggers an action.

Rules:
- show a `Busy` badge immediately
- disable mutating actions via the gating engine
- track `_meta.action_state_id` and/or `state_id` returned by HaveAPI
- upgrade the local busy badge to a `transaction` busy badge once the chain becomes visible

This keeps the UI responsive and prevents double-submit.

---

## Testing expectations

Unit tests:
- mapping raw VPS fields → `EffectiveState` for:
  - running/stopped/unknown/rescue
  - lifecycle suspended/deleted
  - maintenance lock present
  - busy chain present

E2E tests:
- object shows explicit runtime badge (Running/Stopped/Unknown)
- starting an action causes immediate Busy badge + disables mutations
- maintenance lock renders badge and disables mutations with reason


# Action matrix: Admin operations (Nodes + Migration plans)

This matrix covers admin-only operational actions.

Last updated: 2026-01-25

Related:
- `ACTION_GATING_ENGINE.md`
- `OBJECT_STATES.md`
- `STATE_AND_LOCK_WIDGETS.md`
- `SCREEN_SPECS.md` (admin screens)

---

## Nodes

### State inputs

Fields we rely on (HaveAPI `node#show` / `node#index`):

- `node.maintenance_lock` + `maintenance_lock_reason`
- `node.role` (e.g. vpsnode, storage) if present
- `public node status` (from public status endpoint): up/down/unknown
- recent transactions (for operational context)

Derived UI booleans:
- `maintLocked = node.maintenance_lock && node.maintenance_lock !== 'no'`
- `busy = hasActiveConcernChain('Node', node.id) || hasLocalTransitionLock('Node', node.id)`

### `admin.node.maintenance_lock.set`

- Group: `maintenance`
- Surface: node detail header, plus overflow menu
- Visible when: admin scope is `All` (Mine scope intentionally hides ops modules)
- Enabled when:
  - not busy (we do not allow toggling maintenance while another node-level operation is in flight)
- Disabled reason:
  - `busy.transaction` / `busy.local`
- Confirmation:
  - required when **locking**
  - optional when unlocking (but still ask in Basic)
- Transition UX:
  - immediate `busy.local`
  - track action_state_id if returned
- On completion invalidate:
  - node#show
  - public status (so the banner updates)
  - node transactions list

### `admin.node.evacuate.start`

- Group: `ops`
- Surface: node detail page (form)
- Visible when:
  - admin scope is `All`
- Enabled when:
  - required form fields are valid
  - not `busy`
  - not `maintLocked` (evacuation should typically be done with an explicit maintenance lock; enforce this in UI)
- Disabled reason:
  - if maintLocked is false: `blocked.requires_maintenance_lock`
  - busy: `busy.*`
- Confirmation:
  - required
- Transition UX:
  - create a dedicated “Evacuation started” notification
  - provide deep link to the created transaction chain / action state

> Rationale for requiring maintenance lock:
> evacuation is disruptive; we want a clear, deliberate “node is under maintenance” signal.

---

## Migration plans

Migration plans are admin-only orchestration objects.

### State inputs

- `plan.state` (observed values: `staged`, `running`, `cancelling`, `failing`, `cancelled`, `done`, `error`)
- `plan.started_at`, `plan.finished_at` (if present)
- migrations list count

Derived:
- `planIsMutable = plan.state in ['staged']`
- `planIsRunning = plan.state in ['running','failing','cancelling']`
- `planIsTerminal = plan.state in ['done','cancelled','error']`

### `admin.migration_plan.create`

- Group: `ops`
- Surface: migration plans list page (primary action)
- Visible when: admin scope is `All`
- Enabled when:
  - form inputs valid (concurrency numeric if provided)
- Disabled reason:
  - `blocked.not_admin` (role-gated by route; included for completeness)
- Confirmation:
  - not required (create is non-destructive), but show a short preview of chosen options
- Transition UX:
  - track returned `action_state_id` (meta) in tasks drawer
  - on success, navigate to the created plan detail

### `admin.migration_plan.migration.schedule`

- Group: `ops`
- Surface: plan detail page (form)
- Visible when: admin scope `All`
- Enabled when:
  - `planIsMutable`
  - form valid (vps id, dst node)
- Disabled reason:
  - `blocked.plan_state`
- Transition UX:
  - optimistic append to the table as “pending” row
  - refetch list on success

### `admin.migration_plan.migration.schedule_batch`

- Group: `ops`
- Surface: plan detail page (batch form)
- Enabled when:
  - `planIsMutable`
  - destination node set
  - list has at least one valid VPS id
- Must-have UX:
  - show progress counter (x/y)
  - show failures inline
  - allow cancellation (client-side) without breaking already submitted jobs

### `admin.migration_plan.start`

- Group: `ops`
- Surface: plan detail header
- Visible when: admin scope `All`
- Enabled when:
  - `planIsMutable`
  - migrations count > 0
- Disabled reason:
  - `blocked.plan_state` / `blocked.requires_migrations`

### `admin.migration_plan.cancel`

- Group: `ops`
- Surface: plan detail header
- Enabled when:
  - `planIsRunning`

### `admin.migration_plan.delete`

- Group: `danger`
- Surface: plan detail header overflow
- Enabled when:
  - `planIsTerminal`

---

## Required consistency checks

- All admin list screens must use keyset pagination (`from_id`).
- Admin actions must still use the same gating engine (different surfaces, same rules).

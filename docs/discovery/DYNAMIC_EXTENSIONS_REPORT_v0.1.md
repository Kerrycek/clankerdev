# Dynamic API surface extensions detected in code (v0.1)

This report documents API resources/actions/params that are **not declared as normal nested classes** in resource files, but are added via `include ...` hooks and `define_action` / `define_resource` metaprogramming.

These are easy to miss in static scans and must be considered for:

- new UI coverage (features exist even if not obvious in files)
- upgrade tests (API surface changes may happen indirectly)

All references below are from the provided release tarball.

---

## 1) `VpsAdmin::API::Maintainable::Action`

**Code:** `api/lib/vpsadmin/api/maintainable.rb`

### What it does
When included in a `HaveAPI::Resource`, it:

1. **Adds output parameters** to existing actions (if present):
   - `Index.output` and `Show.output` get:
     - `maintenance_lock` (choices: `no|lock|master_lock`, db_name: `maintenance_lock?`)
     - `maintenance_lock_reason`

2. **Defines a new action** on the resource:
   - `SetMaintenance` (POST)
   - Sets/unsets a maintenance lock

### Resources that include it (found via `include VpsAdmin::API::Maintainable::Action`)
- `VpsAdmin::API::Resources::Location`
- `VpsAdmin::API::Resources::Node`
- `VpsAdmin::API::Resources::Environment`
- `VpsAdmin::API::Resources::VPS`
- `VpsAdmin::API::Resources::Cluster` (singular)
- `VpsAdmin::API::Resources::Pool`

### UI implications
- Anywhere the UI lists/shows these objects, it should display **maintenance lock state** and possibly **reason**.
- In Admin workspace, these resources need a **Maintenance** control (lock/unlock + reason).

---

## 2) `VpsAdmin::API::Lifetimes::Resource`

**Code:** `api/lib/vpsadmin/api/lifetimes.rb`

### What it does
When included in a `HaveAPI::Resource`, it:

1. Defines a **nested resource** `StateLog` under the parent resource:
   - route: `{parent_id}/state_logs`
   - model: `ObjectState`
   - actions: `Index`, `Show` (admin-only)

2. Adds lifetime params to existing actions (patch-style):
   - `Index.input` gets `object_state` filter
   - `Index/Show/Create.output` gets `object_state`, `expiration_date`, `remind_after_date`
   - `Update.input` gets `object_state`, `expiration_date`, `remind_after_date` (and reason)

### Resources that include it (found via `include VpsAdmin::API::Lifetimes::Resource`)
- `VpsAdmin::API::Resources::User`
- `VpsAdmin::API::Resources::VPS`

### UI implications
- Admin workspace should have a **State history** section on User/VPS detail pages using `StateLog`.
- User workspace should at least surface current `object_state` and `expiration_date` as status badges / warnings.

---

## 3) `VpsAdmin::API::Plugins::Requests::BaseResource`

**Code:** `plugins/requests/api/resources/base.rb`

### What it does
It provides common params and defines actions using `define_action`:

- `Index` (Default::Index)
- `Show` (Default::Show)
- `Create` (Default::Create)
- `Resolve` (custom POST)

Used by:
- `UserRequest::Registration`
- `UserRequest::Change`

### UI implications
- “Requests” are a real module with multi-step workflows (create, review, resolve) and need first-class UI pages.


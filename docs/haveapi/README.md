# HaveAPI sources and distilled reference

This bundle includes **HaveAPI server-side sources** from vpsAdmin so WebUI Next development can be grounded in *code truth*.

It also includes distilled artefacts under `docs/discovery/` and additional human-readable notes in this directory.

## Where the HaveAPI sources live in this bundle

Core API (main HaveAPI implementation):

- `vpsadmin/api/lib/vpsadmin/api/resources/` — **HaveAPI resources** (what the API exposes)
- `vpsadmin/api/lib/vpsadmin/api/operations/` — service objects used by actions (business logic)
- `vpsadmin/api/lib/vpsadmin/api/` — shared helpers, mixins and concerns used by resources/actions

Plugins (extend/override API surface):

- `vpsadmin/plugins/*/api/` — additional resources and overrides.

The sources were taken from the vpsAdmin release shipped in this conversation (see `vpsadmin/VERSION`).

## How this maps to runtime HaveAPI

At runtime, HaveAPI is **self-describing**. The client can discover the full schema via:

- `OPTIONS https://api.vpsfree.cz/v7.0/`

The WebUI Next code is written to prefer injected description (`window.vpsAdmin.description`) when integrated,
but it can also fetch the description via `OPTIONS` in standalone/dev mode.

## Default actions and legacy aliases

Most resources expose the default CRUD-ish actions:

- `Index`, `Show`, `Create`, `Update`, `Delete`

The legacy clients sometimes use **aliases**:

- `list` ↔ `index`
- `find` ↔ `show`
- `destroy` ↔ `delete`

When comparing legacy WebUI behavior to API sources, keep these aliases in mind.

## Roles and authorization (vpsFree conventions)

The API uses both a **numeric user level** and a **role helper**.

Typical mapping (as implemented in vpsAdmin):

- level ≥ 1 → `:user`
- level ≥ 21 → `:support` (what the old webui calls “admin” privileges)
- level ≥ 90 → `:admin` (superadmin-level, many global actions)

HaveAPI authorization is primarily expressed via:

- `auth false` → public action
- `authorize do |u| ... end` blocks, usually with `allow if ...`
- `restrict` clauses (scope/row restrictions)

Additionally, some actions perform runtime checks inside `exec` (e.g. `error!('access denied') ...`).

## Dynamic extensions you must not miss

Not everything is declared as `class X < HaveAPI::Action`.

Some actions/resources are **added dynamically** by helpers/mixins:

- `Maintainable` adds `SetMaintenance` actions to multiple resources
- `Lifetimes` adds nested `StateLog` resources
- Requests plugin uses `define_action(...)` patterns for `UserRequest::*`

See `docs/haveapi/DYNAMIC_EXTENSIONS.md`.

## What to read next

- `docs/haveapi/PUBLIC_ENDPOINTS.md` — all `auth false` actions (used for public overview/outages)
- `docs/haveapi/AUTHZ_MODEL.md` — how to reason about permissions from sources
- `docs/haveapi/UI_MODULE_MAPPING.md` — how WebUI Next pages map to HaveAPI resources/actions
- `docs/haveapi/RESOURCE_INDEX.md` — a generated index of resources → actions → source file


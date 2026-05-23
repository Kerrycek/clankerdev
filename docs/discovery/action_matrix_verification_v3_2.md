# Action matrix verification v3.2

This note explains what is covered by the **capabilities_matrix_v3.2** extraction and what still requires care.

## Covered (high confidence)

1) **All explicit action classes**
- Any `class X < HaveAPI::Action` or `class X < HaveAPI::Actions::Default::*` nested under a `HaveAPI::Resource` is included.

2) **Dynamic actions created via `define_action`**
- The following `define_action` sources are explicitly modeled and expanded:
  - `VpsAdmin::API::Plugins::Requests::BaseResource` (UserRequest::Change + UserRequest::Registration)
  - `VpsAdmin::API::Maintainable::Action` (SetMaintenance added to each resource that includes it)
  - `VpsAdmin::API::Lifetimes::Resource` (StateLog resource + Index/Show actions for each including resource)

3) **Blocking/http_method/route/auth hints**
- Extracted directly from action class bodies when present.
- `blocking` defaults to `false` when not declared.

4) **Authorize filtering**
- The extractor captures the `authorize do ... end` block text (and detects:
  - `allow if u.role == :admin`
  - `restrict user_id: u.id`
  - `deny unless u`
  - `auth false`
  )
- Classification is heuristic but grounded in those patterns.

## Not fully covered (known limitations)

1) **Runtime checks inside `exec`**
Some actions do extra authorization checks inside `exec` and fail with `error!(...)`.
These are detected only by a coarse scan for `error!('access denied'...)` patterns; there may be other runtime-only gating.

2) **Param set mutation done by mixins**
Modules like `Lifetimes::Resource` *mutate* existing action input/output.
We document this in `DYNAMIC_EXTENSIONS_REPORT_v0.1.md`, but the matrix does not fully expand the final parameter schema.

3) **Pluralization / canonical HTTP routes for default actions**
Default CRUD actions do not always declare `route`/`http_method`. The matrix focuses on explicit route/method declarations.
The real client should rely on HaveAPI description at runtime (cached), not on this static inference.

## Suggested CI gate

- Re-run extraction on every update.
- Fail the build if:
  - the set of actions changes unexpectedly
  - any new `define_action` / `define_resource` sites appear without being handled
  - classification for previously-known actions changes


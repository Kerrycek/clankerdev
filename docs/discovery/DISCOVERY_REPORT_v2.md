# vpsAdmin HaveAPI / WebUI discovery report (2nd pass, no-misses)

Generated: 2026-01-20

This is a re-run with stricter extraction and cross-checks to ensure **no resources/actions/pages are missed**.

## What was scanned

### HaveAPI
- Main API resources: `api/lib/vpsadmin/api/resources/**/*.rb`
- Plugin API resources: `plugins/*/api/resources/**/*.rb`
- Total Ruby files parsed with `Ripper.sexp`: 76
- Parse errors: 0

### Legacy PHP WebUI
- Pages: `webui/pages/page_*.php` (27 files)
- Action branching patterns detected:
  - `switch (...) { case '...' }`
  - `$_GET['action'] == '...'` / `$_POST['action'] == '...'`
  - `$action == '...'`
  - `$_GET['rule'] == '...'` / `$_GET['type'] == '...'` (where they are used as “sub-actions”)

## Final counts (source of truth)

### HaveAPI
- Resource classes (`< HaveAPI::Resource`): **109**
- Action classes:
  - Default actions (`< HaveAPI::Actions::Default::{Index,Show,Create,Update,Delete}`)
  - Custom actions (`< HaveAPI::Action`)
- Total action classes: **410**

Notes:
- A naïve grep count shows 413 because **3 lines are commented-out stubs** (`# class Delete < HaveAPI::Actions::Default::Delete`) in:
  - `location.rb`
  - `node.rb`
  - `environment.rb`
  Those are **not real actions**.

### Legacy WebUI pages
- Pages: **27**
- Total distinct “action-like” values discovered across pages: **327**

Notable misses fixed vs the first pass:
- `page_login.php` uses `if ($_GET['action'] == ...)` (not `switch/case`), so it was missing before.
- `page_adminm.php` uses `$action` from POST + `$_GET['rule']` for moderation; now included.
- `page_adminvps.php` has multi-step wizard actions (`new-step-*`, `migrate-step-*`, `clone-step-*`).

## Plugin overrides that affect the effective API surface

These do not create new resources, but they **change auth/output/visibility** and therefore matter for UI role separation.

- `plugins/requests/api/resources/override.rb`
  - `Location::Index.auth false` + custom authorize/output whitelist
  - `OsTemplate::Index.auth false` + different output whitelists pre-login vs logged-in
  - `Language::Index.auth false`

- `plugins/payments/api/resources/override.rb`
  - Reopens `User` resource and augments outputs with `payments` fields
  - Adds `User::GetPaymentInstructions` action

## Generated artifacts

- `haveapi_inventory_v2.json`
  - Raw list of resource/action class declarations from Ruby AST, with file/line.

- `haveapi_resources_actions_v2.json`
  - UI-friendly mapping: resource -> list of action names + counts (includes plugin-added `User::GetPaymentInstructions`).

- `webui_pages_inventory_v3.json`
  - Improved legacy page/action inventory including `page_login.php` and `$action` branching.

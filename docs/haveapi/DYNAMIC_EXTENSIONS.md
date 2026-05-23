# Dynamic extensions in vpsAdmin HaveAPI

In vpsAdmin, **not all API actions/resources are declared as nested Ruby classes** like:

```ruby
class Index < HaveAPI::Actions::Default::Index
end
```

Some are added dynamically by helper modules (`define_action`, `define_resource`) or by reopening classes in plugins.

If you're doing discovery, upgrade checks, or auto-wiring UI functionality, you must account for these.

## Maintainable: `SetMaintenance` actions

The module `VpsAdmin::API::Maintainable` (see `vpsadmin/api/lib/vpsadmin/api/maintainable.rb`) adds a `SetMaintenance` action to multiple infrastructure resources.

Typical properties:

- **admin-only**
- used to set/clear maintenance locks with a reason
- affects objects like nodes, locations, pools, environments, VPSes

If you only scan for nested action classes, you will miss these.

## Lifetimes: nested `StateLog` resources

The module `VpsAdmin::API::Lifetimes::Resource` dynamically defines a nested resource `StateLog`.

This is used for “state log/history” views of certain objects. It is typically:

- **admin-only**
- provides `Index` + `Show`

## Requests plugin: actions declared with `define_action`

The requests plugin defines resources like `UserRequest::Registration` and `UserRequest::Change` using `define_action(...)` in a base resource class.

These actions are real, but they do not appear as nested `class X < ...` definitions.

This matters because legacy WebUI uses these flows (registration/change requests).

## Plugin overrides (reopening actions/resources)

Several plugins reopen existing resources/actions to adjust:

- `auth` (e.g. making some indices public)
- whitelists/blacklists for output
- authorization logic

Examples:

- requests plugin overrides `Location::Index` and `OsTemplate::Index` visibility
- payments plugin adds `User::GetPaymentInstructions`

When reading sources, always check `vpsadmin/plugins/*/api/resources/override.rb`.

## Practical impact on WebUI Next

- Use **curated workflows** for key UX.
- Use a **generic Action Runner** for long-tail admin actions.
- When upgrading API versions, regenerate discovery artefacts to catch dynamic changes.


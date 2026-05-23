# HaveAPI distilled summary

This summary is derived from the discovery artefacts shipped with this bundle.

## Surface size

- Resources: **109**
- Actions: **428**

## Authorization classification (actions)

- **public**: 26
- **authenticated**: 104
- **owner_or_admin**: 143
- **admin_only**: 155

## Public actions (no login)

Key ones used by public pages:

- `Cluster::PublicStats`
- `Node::PublicStatus`
- `Outage::Index`
- `Outage::Show`
- `OutageUpdate::Index`
- `OutageUpdate::Show`
- `NewsLog::Index`
- `HelpBox::Index`

Full list: see `docs/haveapi/PUBLIC_ENDPOINTS.md`.

## Dynamic extensions to keep in mind

- Maintainable → `SetMaintenance`
- Lifetimes → nested `StateLog`
- Requests plugin defines actions via `define_action`
- Plugins can reopen actions/resources to change `auth`/`authorize`/whitelists

See `docs/haveapi/DYNAMIC_EXTENSIONS.md`.

# Authorization model in vpsAdmin HaveAPI

This document is a practical guide for **WebUI Next developers** on how to infer what a logged-in user/admin can see/do from the API sources.

## Key mechanisms

### 1) `auth false` (public actions)
If an action declares:

```ruby
auth false
```

...then the action is callable without authentication.

WebUI Next uses this for the **public Overview** and **public Outages** pages.

### 2) `authorize do |u| ... end`
Most permissions are expressed using `authorize` blocks, typically:

```ruby
authorize do |u|
  allow if u.role == :admin
end
```

Or owner restrictions like:

```ruby
authorize do |u|
  allow if u.id == obj.user_id || u.role == :admin
end
```

### 3) `restrict`
Some resources/actions use `restrict` to limit records for non-admins.
This is a *data shaping* mechanism as much as a permission check.

### 4) Whitelists/blacklists
Resources/actions can shape what fields are visible by role, using:

- `output do ...` + `whitelist` / `blacklist`
- `input do ...` + `whitelist` / `blacklist`

This matters for UI forms: some fields exist but are not writable or not visible.

### 5) Runtime checks inside `exec`
Some actions perform additional checks at runtime:

```ruby
error!('access denied') unless ...
```

These can be more specific than `authorize` and may depend on object state.

WebUI Next must always handle a server-side access denial gracefully (toast + inline error), even if the UI believed the action was permitted.

## Role levels (vpsFree conventions)

vpsAdmin maps numeric `User.level` to role helpers:

- level ≥ 1 → `:user`
- level ≥ 21 → `:support` (old webui “admin” privilege)
- level ≥ 90 → `:admin` (superadmin)

In the API sources, **many global operations check `u.role == :admin`**, so they require level ≥ 90.

WebUI Next should treat "Admin workspace" as "support+", but still **hide/disable superadmin-only sections** when `role != :admin`.

## Practical UI rules

1) Prefer **capability-driven** UI:
   - show/hide sections based on role and known ownership
   - but always tolerate `403` / access denied

2) Separate **User workspace** and **Admin workspace** navigation.
   - avoid mixing menus (prevents mistakes)

3) Use UI-side confirmations / safer wording where the frontend needs additional protection.
   - never use typed confirmations

4) Always keep links as real anchors for midclick workflows.

## Artefacts in this bundle

- `docs/discovery/capabilities_matrix_v3_2.json` — per action classification (public/authenticated/owner_or_admin/admin_only)
- `docs/discovery/runtime_gating_report_v2_1.md` — actions that contain runtime `access denied` checks


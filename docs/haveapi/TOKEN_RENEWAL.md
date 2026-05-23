# HaveAPI token renewal

vpsAdmin's HaveAPI `token` authentication uses **time-limited sessions**.
In the legacy web UI, the session stays valid for as long as the UI tab is open.

This SPA replicates that behavior so sessions do **not** randomly expire while the UI is
open (especially on long-lived dashboards).

## How WebUI Next keeps the session alive

The component `src/components/layout/SessionTokenKeepalive.tsx` runs in authenticated
app shells and periodically calls a cheap endpoint:

- `GET /users/current`

Any authenticated request refreshes the session lifetime on the server, so this keepalive
prevents "idle but open" tabs from expiring.

The interval is derived from `window.vpsAdmin.sessionLength` when present, with safe
defaults and conservative clamping.

Additional opportunistic renewals are triggered on:
- window focus
- returning from background (`visibilitychange`)

## Notes

- OAuth2 access tokens are **not** handled here; they typically require refresh tokens or re-login.

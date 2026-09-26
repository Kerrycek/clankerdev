# HaveAPI token renewal

vpsAdmin's HaveAPI `token` authentication uses **time-limited sessions**.
The legacy web UI renews the API token while separately running a browser logout countdown.

This SPA renews API tokens to avoid unexpected server expiry during use. The browser
inactivity countdown described below controls how long the UI may remain idle.

## How WebUI Next keeps the session alive

The component `src/components/layout/SessionTokenKeepalive.tsx` runs in authenticated
app shells and periodically calls a cheap endpoint:

- `GET /users/current`

Any authenticated request refreshes the session lifetime on the server, so this keepalive
keeps the API token usable until the browser inactivity policy logs the user out.

The interval is derived from `window.vpsAdmin.sessionLength` when present, with safe
defaults and conservative clamping.

Additional opportunistic renewals are triggered on:
- window focus
- returning from background (`visibilitychange`)

## Notes

- OAuth2 access tokens are **not** handled here; they typically require refresh tokens or re-login.

## Browser inactivity countdown

The header displays the remaining browser inactivity time from the current user's
`preferred_session_length`, not that constant setting and not the BFF cookie's
30-day lifetime. A zero limit disables the countdown. Missing/invalid limits do
not produce a guessed deadline.

`AuthProvider` starts the policy once the user is loaded. Trusted pointer, keyboard,
wheel and touch movement events extend the deadline; API polling, token renewal,
focus, and re-rendering do not. At expiry the UI navigates through its configured
logout endpoint (the integrated BFF destroys its session and revokes tokens).
Focus/visibility changes check elapsed wall time so sleeping tabs cannot revive an
expired deadline.

For integrated BFF sessions, tabs and reloads share the last activity timestamp in
localStorage, scoped by the BFF's non-credential `sessionKey`. Token rotation keeps
that identity; a new login gets a fresh one. Neither access tokens nor session
cookies are stored by the countdown. Without a BFF identity or usable storage,
the policy runs in memory for the current page. This is a browser UX policy, not a
replacement for server-side token expiry/revocation or a server-enforced idle limit
while all UI pages are closed.

Thus the legacy token keepalive above maintains API availability during an active
browser session but never resets the UI inactivity deadline.

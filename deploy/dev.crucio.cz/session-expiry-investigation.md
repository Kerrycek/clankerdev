# Automatic logout/session expiry investigation

GitHub issue: `#3` (`unlog`)

## Finding

This repository does not contain enough source code to safely implement a fix
for automatic logout or session expiry behavior.

The authentication behavior is implemented in generated WebUI Next JavaScript
assets and in the WebUI Next OAuth BFF. In this repository:

- `assets/*.js` are built/minified UI artifacts.
- `deploy/dev.crucio.cz/config.js` only wires the deployed UI to
  `/oauth/login`, `/oauth/logout`, and the local test API.
- `deploy/dev.crucio.cz/webui-next-bff.service` points to BFF source deployed on
  the server under
  `/opt/webui-next/releases/20260314-172752/vpsadmin/webui-next/bff`, but that
  BFF source is not present in this repository.
- No package manifest, Vite/React source tree, or build/sync workflow for
  regenerating `assets/*.js` is present here.

The built OAuth client in `assets/oauth2Client-*.js` indicates that the browser
stores an OAuth access token with an `expiresAt` value derived from
`expires_in`, with a 30 second safety margin. Since this is minified build
output, it should be treated as evidence for where to investigate, not as a safe
place to patch.

## Where the fix should live

The fix should be made in the WebUI Next source project, then rebuilt and synced
into this repository/deployment. Depending on the root cause, the likely source
areas are:

- the browser OAuth2 client that stores access tokens, calculates expiry, and
  handles expired-token navigation;
- the app API client/auth provider that reacts to `401` responses;
- the OAuth BFF that owns `/oauth/*`, session cookies, server-side session
  persistence, token exchange, and token revocation.

If the current behavior is caused by access tokens expiring without refresh or
without a friendly re-auth flow, the source fix should be implemented there
rather than patching a compiled asset.

## Missing source/build workflow

To fix this safely, the PR needs the source tree and repeatable build workflow
for the WebUI Next release that produced the current files under `assets/`.
At minimum, document or add:

- the upstream/source repository and commit or release tag for WebUI Next;
- commands to install dependencies, run tests, and build the UI;
- the process for syncing rebuilt assets into this deployment repository;
- the source location for the OAuth BFF and its test/start commands.

Until that exists, changes to `assets/*.js` would be a direct minified-asset
patch and should be avoided unless a human explicitly approves an emergency
hotfix.

## Suggested next steps

1. Reproduce the logout/session expiry issue against `dev.crucio.cz` and record
   the exact timing, failed request, response status, and redirect path.
2. Locate the WebUI Next source release matching
   `/opt/webui-next/releases/20260314-172752/`.
3. Fix expiry handling in source. Prefer refresh/re-auth behavior that preserves
   the current route and clears stale credentials on unrecoverable `401`
   responses.
4. Add tests around expired access tokens and `401` handling.
5. Rebuild the UI and sync generated assets through the documented workflow.

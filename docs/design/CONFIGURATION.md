# Configuration and persisted data reference

Observed baseline: `156a7c04`. Sources:
[runtime config](../../src/app/config.ts), [bootstrap](../../src/app/runtimeBootstrap.ts),
[Vite](../../vite.config.ts), [BFF](../../bff/server.js).
Defaults describe code, not verified values on either deployment host.

## Loading order and supported modes

1. Bootstrap tries same-origin config.js under the build base, with a root fallback.
2. In Vite dev or a loopback hostname, it then tries config.local.js. The sample
   fills gaps; it does not override already supplied integrated values.
3. With runtime vpsAdmin configuration present and no legacy sessionToken, bootstrap
   attempts same-origin session.json (JSON only, no-store). A valid response clears
   stale standalone OAuth tokens, including a valid anonymous/null response.
4. Runtime window values generally override VITE environment values, then code
   defaults. VITE values are public build-time inputs, not server secrets.

Deployed mode uses BFF code exchange and server-side refresh tokens. Standalone
SPA OAuth and embedded legacy runtime tokens are alternative code paths, not
interchangeable recipes for the confidential-client deployment. Browser-held
access tokens remain credentials even though refresh/client secrets stay server-side.

Authentication selection is a separate precedence rule: an active impersonation
token in sessionStorage takes priority over runtime OAuth accessToken, then runtime
legacy sessionToken, then stored standalone OAuth, then anonymous. This is not a
BFF account switch; see [impersonation](ACTION_CONTRACTS.md#impersonation).

## Frontend controls

Paths below are relative to window.vpsAdmin unless explicitly VITE-only.

| Setting | Runtime / VITE equivalent | Default and interpretation |
| --- | --- | --- |
| API | api.url / VITE_API_URL; api.version / VITE_API_VERSION | https://api.vpsfree.cz; 7.0. Client appends /v7.0; version normalizes leading v. Use an owned API for live tests. |
| Router | webuiNext.basePath / VITE_ROUTER_BASENAME or VITE_BASE_PATH | Root. Vite asset base must match router and reverse proxy; changing only runtime does not relocate built assets. |
| HaveAPI | webuiNext.haveApi.authHeader/metaNamespace / VITE_HAVEAPI_AUTH_HEADER, VITE_HAVEAPI_META_NAMESPACE | BFF supplies X-HaveAPI-OAuth2-Token and _meta; standalone behavior must match description/API CORS. |
| UI persistence | webuiNext.uiSettings.persistence / VITE_UI_SETTINGS_PERSISTENCE | server, with local fallback; only explicit local disables server sync. |
| UI record | uiSettings.server.path/namespace/field under webuiNext / VITE_UI_SETTINGS_SERVER_PATH, VITE_UI_SETTINGS_NAMESPACE, VITE_UI_SETTINGS_FIELD | /webui_user_settings, ui, settings. field means record key, not payload member. GET filters namespace/key; PUT /{namespace}/{key} sends value as JSON string. Adapter rejects unrelated configured resource paths by falling back to default. |
| Login/logout | webuiNext.loginUrl/logoutUrl / VITE_LOGIN_URL, VITE_LOGOUT_URL | {basename}/oauth/login and /oauth/logout; BFF supplies root endpoints. |
| Recovery | webuiNext.passwordRecoveryUrl / VITE_PASSWORD_RECOVERY_URL | Unset in generic runtime; BFF supplies provider URL with client_id. |
| Passkey | webuiNext.passkeyRegistrationUrl | BFF supplies /oauth/passkey; enrollment stays on authentication origin. |
| Legacy links | webui.url / VITE_WEBUI_URL; webuiNext.legacyUrl / VITE_LEGACY_WEBUI_URL | Optional and distinct; not authorization bypasses. |
| Timezone | webuiNext.serverTimeZone, then serverTimeZone / VITE_SERVER_TIME_ZONE | Europe/Prague fallback; explicit account zone still takes precedence in display. |
| Status thresholds | webuiNext.publicStatus.ipv4Warn/ipv4Critical / VITE_PUBLIC_IPV4_WARN, VITE_PUBLIC_IPV4_CRITICAL | 64/16; rounded nonnegative, critical capped at warning. |
| Standalone OAuth | webuiNext.oauth2.* / VITE_OAUTH2_AUTHORIZE_URL, TOKEN_URL, CLIENT_ID, SCOPE, TYPE, FLOW, STORAGE, REDIRECT_PATH (each with VITE_OAUTH2_ prefix) | Provider defaults in config.ts; clientId hostname, scope all, type web_server, pkce flow, session storage, {basename}/oauth/callback. BFF does not obtain its secret from these fields. |

Vite-only controls: VITE_DEV_HOST/PORT (default port 5173), VITE_DEV_HTTPS and
VITE_DEV_HTTPS_KEY/CERT paths; VITE_API_PROXY_TARGET/PREFIX/SECURE for optional local
API proxy (prefix /api, certificate validation on). No proxy is configured by default.
Keep TLS validation on. VITE_PUBLIC_BASE_PATH is a build-base alias only; prefer
VITE_ROUTER_BASENAME for matched asset/router configuration. VITE_BUILD_SHA is a
build provenance override, not proof of clean source. VITE_ENABLE_DESIGN_SANDBOX
exposes the internal design sandbox in production when enabled; do not enable it
incidentally for a release. Heatmap configuration is a separate API/legacy fact;
see [URL eligibility](../../src/lib/nodeHeatmap.ts), not an invented VITE endpoint.

## BFF environment

Keep the environment file out of source/artifacts and readable only by approved
operators/service identities. Units currently reference /etc/webui-next/oauth.env.
Changing client/secret/origin/session settings requires an explicit rollout plan.

| Variable | Default / requirement |
| --- | --- |
| OAUTH_AUTHORIZE_URL, OAUTH_TOKEN_URL | Required provider endpoints |
| OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET | Required; secret is confidential, ID is public |
| SESSION_SECRET | Required cryptographically random signing secret, minimum validated length; generate at least 32 random bytes |
| OAUTH_REDIRECT_URI | Explicit registered external callback recommended; otherwise https://{DOMAIN}/oauth/callback |
| DOMAIN | clankerdev.vpsfree.cz; used for callback fallback, not DNS provisioning |
| PORT, fallback BFF_PORT | 3001; listener binds 127.0.0.1 |
| API_URL, API_VERSION | https://api.vpsfree.cz, 7.0; exposed as public config |
| HAVEAPI_AUTH_HEADER, HAVEAPI_META_NAMESPACE | X-HaveAPI-OAuth2-Token, _meta |
| OAUTH_SCOPE, OAUTH_TYPE | all, web_server |
| OAUTH_REVOKE_URL | Empty; revocation skipped when unconfigured, otherwise bounded best-effort on logout |
| PASSWORD_RECOVERY_URL | /oauth2/password-reset resolved against authorize URL; adds client_id if absent |
| SESSION_STORE_PATH | /var/lib/webui-next-bff/sessions; writable persistent private store |
| SESSION_COOKIE_NAME | webui_next_sess |
| SESSION_MAX_AGE_MS | 2592000000 (30 days); rolling Secure/HttpOnly/SameSite=Lax cookie, not the UI idle countdown |
| REFRESH_SKEW_MS | 60000; token refresh window |
| OAUTH_STATE_MAX_AGE_MS | 600000; authorization attempt maximum age |
| PREAUTH_SESSION_MAX_AGE_MS | 600000; pre-auth cookie lifetime |
| LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX | 600000, 20; bounded pre-auth login starts |
| OAUTH_FETCH_TIMEOUT_MS, OAUTH_RESPONSE_MAX_BYTES | 10000, 65536; bounded provider requests/responses |

Do not assume arbitrary numeric overrides are validated: review units/ranges and
retest provider failures before changing them. The proxy trust is fixed at one
hop; the BFF must not be exposed directly as an Internet listener. Root BFF config
hardcodes basePath and endpoint paths: a subpath deployment needs integration work,
not only a VITE variable change.

## Persisted data and recovery boundaries

| Data | Location / lifetime | Recovery consequence |
| --- | --- | --- |
| BFF OAuth session | Private file store, access/refresh tokens and signed cookie identity; single process per store | Preserve on routine code rollback. Losing store or changing signing secret can log users out; restoring old sessions can restore stale/revoked tokens. Never copy a production store into tests. |
| Browser access token | Runtime memory in BFF mode; optional vpsadmin_ui_next.oauth2 in session/local storage for standalone | Valid BFF session response clears standalone residue. Do not export storage or raw session.json in bug reports. |
| Impersonation | vpsadmin.ui.impersonation in sessionStorage: full borrowed token, target/session IDs, reason and return path | Sensitive credential; overrides normal auth in that tab. Return attempts server close before clearing/reload, but close failure is tolerated. Browser tab/session restoration is not a revocation guarantee. |
| Idle activity | vpsadmin.idle.{sessionKey} in localStorage, non-credential fingerprint; tab-local without stable key | Trusted pointer/key/wheel/touch activity, not polling/focus, extends the deadline. API preferred_session_length supplies seconds; zero disables this timer. BFF cookie age and token expiry remain separate. |
| UI preferences | vpsadmin.uiSettings.v1 localStorage plus keyed API setting when authenticated/server enabled | Local settings are origin-level, not a secure per-user vault. Account settings load on authentication; anonymous layout uses local bootstrap. A new hostname does not carry old origin storage. |
| Pending/uncertain operations | User-scoped browser-local lock records and Web Locks where available | Clearing storage is not evidence an operation failed. Reconcile server receipt/object state first; preserve safe record of target/intent before recovery. |
| Domain objects and history | API/database/node services | Frontend/BFF rollback does not restore datasets, DNS, payments or users. API backup/restore belongs to backend operations. |
| Test traces/screenshots/logs | Ignored local outputs or CI artifact retention | Synthetic images may be published after inspection; authenticated traces may contain secrets/PII and need restricted retention. |

There is no documented automatic UI database migration in this product. Preference
schema normalization is in [uiSettingsModel](../../src/app/uiSettingsModel.ts);
locks have their own migration/uncertainty handling. Changing either requires old
stored-state cases, not an instruction to erase all browser data. Retention periods
and backup owners for private stores/evidence are handover decisions, not invented
service guarantees.

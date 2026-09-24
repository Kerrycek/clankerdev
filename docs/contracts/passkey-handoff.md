# WebAuthn registration on the authentication origin

The API restricts WebAuthn to `core.auth_url` (or `core.api_url`). Calling
`navigator.credentials.create()` on a separate UI origin produces a credential
that the API rejects with `WebAuthn::OriginVerificationError`.

The integrated BFF now exposes `/oauth/passkey`. It checks the requesting origin
and OAuth session, refreshes the token if necessary, and renders a script-free
HTML form. The user submits the access token in a hidden POST field to the
configured authorization origin's `/webauthn/registration/new`. The fixed return
URL is the UI origin's `/app/profile/mfa`. Request parameters cannot override
the token, destination, or return URL. Both configured origins must use HTTPS.

The handoff uses no-store/no-referrer, frame denial, and a CSP permitting form
submission only to that authorization origin. Each shipped nginx configuration
has an exact handoff location with local HSTS/Permissions-Policy headers, which
prevents inheritance of the default self-only CSP. All other locations retain
their existing policies. The BFF supplies the remaining security headers.
Deploy the matching BFF and nginx configuration together after review.

The UI exposes this flow only for the current user's OAuth profile with the BFF
capability present. Token sessions, including impersonation, cannot hand the
operator's underlying BFF session to registration. Return notices use fixed
localized copy and remove the provider query parameters; arbitrary provider
messages are never rendered. The credential list remains the source of truth.

The handoff is Czech/English and responsive. The existing API registration page
is English only. Physical authenticator behavior is outside fixture coverage.
BFF tests cover session/origin rejection, trusted destinations, escaping, and
security headers. Playwright UI tests cover cs/en desktop/mobile handoff and
safe returns with fixture API responses; they are not live WebAuthn evidence.

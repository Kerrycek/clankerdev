# WebAuthn registration origin mismatch

Confirmed on the isolated cluster with UI
`22cf991041d421fa60e13339fa41949a3643bdc9` and API
`486350466e8fb6f966add1cde3fa2bc12b4d6b62`. Service provenance was rechecked after
the probes. No shared deployment or real member data was used.

## Actual browser reproduction

A synthetic member (`test-user2@example.test`) signs in and opens Profile → MFA
on `frontend.clanker.example.test`. Chromium uses a CTAP2 virtual USB
authenticator with user verification and automatic presence. Clicking Add and
submitting a label invokes the real begin and finish API endpoints. Both HTTP
responses are 200, but finish fails at the application level and the UI shows
`HaveApiError: WebAuthn::OriginVerificationError`. A fresh API list is empty.
This is not a mocked WebAuthn/API response, nor a physical-key test.

The UI calls `navigator.credentials.create()` directly in
`UserWebauthnCredentialsPanel.tsx`. API `api/lib/vpsadmin/api.rb` configures
WebAuthn allowed origins to `core.auth_url` (falling back to `core.api_url`).
The new UI origin is different, so the credential is created for an origin the
server rejects. A successful fixture-only registration test would miss this.

## Existing compatible backend path

The same API already serves `/webauthn/registration/new` on the authentication
origin. Legacy PHP sends an HTML POST with `access_token` and `redirect_uri`.
The API explicitly rejects an access token supplied in a GET URL.

A separate contract probe submitted a browser form on the authentication
origin using the test session's token held only in memory. The real hosted
page created a virtual-authenticator credential and returned to the fixed
profile URL with `registerStatus=1`. A fresh API read confirmed the single
fixture credential; the new UI then deleted it and a further read confirmed
an empty list. No key material or token was saved.

This proves the hosted backend contract, **not** an implemented product fix or
a completed WebAuthn login test. The probe supplied the handoff itself, which
the current product does not yet provide. The hosted page is currently English.

Evidence: `live-webauthn/webauthn-probe.json`, `webauthn-hosted-probe.json`, logs,
and the two diagnostic scripts in the local beta evidence bundle.

## Required product follow-up

- Use the existing authentication-origin registration page. Do not broaden the
  backend origin/RP configuration merely to make the failing test pass.
- Prefer a same-origin BFF entry point using the authenticated server session.
  POST the access token only to the configured authentication origin; never put
  it in navigation URLs, return parameters, logs or persistent browser storage.
- Fix the return target to the member profile MFA route. Do not accept an
  arbitrary destination from a query parameter. Escape HTML field values and
  use no-store/no-referrer/frame restrictions for the handoff document.
- Account for deployment CSP: current nginx configurations have
  `form-action 'self'`, which would block a direct frontend form POST. A narrowly
  scoped handoff policy must permit only the configured authentication origin;
  retain the default policy elsewhere and test the effective proxy headers.
- Handle success, cancellation and failure on return without rendering provider
  messages as HTML. Preserve cs/en labels and mobile usability; document the
  hosted provider's current language limitation.
- Test BFF authentication/origin checks, malicious destinations/escaping/token
  secrecy, and actual enrollment, return, login and cleanup on the pinned VM.
  A browser virtual authenticator proves integration, not physical hardware.

The beta WebAuthn gate remains open. This correction can use the existing API;
it is separate from the pending upstream cursor proposals and does not require
an upstream PR just to add another allowed origin.

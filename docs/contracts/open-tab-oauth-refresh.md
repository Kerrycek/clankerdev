# OAuth rotation in an already-open tab

## Reproduction against the isolated API

UI `4a3ea18b1870a86ab47c48e4a3ffa45c37248d0c`, API
`486350466e8fb6f966add1cde3fa2bc12b4d6b62`, dedicated synthetic member.
With the dedicated client temporarily configured for 75-second fixed access
and 180-second refresh tokens, open one authenticated tab, wait 20 seconds,
then open a second tab sharing its cookie. The second bootstrap renews the
token. The first token returns 401 while the replacement returns 200. The
first SPA reacts to a rejected read by reloading the document, losing its
in-memory marker. This is separate from concurrent BFF exchanges in #500.
Client settings were restored and logout revoked the replacement.

## Contract

`session.json` includes a non-credential, HMAC fingerprint of the BFF session
id with a distinct domain prefix. It stays constant during refresh and changes
on OAuth login/session regeneration. The signed session cookie is never exposed.
Anonymous sessions receive null. Existing runtime bootstrap registers the
same-origin endpoint, fingerprint and token only in memory.

After an HTTP 401 from GET/OPTIONS, the client makes one shared, ten-second
bounded lookup. Only a different token for the exact original BFF session can
replace the in-memory token. The original read is retried once, preserving its
parameters and cancellation signal. Rejected recovery follows normal expiry.
Different logins cannot silently keep the old account's query cache.

No replay of POST/PUT/PATCH/DELETE, 403, transport failures, or ambiguous
HaveAPI envelopes. No refresh polling, cross-tab token broadcasting or
persistent browser credentials. Standalone OAuth, HaveAPI tokens,
impersonation and older BFFs retain their prior behavior. A mutation that is
itself the first request after rotation retains the existing expiry handling;
this change does not claim continuous renewal or form preservation in that case.
Use with #500 in the integrated candidate to serialize BFF refresh/store writes.

## Validation

Unit coverage exercises actual bootstrap registration, overlapping failed
reads, fingerprint/account changes, anonymous/invalid/failing replies, one-retry
limit, cancellation, local logout, legacy BFF and no write replay. Real BFF
HTTP tests check stable/read-only fingerprints and distinct OAuth logins.
Actual post-fix VM evidence is recorded in the release checklist when complete.

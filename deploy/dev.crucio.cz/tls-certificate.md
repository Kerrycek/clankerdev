# `dev.crucio.cz` TLS certificate

## Current finding (2026-09-19)

The nginx virtual host for `dev.crucio.cz` currently references Debian's local
snakeoil certificate:

```text
ssl_certificate     /etc/ssl/certs/ssl-cert-snakeoil.pem;
ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
```

The public certificate is self-signed for the machine hostname, not for the
WebUI hostname:

| Field | Observed value |
| --- | --- |
| Subject / issuer | `CN=kerrykdev.dev.kerrycze.net` |
| SAN | `DNS:kerrykdev.dev.kerrycze.net` |
| SHA-256 fingerprint | `6E:DE:D8:33:8F:57:4C:B7:16:9B:C6:6A:51:DC:A3:34:33:8B:2C:CA:8E:68:65:0B:F3:1A:2A:A3:67:83:65:8F` |
| Validity | 2026-03-17 14:43:33 UTC to 2036-03-14 14:43:33 UTC |

An SNI handshake for `dev.crucio.cz` returns that same leaf. A strict client
rejects it with `ERR_TLS_CERT_ALTNAME_INVALID` because neither the SAN nor CN
covers `dev.crucio.cz`. The long validity period does not make the identity or
trust valid.

The code-owned leaf/SPKI pin used by the destructive live VPS certification is
a narrowly contained test transport exception. It proves that the expected
insecure leaf was reached before a token is attached; it does **not** make the
certificate valid for browsers or replace normal PKI verification.

## Read-only preflight

Run the strict audit from a host that resolves and can reach `dev.crucio.cz`:

```sh
npm run audit:dev-tls
```

The audit performs only a TLS handshake. It sends no HTTP request, cookie or
authorization header and returns non-zero unless all of these are true:

- the certificate SAN/CN covers `dev.crucio.cz`;
- the platform TLS verifier accepts the chain;
- the certificate is currently within its validity window.

Use `npm run audit:dev-tls -- --json` for a machine-readable report. Do not add
an insecure override to this audit: the existing deployment parity and auth
smoke tools already have explicitly scoped exceptions for observing the known
legacy deployment.

## Remediation boundary and rollout

The repository cannot safely issue a certificate or choose a private-key
source. A server operator must first provision a trusted internal certificate
or a publicly trusted DNS-validated certificate with `dev.crucio.cz` in its
SAN. Private key material must stay off the repository.

After the certificate and key exist on the host:

1. update the reviewed nginx configuration to their final paths;
2. run `nginx -t` before reloading nginx;
3. reload nginx and run `npm run audit:dev-tls` without an insecure flag;
4. run the deployment parity audit without
   `--allow-invalid-candidate-cert` and the auth smoke without `--insecure`;
5. deliberately update or remove the live VPS certification pin only after the
   new leaf and trust state have been independently reviewed.

Do not change the tracked nginx paths before the provisioned files exist. That
would turn a certificate defect into a failed nginx reload or an outage.

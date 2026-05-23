# Dedicated host deployment at root (static SPA + OAuth2)

This guide describes how to run **WebUI Next as the primary UI on its own host**,
directly at the root (no `/ui-next` sub-path), e.g.:

- `https://clankerdev.vpsfree.cz/`

There is **no backend gateway** in this setup:

- the SPA performs OAuth2 login **in the browser**
- the SPA calls the vpsAdmin HaveAPI **directly**

---

## 1) DNS + TLS

1) Create `A/AAAA` records for the new hostname.
2) Issue a TLS certificate (Let’s Encrypt).

---

## 2) OAuth2 client registration

You need an OAuth2 client registration in the vpsFree authorization server.

Recommended values:

- **client_id**: same as hostname (example: `clankerdev.vpsfree.cz`)
- **redirect URI**: `https://clankerdev.vpsfree.cz/oauth/callback`
- **scope**: `all` (the web UI needs full access)

The SPA starts login at `/oauth/login` and expects the auth server to redirect back to `/oauth/callback`.

---

## 3) CORS allowlists

Because this is a pure SPA, the browser needs CORS to be enabled for two things:

1) **OAuth2 token endpoint** (code → access token exchange)
   - allow origin: `https://clankerdev.vpsfree.cz`
   - allow method: `POST`
   - allow headers: `Content-Type`, `Accept`

2) **HaveAPI** (all API calls)
   - allow origin: `https://clankerdev.vpsfree.cz`
   - allow the HaveAPI auth header used for OAuth2

WebUI Next automatically loads the HaveAPI description from the API and uses
`description.authentication.oauth2.http_header` to determine the correct header name.

---

## 4) Build + deploy

Build:

```bash
cd webui-next
npm install
npm run build
```

Deploy `dist/` to your web root.

---

## 5) Web server config (SPA history fallback)

### Nginx example

```nginx
server {
  server_name clankerdev.vpsfree.cz;

  # TLS config omitted

  root /var/www/webui-next/dist;

  # Static assets + SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

No special endpoints (`/config.js.php`, `/login`, `/logout`) are needed.

---

## 6) Optional build-time config

Defaults are already tuned for vpsFree:

- API: `https://api.vpsfree.cz` + version `7.0`
- OAuth2 authorize URL: `https://auth.vpsfree.cz/_auth/oauth2/authorize`
- OAuth2 token URL: `https://auth.vpsfree.cz/_auth/oauth2/token`
- `client_id`: current hostname
- redirect path: `/oauth/callback`

If you need overrides, use env vars at build time:

```bash
VITE_API_URL=https://api.vpsfree.cz \
VITE_API_VERSION=7.0 \
VITE_OAUTH2_CLIENT_ID=clankerdev.vpsfree.cz \
npm run build
```

---

## Troubleshooting

- **OAuth callback shows “state mismatch”**
  - Ensure the browser keeps `sessionStorage` (no privacy mode quirks)
  - Ensure you’re not bouncing between `http` and `https` or multiple hostnames

- **Token request fails (CORS / network error)**
  - Ensure the auth server’s token endpoint allows CORS from the SPA origin

- **API calls fail (CORS / missing header)**
  - Ensure the HaveAPI server allows the SPA origin
  - Ensure it allows the OAuth2 HaveAPI auth header (from the API description)

# Proper dev deployment (sub-path, static SPA + OAuth2)

This guide describes a **production-like** way to develop and test WebUI Next when you
want it mounted under a sub-path (e.g. `/ui-next/`).

Key points:

- WebUI Next can be served as a **pure static SPA**
- the SPA performs OAuth2 login **in the browser** (`/oauth/login` → `/oauth/callback`)
- the SPA calls HaveAPI **directly**

If you mount WebUI Next under a sub-path, the OAuth2 redirect URI must include that path.

---

## Example target

- WebUI Next: `https://vpsadmin-dev.intra/ui-next/`
- Login start route: `https://vpsadmin-dev.intra/ui-next/oauth/login`
- OAuth2 redirect URI: `https://vpsadmin-dev.intra/ui-next/oauth/callback`

---

## Step 1: pick a mount path and configure router basename

Pick a path, e.g. `/ui-next`.

You need this at build time:

```bash
VITE_ROUTER_BASENAME=/ui-next npm run build
```

This ensures assets are referenced as `/ui-next/assets/...` so they work on deep routes like
`/ui-next/app/vps/123`.

---

## Step 2: build the SPA and deploy `dist/`

```bash
cd webui-next
npm install
VITE_ROUTER_BASENAME=/ui-next npm run build
```

Deploy the resulting `dist/` so it is served from `/ui-next/`.

---

## Step 3: web server config (SPA “history fallback”)

You must configure a history fallback for the mount path:

- serve real files if they exist (`assets/…`)
- otherwise serve `/ui-next/index.html`

### Nginx example

```nginx
location /ui-next/ {
  root /var/www/vpsadmin;
  try_files $uri $uri/ /ui-next/index.html;
}
```

---

## Step 4: OAuth2 client registration

Register (or update) an OAuth2 client for your dev hostname.

Minimum:

- **client_id**: usually the hostname
- **redirect URI**: `https://vpsadmin-dev.intra/ui-next/oauth/callback`
- **scope**: `all`

---

## Step 5: CORS allowlists

### Best case: API is same-origin

If the API is served from the same origin (reverse proxy), CORS is not involved.

### If API is on a different host

Then you must allow the SPA origin in CORS on:

1) OAuth2 token endpoint (`POST`)
2) HaveAPI (all calls) + allow the OAuth2 HaveAPI auth header

WebUI Next fetches the HaveAPI description at runtime and uses
`description.authentication.oauth2.http_header` as the header name.

---

## Troubleshooting

- **Reloading `/ui-next/app/...` yields 404**
  - server is missing SPA fallback (`try_files ... /ui-next/index.html`)

- **OAuth callback shows “state mismatch”**
  - ensure you’re not mixing hostnames / http↔https
  - ensure the browser keeps `sessionStorage`

- **Token request fails (CORS)**
  - enable CORS on the auth server token endpoint for your dev origin

- **API calls fail (CORS / missing header)**
  - allow origin + allow the HaveAPI OAuth2 auth header

# Internal network development guide (OAuth2)

This doc is for the common setup where:

- you want to run WebUI Next on an **internal hostname** (internal DNS), e.g. `webui-next.dev.intra`
- your HaveAPI endpoint is also internal, e.g. `https://api.intra.example`

WebUI Next implements **OAuth2 login in the browser**, so authenticated development on an
internal hostname requires OAuth2 redirect configuration.

If your goal is a production-like dedicated host, see **DEV_DEPLOYMENT_NEW_HOST.md**.

---

## The hard requirement: OAuth2 redirect URIs

To use authenticated pages (`/app`, `/admin`), you must have an OAuth2 client that allows:

- redirect URI: `https://<your-host><basename>/oauth/callback`

Example for root deployment:

- `https://webui-next.dev.intra/oauth/callback`

Example for sub-path deployment:

- `https://webui-next.dev.intra/ui-next/oauth/callback`

If you cannot register your internal hostname in the OAuth server, your options are:

1) develop only public pages (no login required), or
2) use a hostname that *is* registered (e.g. a dedicated dev host), or
3) place your dev build behind a reverse proxy on a registered hostname.

---

## Optional: avoid API CORS with the Vite proxy

Even with OAuth2, you may still want to avoid CORS to your internal API during development.
You can proxy HaveAPI through the Vite dev server:

In `.env.local`:

```bash
# browser calls same-origin /api/v7.0/...
VITE_API_URL=/api
VITE_API_VERSION=7.0

# Vite proxies /api -> your real API
VITE_API_PROXY_TARGET=https://api.intra.example

# expose the dev server on the network
VITE_DEV_HOST=0.0.0.0
```

Then:

```bash
npm run dev
```

Note: this only addresses HaveAPI CORS. OAuth2 still needs a valid redirect URI.

---

## Optional: HTTPS for internal hostnames

If you need HTTPS locally (secure cookies, corporate policies), you can run Vite with HTTPS.

1) Create a certificate for your internal hostname.
2) Point Vite at the cert/key:

```bash
VITE_DEV_HTTPS=true
VITE_DEV_HTTPS_KEY=./certs/dev.key
VITE_DEV_HTTPS_CERT=./certs/dev.crt
```

---

## Sub-path deployments (router basename)

If you serve WebUI Next under a sub-path like `https://webui-next.dev.intra/ui-next/`, set:

```bash
VITE_ROUTER_BASENAME=/ui-next
```

This also affects the default OAuth2 redirect path (`/ui-next/oauth/callback`).

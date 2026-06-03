# kra.crucio.cz origin API preview

`kra.crucio.cz` is an origin-API preview host for WebUI Next. It serves the
same built frontend as `dev.crucio.cz`, but its runtime `/config.js` points the
SPA at the original vpsFree API and OAuth endpoints.

## Intended shape

- Static files: shared with the current dev deployment.
  - Current test host path: `/var/www/dev.crucio.cz/current`
- BFF: separate systemd service and environment from `dev.crucio.cz`.
  - Service: `webui-next-bff-kra.service`
  - Port: `127.0.0.1:3002`
  - Env file: `/etc/webui-next/kra.oauth.env`
- API: `https://api.vpsfree.cz`
- OAuth authorize/token/revoke: `https://auth.vpsfree.cz/_auth/oauth2/*`

This keeps `dev.crucio.cz` on the local test API while allowing
`kra.crucio.cz` to display real/original data.

## Important warnings

`kra.crucio.cz` talks to the original API. Actions can affect real data if the
authenticated account has permissions to perform them. Keep this host clearly
distinguishable from the local test deployment.

The OAuth redirect URI must be accepted by the OAuth client registration. If
login reaches the authorization page but the callback/token exchange fails,
register or allow:

```text
https://kra.crucio.cz/oauth/callback
```

for the configured OAuth client.

## Install outline

1. Copy `oauth.env.example` to `/etc/webui-next/kra.oauth.env`.
2. Fill in `OAUTH_CLIENT_SECRET` and `SESSION_SECRET`.
3. Install `webui-next-bff-kra.service` to `/etc/systemd/system/`.
4. Install `nginx-kra.crucio.cz.conf` to `/etc/nginx/sites-available/kra.crucio.cz`.
5. Enable the nginx site and reload nginx.
6. Start the BFF:

```sh
systemctl daemon-reload
systemctl enable --now webui-next-bff-kra.service
nginx -t && systemctl reload nginx
```

## Quick checks

```sh
curl -fsS http://127.0.0.1:3002/healthz
curl -fsS http://127.0.0.1:3002/config.js
curl -kfsS -H 'Host: kra.crucio.cz' https://127.0.0.1/config.js
curl -kI -H 'Host: kra.crucio.cz' https://127.0.0.1/
```


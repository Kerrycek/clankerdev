# dev.crucio.cz deployment

`dev.crucio.cz` serves the static web UI from:

```sh
/var/www/dev.crucio.cz/current
```

`dev.crucio.cz` is hosted on the same private test machine as
`admin.crucio.cz` (`172.16.106.176`). Its nginx vhost mirrors the
`clankerdev.vpsfree.cz` layout: static assets are served by nginx, while
`/config.js`, `/oauth/*`, and `/healthz` are served by the WebUI Next BFF on
`127.0.0.1:3001`.

Unlike the original production deployment, `dev.crucio.cz` keeps API and OAuth
traffic on the test stack. nginx proxies `/v7.0` and `/_auth` directly to the
same local API process used by `admin.crucio.cz`, on `127.0.0.1:9292`.

Deploy static files from the original UI VPS with:

```sh
rsync -az --delete \
  root@37.205.15.4:/var/www/clankerdev.vpsfree.cz/current/ \
  root@admin.crucio.cz:/var/www/dev.crucio.cz/current/
```

Deploy nginx and BFF units with:

```sh
rsync -az deploy/dev.crucio.cz/webui-next-bff.service \
  root@admin.crucio.cz:/etc/systemd/system/webui-next-bff.service

rsync -az deploy/dev.crucio.cz/nginx-dev.crucio.cz.conf \
  root@admin.crucio.cz:/etc/nginx/sites-available/dev.crucio.cz
```

The `/v7.0` proxy strips `WWW-Authenticate` from unauthenticated API responses.
The API still returns `401`, but browsers do not show a native Basic Auth prompt.

The BFF environment lives on the server in:

```sh
/etc/webui-next/oauth.env
```

Use `oauth.env.example` as the shape of that file. Do not commit the real OAuth
client secret or session secret.

The BFF code is copied from the original WebUI Next release into:

```sh
/opt/webui-next/releases/20260314-172752/vpsadmin/webui-next/bff
```

`dev.crucio.cz` currently uses the local Debian snakeoil certificate because
the hostname resolves to a private address. Replace it with a trusted internal
or DNS-validated certificate when one is available.

The test API on `admin.crucio.cz` also needs the patch in
`../admin.crucio.cz/vpsadmin-api-user-session-label.patch`. Without it, OAuth
session creation can fail with HTTP 500 when the upstream request does not carry
a user-agent label.

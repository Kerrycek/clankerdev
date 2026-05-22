# dev.crucio.cz deployment

`dev.crucio.cz` serves the static web UI from:

```sh
/var/www/dev.crucio.cz/current
```

The public Apache server proxies the test API and OAuth endpoints to
`admin.crucio.cz`, which proxies `/v7.0` to the local API process on
`127.0.0.1:9292`.

Deploy static files from the repo root with:

```sh
rsync -az --delete \
  --exclude .git \
  --exclude deploy \
  ./ root@37.205.10.80:/var/www/dev.crucio.cz/current/

rsync -az deploy/dev.crucio.cz/config.js \
  root@37.205.10.80:/var/www/dev.crucio.cz/current/config.js
```

The `/v7.0` proxy strips `WWW-Authenticate` from unauthenticated API responses.
The API still returns `401`, but browsers do not show a native Basic Auth prompt.

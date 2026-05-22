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

rsync -az deploy/dev.crucio.cz/_oauth2_token_proxy.php \
  root@37.205.10.80:/var/www/dev.crucio.cz/current/_oauth2_token_proxy.php
```

The `/v7.0` proxy strips `WWW-Authenticate` from unauthenticated API responses.
The API still returns `401`, but browsers do not show a native Basic Auth prompt.

The OAuth2 token endpoint is handled by `_oauth2_token_proxy.php`, because the
test backend requires a confidential-client secret for the authorization-code
exchange. The secret must live on the server in:

```sh
/etc/dev.crucio.cz/oauth2-token-proxy.php
```

Use `oauth2-token-proxy.example.php` as the shape of that file. Do not commit
the real secret.

# Source Import

This repository originally contained only the deployed Vite build from
`clankerdev.vpsfree.cz`.

The WebUI Next source tree was imported from:

```text
root@37.205.15.4:/opt/webui-next/releases/20260314-172752/vpsadmin/webui-next
```

That release produced the currently deployed build:

```text
/var/www/clankerdev.vpsfree.cz/current
```

The source release's `dist/index.html` matched the deployed
`/var/www/clankerdev.vpsfree.cz/current/index.html` by SHA-256 at import time.

Generated build output is intentionally not tracked. Use:

```sh
npm ci
npm run build
```

and deploy the generated `dist/` directory through the documented dev deploy
workflow.

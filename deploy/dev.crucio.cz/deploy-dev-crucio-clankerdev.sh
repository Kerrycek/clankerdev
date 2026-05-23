#!/usr/bin/env bash
set -euo pipefail

src="${1:-/srv/clankerdev-deploy/repo}"
dst="/var/www/dev.crucio.cz/current"

if [[ ! -d "$src/.git" ]]; then
  echo "Source is not a git checkout: $src" >&2
  exit 2
fi

if [[ "$dst" != /var/www/dev.crucio.cz/current ]]; then
  echo "Refusing unexpected destination: $dst" >&2
  exit 2
fi

cd "$src"

npm ci
npm run build

if [[ -f bff/package-lock.json ]]; then
  npm --prefix bff ci --omit=dev
else
  npm --prefix bff install --omit=dev
fi

install -d -m 0755 "$dst"
rsync -a --delete dist/ "$dst"/

systemctl daemon-reload
systemctl restart webui-next-bff.service

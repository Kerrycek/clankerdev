#!/usr/bin/env bash
set -euo pipefail

repo="/srv/clankerdev-deploy/repo"

cd "$repo"
echo "Updating dev.crucio.cz from $(git config --get remote.origin.url)"
echo "Current: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"

git fetch origin main
git pull --ff-only origin main

/usr/local/bin/deploy-dev-crucio-clankerdev "$repo"

echo "Deployed: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"

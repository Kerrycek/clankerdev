# clankerdev.vpsfree.cz – Change Log

Imported from `/root/FIXES.md` on `clankerdev.vpsfree.cz` (2026-01-24) and lightly tidied (removed an accidental duplicate block).

## Template (for new entries)
- Date (UTC/CET): YYYY-MM-DD
- Scope: files/paths touched
- Change: what was done (be specific)
- Why: bug/req/context
- Commands: key commands run
- Notes/Follow-up: tests, manual checks, open items

## Entries

### 2026-01-24 (later)
- **Scope:** `/opt/webui-next/current-release/vpsadmin/webui-next/bff/server.js`
- **Change:** Add `haveApi.authHeader: 'X-HaveAPI-OAuth2-Token'` to the `/config.js` payload so the SPA uses a CORS-allowed HaveAPI header.
- **Why:** Browser login loop showing “Sign in required / NetworkError when attempting to fetch resource” was caused by CORS preflight failure when the SPA used the `Authorization` header.
- **Commands:** Edited `bff/server.js` and ran `systemctl restart webui-next-bff`.
- **Notes:** Keep this header if touching BFF; without it the SPA will fail on HaveAPI calls due to CORS.

### 2026-01-24
- **Scope:** `/opt/webui-next/releases/20260124-042219/...`, `/etc/nginx/sites-available/clankerdev.vpsfree.cz.conf`, `/var/www/clankerdev.vpsfree.cz/current`, `/etc/letsencrypt/*`, `/etc/webui-next/oauth.env`
- **Change:**
  - Deployed tarball `vpsadmin_ui_next_public_v0.6.0_clankerdev_bff_oauth_ready_publicnpm.tar.gz` via `deploy-clankerdev-full.sh`.
  - Patched/npm-installed using public registry; built SPA; rsynced `dist/` to webroot.
  - Installed BFF deps; restarted `webui-next-bff` (running).
  - Installed certbot via apt (snap unusable), issued LE cert, enabled HTTPS vhost with redirect.
  - Added renewal hook to reload nginx on cert renewal.
- **Why:** Initial deployment failed to serve the app over HTTPS; needed working TLS and correct build using fixed tarball.
- **Commands (high level):**
  - `bash /root/deploy-clankerdev-full.sh /root/vpsadmin_ui_next_public_v0.6.0_clankerdev_bff_oauth_ready_publicnpm.tar.gz snajpa@snajpa.net`
  - `apt-get install -y certbot python3-certbot-nginx`
  - `certbot certonly --webroot -w /var/www/clankerdev.vpsfree.cz/current -d clankerdev.vpsfree.cz -m snajpa@snajpa.net --agree-tos --non-interactive`
  - `systemctl reload nginx`
- **Notes/Follow-up:** Default nginx site file still present but the hostname-specific vhost should take precedence. OAuth client secret stored in `/etc/webui-next/oauth.env` on the server. Confirmed `/healthz` and `/config.js` over HTTPS.

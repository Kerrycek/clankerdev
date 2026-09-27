# Heatmap and favicon release

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

Related records: [heatmap actions](2026-09-27-heatmap-icons.md),
[legacy favicon](2026-09-27-legacy-favicon.md),
[design handbook](2026-09-27-design-handbook.md).

## 2026-09-27 - Approved heatmap and favicon release

**Authorization:** the maintainer approved PR521, PR523 and PR524 for merge and
release. PR522 is explicitly held for visual review; PR496/507/509 and backend44
remain excluded. The proposed webui.vpsfree.cz alias was canceled before changes.
Scheduled autonomous development remains paused.

**Runtime release:** PR521 and PR524 were merged after their exact-head CI passed.
Both dev.crucio.cz and clankerdev.vpsfree.cz now serve frontend and matching BFF
`92f968960bec47d19eca78b47db219969fecc3ed`. The public host uses the exact dev-built
frontend artifact. Sidebar, backend/API configuration and secrets are unchanged.
Documentation PR523 is tracked separately and requires no runtime redeployment.

**Verification:** the integrated approved candidate passed 1,514 unit, 135 script
and 36 BFF tests, typecheck, lint, translation/CSP/documentation audits and build;
16 targeted desktop/mobile cs/en heatmap fixture cases passed. Favicon PR CI
passed 378 desktop + 303 mobile cases. After deployment, 22 fixture browser cases
passed on each host (44 total). Eight actual anonymous browser scenarios covered
both hosts, cs/en and desktop/mobile: favicon bytes match the legacy image,
root/deep routes resolve the icon, provenance matches and no page errors occurred.
Public clankerdev node actions contain only icons with accessible labels/tooltips;
the dev public API did not expose heatmap actions, so its action behavior is covered
by fixture evidence. Health, anonymous session and authentication endpoints passed.
No private API mutation or real VPS lifecycle action was used for these checks.

**Rollback:** matching previous release `fd290b5ec1b22900e704e8cb990c5ba050af2394`
is retained on both hosts together with private webroot/config snapshots. Restore
that matching frontend/BFF pair and recheck provenance/auth/health if needed.
Detailed scripts and receipts remain operator-held; see the handover limitations
in [Operations](../../docs/design/OPERATIONS.md).

**Status / next:** runtime release complete. Documentation PR523 passed all
378 desktop + 303 mobile CI cases and was merged as
`7e97d2919f908b175b6f8bc5b7ff899f1f59cec4`. Its changes are documentation and
development audits only; runtime source is identical to deployed `92f96896`,
so no second runtime deployment was needed. Retain the explicit PR522 review
hold and the excluded cursor/backend work. This follow-up receipt is maintained
on a separate documentation branch for the next reviewed documentation update.

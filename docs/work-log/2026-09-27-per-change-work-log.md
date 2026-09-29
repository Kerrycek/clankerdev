# Work-log files per change

## 2026-09-27 — Split the shared log

**Request / reason:** the maintainer accepted reviewer feedback that editing one
shared WORK_LOG.md in every feature/PR creates avoidable conflicts and scales
poorly to parallel contributors. A feature spanning several PRs also needs one
coherent history rather than unrelated release notes scattered across PRs.

**Change / decision:** REQ-064 now uses one dated, descriptive Markdown file per
feature/change in this directory. Related corrections and releases append to that
file; multi-feature releases can have separate records linking feature histories.
The directory is the index, with no shared entry list to update per PR. The root
WORK_LOG.md remains only a stable compatibility pointer. Migration groups all
13 previously published dated entries into eight topic/release files and includes
the already verified PR526 release receipt from local commit `c3a79f35`. Historical
wording and evidence are retained, ordered from initial work to later follow-ups.

Update AGENTS.md, current documentation entry points, maintenance/release guidance
and the design audit. The audit discovers each work-log file automatically and
checks its local links without requiring it to be listed in the README.

**Verification:** eight focused documentation tests passed, including discovery
of independent records without editing an index and rejection of broken evidence
links. Design and active-doc audits passed (27 documents, 67 requirements; route
and adapter inventory unchanged). Migration completeness and whitespace checks
passed. No runtime behavior is changed.

**Status:** prepared for review; not merged. No runtime deployment is needed.

**Next / limitations:** contributors to the same feature still coordinate edits
to that feature's file. Existing open branches must move their new log entries to
an appropriate change file when rebasing. General autonomous development remains
paused; this migration does not authorize merging or deployment.

## 2026-09-27 — Approved merge and deployment

The maintainer explicitly approved merging, testing and deploying
[PR527](https://github.com/Kerrycek/clankerdev/pull/527). Both CI workflows passed
on `4fbeb51e`: [static checks](https://github.com/Kerrycek/clankerdev/actions/runs/36342559547)
(150 script, 36 BFF and 1,514 unit tests) and
[browser checks](https://github.com/Kerrycek/clankerdev/actions/runs/36342559546)
(378 desktop + 303 mobile fixture cases).

Merged as `156a7c043e543b5f4a51fc962d16e31bd6eaa00f`; the tree matches the tested
head. Although no UI behavior changed, the maintainer requested deployment, so
both dev.crucio.cz and clankerdev.vpsfree.cz now serve this release with matching
frontend/BFF provenance. The dev-built frontend was promoted unchanged.
Post-deploy health, auth and anonymous-session checks passed; eight real anonymous
browser cases passed across both hosts, cs/en and desktop/mobile, with matching
favicon bytes and no page errors. These checks did not mutate real user data.

The previous `e7ce3d73` release and private rollback backups are retained on both
hosts. No API/database changes; foreign checkout files were preserved. General
autonomous development remains paused. Detailed deployment logs and receipts are
operator-held. This follow-up was retained locally after the release and is incorporated by
the 2026-09-29 documentation handover update; it does not require another runtime
deployment.

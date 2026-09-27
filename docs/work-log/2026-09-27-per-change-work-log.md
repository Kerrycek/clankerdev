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

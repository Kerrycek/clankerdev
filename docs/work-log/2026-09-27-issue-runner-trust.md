# Issue runner author policy

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

## 2026-09-27 - Restrict issue-to-PR runner to trusted work

**Request:** inspect the dev issue runner and restrict automatic token use to
Kerrycek and vpsfreecz members; other authors require human approval (REQ-067).

**Finding:** the timer is enabled and polls approximately every 15 minutes. Recent
runs succeeded with an empty ai-fix queue; GitHub and Codex authentication are
available. No new model invocation was made for diagnosis. The installed runner
had a new-issues-first selection patch absent from Git; preserve it.

**Change:** authorize before any GitHub write, worktree reset or model call.
Check explicit logins and active organization membership; outsiders need a
repository writer's approval of the exact issue-content digest. Filter untrusted
PR feedback and ignore it in revision hashes. API uncertainty fails closed.
Add a read-only dry run, install/rollback instructions and policy/shell regressions.

**Verification:** 11 focused policy/shell cases passed locally and on the dev
Linux host. All 146 script tests, lint and design/active-doc audits passed locally.
A real read-only queue check passed on the host with no queued issues, no model
call and no GitHub writes.

**Installed outcome:** the requested restriction is installed on the idle dev
runner from commit `bb77a618`, under its existing lock. Private backups retain the
old script/environment; the timer remains enabled and active. Post-install dry
run passed, and real API checks confirmed organization visibility and approval
permission. No live model invocation or end-to-end PR creation was triggered.
The repository change is prepared for review; it has not been merged.
## 2026-09-27 - PR526 merged; installed runner matches release

The maintainer explicitly approved merging and deploying
[PR526](https://github.com/Kerrycek/clankerdev/pull/526). Both required checks
passed on `43633dff`: static/unit CI
[36336123105](https://github.com/Kerrycek/clankerdev/actions/runs/36336123105)
and browser CI
[36336123154](https://github.com/Kerrycek/clankerdev/actions/runs/36336123154).
The merge commit is `cc0d274873e6adfbfb266781582f06e3ae644a45`; its tree matches
the tested head. Under the runner lock, both installed executable/helper hashes
were verified against this release. They already matched, so no replacement or
service interruption was necessary. The timer remains enabled and active,
with Kerrycek and active vpsfreecz members trusted. A post-merge read-only queue
check passed without invoking Codex or writing to GitHub. Original private
backups remain available. No frontend, API or database deployment was needed
for this runner-only change. General autonomous development remains paused.
Detailed deployment receipts are retained in the operator's local evidence.

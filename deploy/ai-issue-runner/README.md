# Clankerdev AI Issue Runner

This runner polls GitHub issues labeled `ai-fix`, runs Codex CLI against the
issue, and opens a pull request for human review. If a PR already exists for an
issue branch, the runner reads new issue comments, PR comments, reviews, and
inline review comments, then pushes a revision to the same PR.

It does not deploy, merge, or modify servers.

## Server Setup

Install dependencies:

```sh
apt-get update
apt-get install -y gh jq git nodejs
```

Install files:

```sh
install -d -m 0755 /usr/local/lib/clankerdev-ai
install -m 0644 deploy/ai-issue-runner/issue-policy.mjs \
  /usr/local/lib/clankerdev-ai/issue-policy.mjs

install -m 0755 deploy/ai-issue-runner/clankerdev-ai-issue-runner.sh \
  /usr/local/bin/clankerdev-ai-issue-runner

install -m 0644 deploy/ai-issue-runner/clankerdev-ai-issue-runner.service \
  /etc/systemd/system/clankerdev-ai-issue-runner.service

install -m 0644 deploy/ai-issue-runner/clankerdev-ai-issue-runner.timer \
  /etc/systemd/system/clankerdev-ai-issue-runner.timer

install -d -m 0755 /etc/clankerdev-ai
install -m 0644 deploy/ai-issue-runner/runner.env.example \
  /etc/clankerdev-ai/runner.env
```

Authenticate tools as the service user:

```sh
codex doctor
gh auth login
ssh -T git@github.com
```

Enable the timer:

```sh
systemctl daemon-reload
systemctl enable --now clankerdev-ai-issue-runner.timer
```

Manual run:

```sh
systemctl start clankerdev-ai-issue-runner.service
journalctl -u clankerdev-ai-issue-runner.service -n 200 --no-pager
```

## Workflow

1. Create a GitHub issue.
2. Add label `ai-fix`.
3. The trust/approval policy below must authorize the current issue.
4. The runner creates an `ai/issue-*` branch, or reuses the existing branch if a
   PR is already open.
5. Codex edits the repository locally.
6. The runner commits, pushes, and opens or updates a PR.
7. A human reviews and merges.

The label `ai-pr` means an AI pull request exists. It does not stop the runner
from reacting to later review feedback. To avoid loops, the runner stores a hash
of the last issue/PR review context it handled and skips unchanged feedback.

## Trust and explicit approval

Only issues carrying `ai-fix` are candidates. New issues retain priority over
existing AI PRs; unauthorized candidates are skipped, not executed. At most the
first 100 labeled issues are inspected per poll and one authorized issue is run.

- `TRUSTED_USERS`: exact GitHub logins, case insensitive (approved: `Kerrycek`).
- `TRUSTED_ORGS`: organizations whose **active** members may submit work
  (approved: `vpsfreecz`). Membership is checked using the runner's GitHub identity
  on each poll and cached only within that policy invocation.
- Empty trust lists authorize no authors automatically. Unknown authors, missing
  membership visibility, network errors and denied API requests never grant trust.
- GitHub `author_association`, issue wording, display names and labels alone do
  not establish trust. The organization is configured explicitly because this
  repository belongs to a personal account.

For other authors, a repository writer/maintainer/admin must inspect the issue
and approve the exact current snapshot with an issue comment:

```text
/ai approve <64-character hash printed by the policy check>
```

Obtain the hash without invoking Codex or editing GitHub:

```sh
set -a
. /etc/clankerdev-ai/runner.env
set +a
RUNNER_DRY_RUN=1 /usr/local/bin/clankerdev-ai-issue-runner
```

The digest binds the repository, issue number, author, title, body and external
issue comments. Edits or new external comments invalidate approval. Approval
comments themselves are excluded from model context and the digest. Deleting or
editing the approval, losing write permission, or removing `ai-fix` revokes the
next run. Approval cannot retroactively cancel a run already given its snapshot.
Organization membership alone does not grant permission to approve outsiders.

On trusted authors' issues, untrusted comments are ignored unless a writer has
explicitly approved their current snapshot. PR comments, reviews and inline
feedback are always filtered to trusted authors. External PR feedback must be
reviewed and restated by a trusted person. It cannot independently wake Codex.
Revision hashes include only filtered task content, not label/timestamp churn.

Policy checks precede label writes, cloning/resetting the worktree and Codex.
Dry runs make read-only GitHub requests and write private local diagnostic files;
they neither change labels nor open/comment on PRs, and never invoke the model.
The policy helper must be installed outside the mutable agent worktree. This is
an authorization/spending gate, not a replacement for the Codex sandbox, GitHub
permissions or human code review. Queuing trusted work can still consume tokens.

The GitHub credential needs membership visibility for the configured organization
and permission to read repository collaborators' permissions. See GitHub's
[membership API](https://docs.github.com/en/rest/orgs/members#get-organization-membership-for-a-user)
and [repository permission API](https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user).
Do not print credentials or issue bodies in operational health checks.

## Updating an existing installation

Wait until the service is idle; do not interrupt an active Codex run. Back up the
installed runner, policy helper and environment file privately. Hold the runner's
`STATE_DIR/runner.lock` during installation, install the helper first, then replace
the runner atomically. Preserve existing environment values and set the approved
trust lists. Verify with the dry run above. Keep the timer's previous enabled state.
Rollback restores those backed-up files under the same lock; restoring the old
runner also restores its unrestricted author handling.

Run `node --test scripts/issue-runner-policy.test.mjs` for policy and non-mutating
shell checks. The installed dev runner previously had a new-issues-first selection
patch not present in Git; this implementation preserves that queue priority.

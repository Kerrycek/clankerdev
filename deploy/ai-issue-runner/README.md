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
apt-get install -y gh jq git
```

Install files:

```sh
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
3. The runner creates an `ai/issue-*` branch, or reuses the existing branch if a
   PR is already open.
4. Codex edits the repository locally.
5. The runner commits, pushes, and opens or updates a PR.
6. A human reviews and merges.

The label `ai-pr` means an AI pull request exists. It does not stop the runner
from reacting to later review feedback. To avoid loops, the runner stores a hash
of the last issue/PR review context it handled and skips unchanged feedback.

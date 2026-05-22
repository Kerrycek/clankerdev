# Clankerdev AI Maintenance Rules

This repository is maintained through human-reviewed AI pull requests.

## Project Boundaries

- The upstream `vpsfreecz/*` repositories are read-only references. Do not push to
  them and do not open PRs against them unless a human explicitly asks.
- `dev.crucio.cz` is the test UI deployment on `admin.crucio.cz`
  (`172.16.106.176`).
- `dev.crucio.cz` serves the new UI copied from
  `clankerdev.vpsfree.cz` and uses the local test API on
  `127.0.0.1:9292`.
- Production deploys, server changes, database changes, and secret changes must
  not be performed from an issue fix. Prepare code/config changes in a PR and
  wait for human approval.

## Issue Fix Workflow

- Work on a branch named for the issue, for example `ai/issue-12-short-title`.
- Keep changes scoped to the issue.
- Include tests or smoke-check notes when possible.
- Do not merge your own PR.
- Do not deploy.
- PR descriptions must include:
  - the issue being fixed,
  - a short change summary,
  - verification performed,
  - any risks or follow-up needed.

## Repo Hygiene

- Avoid unrelated refactors.
- Do not commit secrets, tokens, local credentials, generated auth files, or
  private server backups.
- Prefer documenting operational changes under `deploy/`.

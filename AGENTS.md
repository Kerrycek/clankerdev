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
- Do not modify the AI issue runner (`deploy/ai-issue-runner/*`) while solving
  unrelated product issues.
- PR descriptions must include:
  - the issue being fixed,
  - a short change summary,
  - verification performed,
  - any risks or follow-up needed.

## Source and Build

- This repository contains the WebUI Next source project.
- Make product fixes in `src/`, `bff/`, tests, docs, or deployment files as
  appropriate for the issue.
- Do not commit generated build output from `dist/`, `assets/`, `.vite/`, or
  `node_modules/`.
- Use `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` when
  relevant. For BFF-only changes, also consider `cd bff && npm ci`.
- Deployment still happens only after human review. The dev deployment builds
  `dist/` from source and syncs that output to the webroot.

## Repo Hygiene

- Avoid unrelated refactors.
- Do not commit secrets, tokens, local credentials, generated auth files, or
  private server backups.
- Prefer documenting operational changes under `deploy/`.

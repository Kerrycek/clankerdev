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

## Work Log

- Read `docs/work-log/README.md` and the relevant change/release records before
  starting work. Keep one `docs/work-log/YYYY-MM-DD-descriptive-change.md` file
  per feature/change and append dated follow-ups there across all related PRs.
- Unrelated changes must use separate files. Do not append to `WORK_LOG.md` or
  update a shared index/README for each PR. Multi-feature releases may use a
  separate release file linking the affected change records.
- Update the log in the same PR as the work when practical. Link the PR/commit
  and evidence; distinguish prepared, merged, and deployed states explicitly.
- Record later merge/deployment outcomes as dated follow-ups. Distinguish fixture
  browser checks from real API validation and never invent missing history.
- Keep secrets, personal data, raw production responses, and private operational
  details out of the log. Log maintenance does not authorize deployment or resume
  paused automation.

## Design and Requirements Documentation

- Read `docs/design/README.md` and relevant entries in
  `docs/design/REQUIREMENTS.md` before changing product behavior.
- Keep English design/workflow/contract docs and requirement status current in
  the same PR. Reference affected requirement IDs in the PR description.
- Recover actual user intent and record superseded choices; do not invent missing
  historical rationale or turn observed source behavior into an approved request.
- Regenerate `npm run docs:inventory` when routes or API adapter modules change.
  Run `npm run audit:design-docs`; review semantic accuracy separately.
- Preserve evidence scope and distinguish implementation, test results, merge and
  deployment. The handbook replaces the unavailable external spec dependency;
  old docs/spec fragments are historical, not conflicting active requirements.

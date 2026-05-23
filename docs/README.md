# Documentation

## Canonical source of truth

The only authoritative product / UX / implementation specification is:

- `../../UI_REDESIGN.md`

That file owns requirements, gap tracking, rollout gates, and execution order.

See `CANONICAL_DOCS.md` for the current canon / derived / historical split within this docs tree.

## What remains here

This `docs/` tree is now one of:

1. **supporting derived documentation**
   - helpful when it does not contradict the redesign spec

2. **historical / quarantined stubs**
   - kept only so old links do not break
   - intentionally stripped of normative content when they contradicted the canon

## Rules

- Do **not** introduce new requirements anywhere under `docs/`.
- If a topic needs a current spec, update `../../UI_REDESIGN.md` first.
- If a historical path must stay for link compatibility, keep it as a quarantine stub only.

# Spec fragments / derived docs

This directory is **not** the canonical product/UI spec.

## Canonical source of truth

The active, normative specification lives in:

- `../../../UI_REDESIGN.md`

That file owns:
- product / UX requirements
- implementation gap tracking
- rollout / test gates
- execution order

## What this directory is now

Files here fall into two buckets only:

1. **Supporting derived docs**
   - implementation notes or focused appendices that do not contradict `UI_REDESIGN.md`

2. **Historical / quarantined stubs**
   - paths intentionally kept only to avoid broken links
   - content removed because it contradicted the canon (especially obsolete mode-model assumptions or stale readiness/planning state)

## Rule

If any file in this directory disagrees with `../../../UI_REDESIGN.md`, the redesign spec wins.
Do not introduce new requirements here.

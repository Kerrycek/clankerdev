# Action matrices

This folder contains **action matrices** that lock down, for each high-level object type:

- what actions exist in the UI
- where they appear (header button / overflow menu / bulk)
- their gating rules (state + locks + permissions)
- what transitions to show
- what to invalidate after completion

This is the “no shortcuts” layer that prevents:
- random per-button enabling/disabling
- inconsistent confirmations
- actions that work on one page but not another

Last updated: 2026-01-25

Matrices:
- `ACTION_MATRIX_VPS.md`
- `ACTION_MATRIX_DATASET.md`
- `ACTION_MATRIX_DNS.md`
- `ACTION_MATRIX_ADMIN.md`

Related:
- `ACTION_GATING_ENGINE.md` (the common gating engine)
- `OBJECT_STATES.md` (how states are computed)
- `STATE_AND_LOCK_WIDGETS.md` (how states/locks are rendered)

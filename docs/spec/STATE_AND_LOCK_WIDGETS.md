# State and lock widgets

This spec defines the **canonical UI widgets** used everywhere to display:

- lifecycle/runtime state
- busy/maintenance locks
- disabled-action reasons

The goal is consistency: the same visual language and interaction patterns across the whole app.

Last updated: 2026-01-31

Related:
- `DESIGN_SYSTEM_FOUNDATIONS.md` (sizes/typography; prevents “random” sizing)
- `OBJECT_STATES.md` (what states mean)
- `ACTION_GATING_ENGINE.md` (gate result + reason codes)
- `I18N_L10N.md` (translation and tone)

---

## Non-negotiable rules

1) **No color-only meaning**
- A badge must include text.
- Icons are optional, never the only signal.

2) **No arbitrary sizing**
- Badges, pills, buttons, chips must use the design system variants.
- No bespoke heights/widths per screen.

3) **One interaction pattern**
- Desktop: hover/focus tooltip for reasons.
- Mobile: tap opens a bottom sheet/popover for reasons.

---

## Widget inventory (v1)

### `StateBadge`
Purpose: show **lifecycle** state (Active/Suspended/Deleted/etc).

Variants:
- `neutral` (Active)
- `warning` (Suspended, Soft deleted)
- `danger` (Deleted)
- `muted` (Unknown)

Content rules:
- label is short: `Active`, `Suspended`, `Deleted`, `Unknown`
- Advanced may show additional details via tooltip (e.g. suspension reason)

### `RuntimeBadge`
Purpose: show **runtime** state (Running/Stopped/Rescue/Unknown).

Variants:
- `success` (Running)
- `neutral` (Stopped)
- `warning` (Running (Rescue))
- `muted` (Unknown)

Content rules:
- label must be explicit: `Running`, `Stopped`, `Running (Rescue)`, `Unknown`
- When `Unknown`, include an info tooltip/sheet explaining why

### `LockBadge`
Purpose: show **busy/maintenance** state.

Implementation (v1): `src/components/ui/LockBadge.tsx`.


Lock kinds:
- `transaction` → label `Busy`
- `local` → label `Working…` (very short) or `Busy`
- `maintenance` → label `Maintenance`

Interaction:
- Always exposes a reason.
- Advanced: reason includes chain id link when available.

### `ReasonTooltip` / `ReasonSheet`
Purpose: show the reason why an action is disabled.

Inputs:
- `reason.code` from `ACTION_GATING_ENGINE.md`
- `reason.details` for contextual values (chain id, ETA, etc)

Desktop:
- `ReasonTooltip` appears on hover/focus.
Mobile:
- `ReasonSheet` appears on tap.

Copy rules:
- Basic: simple, reassuring.
- Advanced: short + optional “Show details”.

### `ActionButton` and `ActionMenuItem`
Purpose: one reusable way to render gated actions.

Required behavior:
- must accept a `GateResult`
- if not visible → not rendered
- if disabled → renders disabled and exposes reason using the same pattern

---

## Where these widgets appear

### Lists (desktop)
Each row should show:
- primary identifier (hostname/name)
- `RuntimeBadge` for VPS rows
- `StateBadge` if lifecycle is not Active (otherwise optional)
- `LockBadge` if busy/maintenance

Row actions (quick actions) must be gated and disabled consistently.

### Lists (mobile)
Cards show:
- primary identifier
- `RuntimeBadge` (VPS) or `StateBadge`
- `LockBadge` if relevant
- primary action + overflow menu

### Object headers (detail pages)
Must show, in a stable order:
1) Title + ID
2) `RuntimeBadge` (VPS) and/or `StateBadge`
3) `LockBadge` if relevant
4) relationship chips (Node/User/Dataset)
5) primary actions

---

## Copy and translation keys

State badges use dedicated translation keys (not shared with action gating):

- `state.lifecycle.active`
- `state.lifecycle.suspended`
- `state.lifecycle.soft_delete`
- `state.lifecycle.deleted`
- `state.lifecycle.unknown`

Runtime:
- `state.runtime.running`
- `state.runtime.stopped`
- `state.runtime.rescue`
- `state.runtime.unknown`

Locks:
- `state.lock.busy`
- `state.lock.maintenance`
- `state.lock.working`

Disabled action reasons use:
- `gate.<reasonCode>.title`
- `gate.<reasonCode>.body`

---

## Accessibility

- Badges must be keyboard-focusable when they have a tooltip/sheet.
- Tooltip must be reachable via focus (not hover-only).
- Reason sheets must be dismissible and return focus to the triggering element.

---

## Testing expectations

Unit tests:
- `StateBadge` mapping: correct label for each lifecycle state
- `LockBadge` rendering: transaction vs maintenance

E2E:
- tabbing onto a disabled action reveals the tooltip with a reason
- mobile tapping a disabled action opens a reason sheet

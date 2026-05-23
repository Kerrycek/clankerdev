# Notification copy templates

This spec defines consistent, translated microcopy for:
- toasts (task done/failed)
- progress modals for selected actions
- Tasks drawer item labels

Goals:
- Notify users when their actions complete or fail.
- Avoid spam and ambiguity.
- Keep Basic calm and helpful; keep Advanced dense and informative.

Last updated: 2026-01-25

Related:
- `TASKS_AND_NOTIFICATIONS.md`
- `COPY_AND_CONTENT_STYLE.md`
- `I18N_L10N.md`
- `ACTION_MATRICES.md` (action ids)

Baseline EN/CS strings for the keys referenced in this spec are in:
- `src/i18n/en.ts`
- `src/i18n/cs.ts`

---

## Toast types

We use a small set of toast shapes.

### Task completed

Key namespace:
- `toast.task_done.title`
- `toast.task_done.body`

Template:
- Title: “Done: {action}” (EN)
- Title: “Hotovo: {action}” (CS)
- Body optional: object name + short hint

### Task failed

Keys:
- `toast.task_failed.title`
- `toast.task_failed.body`

Template:
- Title: “Failed: {action}” (EN)
- Title: “Selhalo: {action}” (CS)

Basic body should suggest next step:
- “Open Tasks for details.” / “Otevřete Nedávné akce pro podrobnosti.”

Advanced body may include backend message (truncated) and a “Copy details” link inside the task.

### Action blocked (race condition lock)

Keys:
- `toast.action_blocked.title`
- `toast.action_blocked.body`

This is used when the backend rejects a mutation due to lock (e.g. 423),
despite preflight gating.

---

## Action label resolution (for toasts)

We need a stable `{action}` string.

Priority order:
1) UI-known action id → translate via `action.<id>.label`
2) fallback to backend label (if present)
3) fallback to `toast.unknown_action` (“Action” / “Akce”)

Rule: do not show raw action ids in Basic toasts.
Advanced may show the raw id under “Details”.

---

## Progress modal copy

Blocking progress modals are used for selected actions:
- VPS start / stop / restart
- Root password generation

Keys (generic):
- `modal.progress.title`
- `modal.progress.body`
- `common.keep_open`
- `common.continue_in_background`

Action-specific titles should exist for key actions:
- `modal.vps.start.title`
- `modal.vps.stop.title`
- `modal.vps.restart.title`
- `modal.vps.root_password.title`

Guidelines:
- Title is present continuous: “Restarting VPS…” / “Restartování VPS…”
- Body explains what happens next and where to watch progress (Tasks drawer).

---

## Root password reveal copy

Root password generation has a special UX rule:
- the “New root password” dialog is shown **only** when the task is done
- the password is shown once and must be copyable

Keys:
- `modal.root_password_reveal.title`
- `modal.root_password_reveal.body`
- `common.copy`

Basic body should include a short safety hint:
- “Store it securely.” / “Uložte si ho na bezpečné místo.”

---

## Acceptance criteria

- Task completion/failure toasts are translated (EN + CS).
- Basic toasts are understandable without internal IDs.
- Advanced toasts provide access to technical details.
- Root password is not shown early; reveal happens only when ready.
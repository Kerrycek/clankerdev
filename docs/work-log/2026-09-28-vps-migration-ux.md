# Browsable VPS migration form

## 2026-09-28 — Destination-first migration UX

**Request / reason:** the maintainer wants to choose destination nodes without
knowing their names, see all migration options without expanding a disclosure,
and keep the reason visible. The redundant instruction to check the already-known
source node and repeated summaries made the form harder to use.

**Change / decision:** REQ-028 now specifies an immediately visible, searchable
radio-card list of active hypervisors with location/environment labels. The source
node is excluded. The reader follows Node#index's default ascending ID cursor to
an empty page (including server-capped short pages), rejecting non-progress and
partial failures rather than showing a misleading complete inventory.

Timing and reason share a row on desktop and stack on mobile. IP behavior and
execution/notification options are always exposed in named groups. Unknown
location/environment metadata is not described as a guaranteed IP-preserving move.
Confirmation names the actual VPS and destination and resets on edits. Loading or
failed inventory blocks submission and offers retry. Existing scheduling defaults,
conditional transfer/replace IP flags, mutation payload, permission gates, preflight,
uncertain-outcome handling and action-state tracking remain in place.

**Contract references:** legacy `webui/forms/vps.forms.php` migration steps and
`api/lib/vpsadmin/api/resources/{vps,node}.rb` in the read-only vpsAdmin reference.
The server retains compatibility/capacity checks; listing a node is not certification
that a migration will succeed. No real VPS was migrated for this UI change.

**Verification:** typecheck, lint, cs/en dictionary parity, CSP, design-doc and
lookup audits passed; production build passed. All standard PR-check steps passed:
150 script tests, 36 BFF tests and 1,517 unit tests. The initial BFF attempt lacked
this worktree's dependency link; after restoring it, BFF and the remaining unit
suite passed. Eighty fixture Playwright lifecycle checks passed across Chromium
desktop and mobile, including browsing/filtering, confirmation resets, errors/retry,
exact migration payloads, member/admin gates and busy-object protection. The cs dark
and en light desktop/mobile screenshots were inspected; they contain synthetic data
and remain operator-held under `clankerdev-vps-migration-ux-20260928`.

Optional UI-string and structural audits still fail on the same pre-existing
findings reproduced from base `156a7c043e543b5f4a51fc962d16e31bd6eaa00f`:
three hardcoded strings in unrelated test fixtures; 892 `as any` occurrences,
63 files over 500 lines and existing structural-budget drift. No baseline,
exception or CI gate was changed. These are not new migration-form failures.

**Status:** prepared locally for review; not merged or deployed. General autonomous
development remains paused.

**Next / limitations:** review the PR and synthetic cs/en screenshots. Actual migration
completion depends on the existing backend/transaction workers. No backend or shared
service configuration is changed.

## 2026-09-28 — Compact destination dropdown after screenshot review

**Request / reason:** the maintainer rejected the always-visible node cards as
impractical for dozens of hypervisors and requested a click-to-open node list.
That feedback supersedes the initial radio-card decision above.

**Change / decision:** the destination is now a compact button showing the chosen
hostname, location and environment. It opens a searchable, scrollable list capped
at 256px; the overlay does not push the remaining form down. Selection closes the
list and restores focus. Arrow keys/Enter select, Escape cancels, and outside clicks
close the list without losing the current destination. All timing, reason, IP and
execution options remain visible. Inventory pagination and API compatibility checks
are unchanged.

**References:** [PR528](https://github.com/Kerrycek/clankerdev/pull/528), REQ-028.
**Verification:** 14 targeted desktop/mobile fixture migration checks passed,
including 60 synthetic destinations spread across server-capped pages, bounded list
height, search, Enter/Escape, outside close, retained selection, payloads and errors.
Twelve relevant model/inventory/page unit tests passed, as did typecheck, lint,
overlay/lookup/design/i18n audits and build (existing chunk-size warning). Synthetic
cs/en desktop/mobile screenshots were inspected. Initial new-test selectors counted
options from unrelated form selects and tried to click a field covered by the open
list; scoped list assertions and a visible outside target corrected those tests.
No application check was weakened and no real migration was performed.
**Status:** updating the existing PR; not merged or deployed.

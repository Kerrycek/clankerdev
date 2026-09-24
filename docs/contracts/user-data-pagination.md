# User-data list contract and remaining beta gate

## Status update — 24 September 2026

The historical audit below describes API `486350466`. The user subsequently
approved the specific backend cursor work, now open as
[vpsAdmin PR44](https://github.com/vpsfreecz/vpsadmin/pull/44), head
`320af0e152ed223bf0365e0f1cf4b38cf00d7b1d`. Ordered-cursor resource tests pass;
API/UI integration in the isolated VM and review remain required. This does
not authorize or record a shared API deployment. Earlier local-only and
approval statements below apply to the original audit date.

## Original audit

Reference: vpsAdmin API `486350466e8fb6f966add1cde3fa2bc12b4d6b62`,
Clankerdev base `fbb02a065bc65f50f66f5bbcedfc35099a74bfa0`, issues #241 and #189.
This is a fresh implementation; closed PR #242 is not reopened or merged.

## API evidence

`api/lib/vpsadmin/api/resources/vps_user_data.rb`, `VpsUserData::Index`,
declares only `user` and `format` in addition to inherited pagination inputs.
Member authorization restricts the owner to the authenticated user; admins can
select an exact owner. The resource spec requires returned IDs to be greater
than `from_id`. The action calls `with_pagination(query)` without an explicit
`ORDER BY`. Upstream PR #43 changes user payments, not this endpoint.

## Frontend behavior

- Never send the unsupported `q` parameter. Search labels case-insensitively;
  a number or `#number` matches an exact ID. Do not search template content.
- Retain owner and format on every request. Include viewer identity and role
  in the query cache and pagination scope.
- Read batches of 100 using the ascending ID predicate. Validate strictly
  increasing positive safe-integer IDs, including invisible lookahead rows.
  Reject repeated, descending, invalid and oversized pages instead of sorting
  or presenting a partial successful result.
- Collect the requested page plus one matching row. Display only the page,
  continue after its greatest visible ID and derive Next from the extra match.
- Scan at most 1,000 raw rows per page request, then permit only a one-row
  existence probe. An empty probe proves the exact boundary; a nonempty probe
  raises a translated search-limit error. Retry is explicit, not automatic.
- Carry the query abort signal through every request and check it between
  batches. Advanced filters apply on confirmation, not on every keystroke.
- Fresh pages rebuild forward cursor edges; successful empty cursor pages
  return to the preceding page. Filter changes clear the cursor. Browser
  Back/Forward and reload preserve a valid URL cursor.
- URL-restoring lists derive the current cursor from the committed router
  URL during render. A history transition must not query the preceding page
  while waiting for a layout effect. Empty-page recovery runs once per result
  while the router commits the navigation.

## What this does not establish

The frontend cannot prove that an API response omitted no lower IDs. For
example, a first batch `[10, 20]` can pass order validation even if ID 5 exists
but was omitted by an unordered SQL LIMIT. The next predicate `id > 20` cannot
recover it. This PR therefore does not resolve upstream #189 or claim an
atomic snapshot across concurrent writes.

The minimal backend proposal is an explicit `ORDER BY id ASC` matching the
existing predicate, with integration tests over multiple limited pages,
nonmonotonic timestamps, owner/format scope and exact terminal boundaries.
No upstream PR, shared API deployment or database migration is authorized by
this frontend change. A real isolated API/VM run remains a beta gate.

## Verification checklist

- [x] Unit coverage for ascending/gapped IDs, lookahead, timestamps unrelated
  to ID order, later-batch label/ID matches, scope propagation, malformed pages,
  1,000/1,001 boundaries, mid-scan HTTP failure and cancellation.
- [x] Fixture Playwright: member/admin, cs/en, desktop and 390 px mobile;
  exact terminal page, URL refresh/history, rebuilt forward cursor, advanced
  filter labels and request count, cap/error/retry, last-row deletion.
- [x] Existing create/edit/deploy/delete and editor/lookup accessibility tests.
- [ ] Real isolated API ordering and permissions verification.
- [ ] Explicit upstream ordering guarantee (#189).

Fixture tests record every POST/PUT/PATCH/DELETE on every origin. Read tests
allow only the exact same-origin `PUT /api/v7.0/webui_user_settings` emitted by
the fixture app shell. The deletion test additionally expects exactly one
mocked `DELETE /api/v7.0/vps_user_data/26`. These are not live/VM tests or KB
captures.

The structural audit also fails on the unchanged base revision: 62 files over
500 lines versus the stored budget of 53, plus existing assertions/type-cast
regressions in other files. Reproduced from a clean `git archive HEAD src
scripts`; this change does not alter the baseline or bypass that audit.

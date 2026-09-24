# Dataset and snapshot pagination

This change requires the ordered cursor contract from
[vpsfreecz/vpsadmin#44](https://github.com/vpsfreecz/vpsadmin/pull/44), currently
`320af0e152ed223bf0365e0f1cf4b38cf00d7b1d`. Do not release the UI fix as a
standalone guarantee against an older API using numeric ID comparisons.
The branch is based on UI PR496 for browser-history cursor restoration.

- Dataset index (including NAS): ascending `(full_name, id)`.
- Dataset snapshots: ascending `(created_at, id)`.
- `from_id` identifies the last displayed row in the scoped ordered list. It
  is not the minimum or maximum ID and does not include the lookahead record.
- Fetch `limit + 1`, display `limit`, and enable Next only with a fresh extra row.
  A historical forward cursor alone cannot prove that another page exists.
- Next replaces its visited forward edge with the current row boundary.
- Requests carry cancellation signals. URL filters changed by the UI clear the
  cursor; browser navigation and reload restore the URL cursor.
- Invalid/deleted/out-of-scope anchors return an API error. Retry preserves the
  cursor; the explicit first-page action preserves filters. Empty cursor results
  retain a return path. Text search remains limited to the displayed API page.
- Member NAS does not submit an arbitrary owner filter; API authorization scopes
  the records. These frontend checks do not replace backend authorization.

Concurrent renames, inserts, deletes or timestamp changes are not a consistent
snapshot. Restart traversal after such changes; no exactly-once promise is made.
Property history, downloads and expansion history are separate endpoints and
are not certified by this change.

## Evidence

Fixture Playwright covers three pages with non-monotonic IDs, tied snapshot
creation times, exact end, desktop/mobile, cs/en, admin owner filter/member NAS,
reload, Back, invalid cursors, empty pages, and a changed visited boundary.
Existing local text-filter and snapshot pagination tests remain covered.
The dedicated filter regression also checks reset and browser-history recovery.

API specs for PR44 and UI fixtures are separate evidence. Actual combined
API44/UI496/storage execution in the existing isolated VM cluster is still a
release gate; these tests must not be reported as live VM certification.

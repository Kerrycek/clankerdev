# Dataset and snapshot cursor audit (#189)

Source audit against API `486350466e8fb6f966add1cde3fa2bc12b4d6b62` and UI
`22cf991041d421fa60e13339fa41949a3643bdc9`. The original source audit is now
backed by actual Ruby API resource tests
against a dedicated MariaDB. This is not a browser/VM pagination test or an
agreed backend contract.

## Confirmed source mismatch

In API `api/lib/vpsadmin/api/resources/dataset.rb`:

- `Dataset::Index` calls `with_pagination` on `ORDER BY full_name`.
- `Dataset::Snapshot::Index` uses `ORDER BY created_at`.
- `Dataset::PropertyHistory::Index` uses `ORDER BY created_at DESC`.

The inherited HaveAPI cursor uses an ID comparison, as established by the
separate IP-history resource reproduction. None of these three orders is the
same as an ID order; none supplies a unique ID tie-breaker. A successful
single-page response therefore does not establish complete traversal.

The UI adds another mismatch: `DatasetsListPage.tsx` continues from the minimum
ID (`cursorFromDescendingPage`) despite the API's ascending ID predicate.
`DatasetSnapshotsPage.tsx` uses the maximum ID and a one-row lookahead; that
lookahead fixes end detection only when server ordering matches the cursor.
The snapshot pagination fixture currently returns `id > fromId` rows in ID
order, so it cannot expose nonmonotonic timestamp behavior.

An illustrative counterexample has rows `(id, full_name)` of `(1,z)`, `(2,a)`,
`(3,b)`. A size-two name-ordered page is `[2,3]`. Continuing with the UI's
minimum ID 2 repeats row 3 and can never return row 1. Replacing minimum with
maximum still loses row 1. For snapshots, give the same IDs timestamps March,
January and February: time ordering produces the same failure. These examples
explain the source mismatch; they are not labeled as executed API tests.

## Actual resource reproduction

Six API tests exercise three size-two pages and the empty terminal page for
member and admin accounts. Dataset names and snapshot/history timestamps are
unrelated to ID order; timestamp ties are included. On the unchanged dataset
resource from API `486350466`, all six fail. For example, a snapshot traversal
expected IDs `[2,4,6,3,5,1]` and returned `[2,4,6,5,6]`, both omitting and repeating
rows. The tests use the real Ruby resource and a dedicated MariaDB on port
13326, never the shared API/database. `dataset-cursor-baseline.log` records the
six failures; this is distinct from the previously illustrated examples.

A separate local proposal retains visible ordering and implements the tuple
anchor below, adds a deterministic ID tie-breaker, and deduplicates dataset
joins. Its tests also cover missing/deleted/foreign/filtered anchors and owner
boundaries. Commit `ee81404cad15b299eced907676bbd2c98d825d9e` is local only,
on top of the IP/user-data proposal. It remains separate from the running API
and release candidate.

Validation used the locked Ruby 3.4.9/API dependencies:

- Initial three-file run: 55 examples, one failure in the new history date-scope
  case; all 43 dataset/snapshot examples passed. The cursor lookup exposed an
  ambiguous unqualified `created_at` filter when joining included properties.
- After qualifying both date bounds, the complete history file passed:
  12 examples, zero failures, including traversal with both date bounds.
- RuboCop passed for all four changed Ruby files. Existing storage CI rules
  already cover these files; no new files or selection bypasses were added.

Logs are `dataset-cursor-proposed.log`, `dataset-cursor-history-final.log` and
`dataset-cursor-rubocop-final.log` in the local beta evidence bundle. This is
coverage across two runs, not a claim that the initial 55-example run was green.
The isolated MariaDB process was stopped after testing. The proposal has no
migration and has not been deployed even to the browser-test VM cluster.

## Contract to settle before promotion

Either define explicit ID ordering for each endpoint or retain visible sorting
with a tuple cursor: `(full_name,id)` for datasets and `(created_at,id)` for
snapshots/history, with the documented direction. If retaining the existing
`from_id` input as an anchor, resolve it inside the authorized and filtered
query and reject invalid/deleted/out-of-scope anchors without leaking ownership.
The client must use the last visible row's anchor, not its minimum/maximum ID.
For the snapshot lookahead request, this is the final displayed row after
slicing to the page size, never the additional hidden row. Invalid anchors
need an explicit restart path that preserves the selected filters.

Dataset names can change, and pages are separate HTTP requests. Document how a
rename or concurrent mutation invalidates traversal; do not promise snapshot
isolation. The property-history timestamp filters must remain part of the
anchor scope. Join multiplicity in the dataset query also needs checking.

Required actual resource tests: more than two small pages, unrelated ID/name/
time order, equal timestamps, owner and dataset boundaries, supported filters,
unknown/deleted/foreign/filtered anchors, authorization failures, and exact
terminal pages. Then repeat the corresponding browser paths against the exact
isolated API pin. Do not substitute sorted mocks for this evidence.

## Release boundary

The earlier local backend proposal `de1cf7b` covers IP assignments and user-data
only. The dataset proposal is a separate follow-up, not a change to the running
API. No upstream PR, shared migration or deployment is performed by this work.
The beta gate remains open;
local snapshot create/delete/restore checks do not close pagination correctness.

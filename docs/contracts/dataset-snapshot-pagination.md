# Dataset and snapshot cursor audit (#189)

Source audit against API `486350466e8fb6f966add1cde3fa2bc12b4d6b62` and UI
`22cf991041d421fa60e13339fa41949a3643bdc9`. This is not a completed multi-page
VM test or an agreed backend contract.

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

## Contract to settle before implementation

Either define explicit ID ordering for each endpoint or retain visible sorting
with a tuple cursor: `(full_name,id)` for datasets and `(created_at,id)` for
snapshots/history, with the documented direction. If retaining the existing
`from_id` input as an anchor, resolve it inside the authorized and filtered
query and reject invalid/deleted/out-of-scope anchors without leaking ownership.
The client must use the last visible row's anchor, not its minimum/maximum ID.

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

The existing local backend proposal `de1cf7b` covers IP assignments and user-data
only. It does not fix these endpoints. No backend change, upstream PR, shared
migration or deployment is performed by this audit. The beta gate remains open;
local snapshot create/delete/restore checks do not close pagination correctness.

# IP assignment pagination (#208)

The administrative audit uses `from_id` as a row anchor in the server's
`(from_date, id)` order, in either direction. This requires
[vpsAdmin PR44](https://github.com/vpsfreecz/vpsadmin/pull/44), tested resource
proposal `320af0e152ed223bf0365e0f1cf4b38cf00d7b1d`. Do not promote this UI
against the old API's ID-only predicate: taking the minimum or maximum ID
cannot recover rows omitted by a differently ordered server.

Each request carries the same exact IP, owner, VPS, active-state and order
filters and asks for page size plus one. Only the visible rows are rendered.
Next uses the final displayed row, not the hidden lookahead; no lookahead means
no next page, even for a full terminal page. A refreshed previous page rebuilds
its forward edge. Cancellation prevents obsolete requests from continuing.

A failed request offers retry and, for cursor pages, a return to the first page
without clearing filters. Empty pages retain backward navigation. The shared
committed-URL restoration fix from UI PR496 is required for browser history;
this PR is stacked on that branch. The member route guard denies this admin
page before the audit query runs. This does not change API permissions.

Fixture Playwright covers both directions, three pages, timestamp ties,
nonmonotonic IDs, exact end, history/reload, stale forward edges, error recovery,
empty cursor pages, member denial and the existing exact-IP/legacy-link flow.
The cs/en pagination and recovery cases run on desktop and mobile. These mocks
implement the proposed server contract; they do not certify real API behavior.

Remaining gate: run the exact UI/API pair on the existing isolated VM with
synthetic records, including real owner scoping and invalid cursor responses.
The resource specs and fixture tests are separate evidence. Pages are separate
requests, not a snapshot across concurrent changes. UserNetwork's bounded
active-assignment lookup and IncidentReportNew's active lookup are not paginated
history views and are not changed here.

# Redesign documentation references and audit fixtures

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

## 2026-09-27 - Repair missing redesign-spec references

**Request:** make the referenced UI_REDESIGN.md available to repository readers.
The original external file was not found in the available workspace or Clankerdev
Git history. Its precise contents remain unknown; the existing design handbook
is the maintained replacement, not a reconstruction of the missing document.

**Change:** add a root compatibility navigation page; replace external pointers
in historical stubs and source comments with in-repository documentation. Mark
the March route audit as historical and replace unverifiable numbered citations
with related current workflow links. Include the previous sidebar release receipt.

**Verification / status:** 121 local links/anchors checked; design and active-doc
audits and diff whitespace validation passed. A negative check confirmed the audit
rejects a restored external sibling reference. No runtime behavior change or
deployment needed.
Prepared for review. Historical requirements are not claimed to be fully recovered.
## 2026-09-27 - Repair PR525 documentation audit test fixtures

**Failure:** CI run 36333825895 failed three script tests. The updated audit
requires the root redesign index and scans Git-tracked paths; the isolated test
fixture supplied neither. The failure reproduced locally. The earlier direct
audit checks passed against the real checkout but did not cover this fixture.

**Fix:** include the index and initialize/stage the temporary fixture repository.
Keep the audit strict. Add cases proving that valid bridge links and historical
mentions pass, external references in docs/source fail, and broken links inside
the bridge fail. Existing inventory and requirement checks remain in place.

**Verification:** all seven focused documentation tests passed. The full local
`npm run ci:pr` passed: audits/lint/typecheck, 138 script tests, 36 BFF tests and
1,514 unit tests. No runtime or deployment change.
## 2026-09-27 - PR525 release follow-up

[PR525](https://github.com/Kerrycek/clankerdev/pull/525) was merged as
`e7ce3d73e799fc60e5933fe23bdb3a979eb4d6b9` after the authorized CI gate passed.
The merged tree matches the reviewed head `17177ab4`. Static CI
[36334169789](https://github.com/Kerrycek/clankerdev/actions/runs/36334169789)
and fixture browser CI
[36334169786](https://github.com/Kerrycek/clankerdev/actions/runs/36334169786)
passed, including 378 desktop and 303 mobile browser cases.

The exact release is deployed on dev.crucio.cz and clankerdev.vpsfree.cz;
the artifact built on dev was promoted unchanged with its matching BFF.
Post-deploy health, anonymous session and build provenance checks passed.
Eight real anonymous browser scenarios (both hosts, cs/en, desktop/mobile)
passed with matching legacy favicon bytes and no page errors. These are public
checks, not authenticated lifecycle certification. Detailed logs and receipts
are retained in the operator's local release evidence, not in this repository.
Both hosts retain the previous `49c6a51d` release and deployment backups for
rollback. No API/database changes were made. The one-off PR525 monitor is
paused after completion; general autonomous development remains paused.

The independently requested runner restriction is recorded in its
[own change file](2026-09-27-issue-runner-trust.md);
[PR526](https://github.com/Kerrycek/clankerdev/pull/526) remains open for review.
No further merge or product deployment is authorized by this receipt.

# Design handbook and work-log setup

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

Subsequent release evidence: [heatmap, favicon and handbook release](2026-09-27-heatmap-favicon-release.md).

## 2026-09-27 — Work log established

**Request:** keep an ongoing record to support a complete project handover.

**Change:** introduce this log, link it from the main README, and add a maintenance
rule to AGENTS.md. Seed it with the verified recent release and the two current UI
PRs. Older development is still available through Git/PR history; it has not been
invented or silently marked complete here.

**Verification:** documentation diff and local link checks. No runtime change.

**Status / next:** documentation prepared for review. Maintain entries with future
work and merge/deployment outcomes. Full handover documentation and an independent
code audit remain separate work; creating this log does not complete them.
## 2026-09-27 - Repository-contained design and requirements handbook

**Request:** provide complete English design documentation in docs/, including
recoverable maintainer requirements, what exists, why, how decisions evolved,
and a maintained current list for handover.

**Change:** expanded the existing documentation PR
[#523](https://github.com/Kerrycek/clankerdev/pull/523) instead of creating duplicate
setup work. Added the [handbook](../../docs/design/README.md), 66 stable requirements
with source/acceptance/status, product and workflow design, architecture, API
contracts, decision history, verification gates, operations and source limitations.
The previous specification pointed outside the repository to an unavailable
UI_REDESIGN.md; current entry points now resolve inside the repository. Historical
fragments remain classified as archaeology, not competing requirements.

Added generated inventory of 256 route entries (including layouts/index routes)
and 63 API adapter modules. CI now checks inventory drift, handbook link targets
and requirement references. AGENTS.md requires updates with relevant behavior
changes. Inaccessible history, unverified legacy parity, incomplete live lifecycle
certification and private operational handover remain explicitly identified.

**Verification:** docs inventory/links/IDs and active-doc audits passed; all 135
script tests passed, including 4 new checks of inventory extraction, drift, broken
links/requirement references and unresolved imported route groups. No product
runtime change; no live mutations or deployment performed.

**Status / next:** prepared for review. Review the recovered requirement intent,
assign owners to open decisions/evidence gates, and retain ongoing updates.
The documentation does not complete the independent audit or authorize a beta.

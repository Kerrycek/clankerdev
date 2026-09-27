# WebUI Next design and requirements handbook

Reviewed baseline: product `fd290b5ec1b22900e704e8cb990c5ba050af2394`, 2026-09-27.
Pending PRs are identified explicitly and are not part of that deployed baseline.
Documentation language: English. Product languages: Czech and English.

## Purpose and authority

This handbook explains what the UI does, why it is designed this way, how it got
here, and how to assess a change without losing existing behavior. The maintainer
requested a self-contained design/requirements handover on 2026-09-27.

The previous documentation pointed to a sibling `UI_REDESIGN.md` outside this
repository. That file was absent from the available source checkout and searched
workspace. Many older spec pages had been replaced by quarantine stubs. Those
links cannot serve as a handover. This handbook replaces that external dependency
for ongoing requirements and design documentation. It does not pretend to recover
the missing file's exact content or an undocumented original rationale.

Evidence priority: latest explicit maintainer decision, recorded accepted decision,
current API/source contract, reproducible test evidence. Code describes implemented
behavior; it does not by itself approve new requirements. Conflicts and missing
history must be recorded rather than silently resolved in favor of existing code.

The root [UI_REDESIGN.md](../../UI_REDESIGN.md) is a compatibility navigation page;
it does not contain a recovered original or a competing specification.

## Reading order

1. [Requirements register](REQUIREMENTS.md): stable IDs, source, acceptance,
   implementation status and links.
2. [Product and interaction design](PRODUCT_DESIGN.md): audiences, navigation,
   screen composition, forms, errors, responsiveness and accessibility.
3. [Workflow catalog](WORKFLOWS.md): what each product area supports and its
   success/failure obligations.
4. [Architecture](ARCHITECTURE.md): runtime, data flow, security and source map.
5. [API contracts](API_CONTRACTS.md): backend boundaries and known mismatches.
6. [Decision history](DECISIONS.md): rationale, alternatives and superseded designs.
7. [Verification and release](VERIFICATION.md): evidence levels, commands and
   outstanding beta gates.
8. [Operations and handover](OPERATIONS.md): setup, deployment, rollback and
   remaining ownership questions.
9. [Source register](SOURCES.md): provenance, reconstructed history and limitations.
10. [Generated inventory](IMPLEMENTATION_INVENTORY.md): every declared route and
    API adapter in the current checkout, with source links.

The [work log](../../WORK_LOG.md) records chronology. Requirements record current
intent; decisions explain transitions; test results prove only their stated scope.

## Maintenance contract

Every behavior change must update the affected requirement and workflow in the
same PR, plus the work log. Record the requirement ID in the PR. If no requirement
applies, add one with its actual source; mark proposals as proposed. Preserve IDs
and supersession history. New instructions override older conflicting decisions,
but must be written down with their consequences and migration needs.

For each row distinguish code status, verification scope and deployment status.
Do not upgrade an open PR to delivered based on a screenshot or local pass. Update
release outcomes separately with exact UI/API revisions. Regenerate the inventory
when routes or adapters change. `npm run audit:design-docs` checks local links,
requirement IDs and generated inventory drift; it cannot validate prose accuracy.

Reviewers check: source of the requirement; old/new behavior; all roles and scopes;
API reality; error/uncertain outcomes; cs/en; mobile/desktop; test evidence; migration
and rollback; documentation/work-log updates. Do not restore superseded layouts or
weaken tests to satisfy an outdated document.

## Coverage limit

The register includes all concrete maintainer requests recoverable from the
available task history, recent PR history, and a domain inventory of current code.
It is a reviewable baseline, not a claim that every earlier conversation has been
recovered or every legacy feature has been certified. Unknown rationale, missing
live evidence and outstanding decisions are listed explicitly. Full independent
code/security audit and final beta certification have not been completed by this
documentation change.

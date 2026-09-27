# Documentation

Start with the English [design and requirements handbook](design/README.md).
It explains product scope, requirements and acceptance, interaction design,
architecture, API contracts, workflow behavior, decision history, verification,
operations and handover. It is self-contained within this repository.

- [Requirements register](design/REQUIREMENTS.md): current intent, source, status.
- [Generated inventory](design/IMPLEMENTATION_INVENTORY.md): routes and API adapters.
- [Work log](work-log/README.md): per-change records and release evidence.
- [Documentation map](CANONICAL_DOCS.md): active versus historical sources.

Update affected requirements/design and the work log with each behavior change.
Run `npm run docs:inventory` after route/adapter changes and
`npm run audit:design-docs` before review. The handbook explains evidence limits;
this documentation does not certify every live workflow or approve a release.

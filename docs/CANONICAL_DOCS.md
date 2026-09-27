# Documentation authority and migration map

## Current repository-contained specification

- [Design handbook](design/README.md)
- [Requirements and acceptance](design/REQUIREMENTS.md)
- [Decision history](design/DECISIONS.md)

These replace the former external sibling UI_REDESIGN.md dependency at the
maintainer's 2026-09-27 request. The missing file was not reconstructed verbatim.
Latest explicit maintainer decisions take precedence; record any change here rather
than silently treating existing code or an old document as new approval.

## Active supporting sources

- [Work log](work-log/README.md): per-change history, not a competing requirements list.
- All chapters linked by the handbook: current design, workflow, architecture,
  contracts, verification, operations, sources and generated inventory.
- [BFF README](../bff/README.md) and [deployment docs](../deploy/README.md): technical
  setup references; inspect host-specific scripts/current state before operations.
- Source, tests and CI: implementation/evidence for their exact revision and scope.

## Historical / archaeology

`docs/spec/`, `docs/chat/`, `docs/haveapi/`, `docs/rc/`, old phase screenshots and
root STATUS/ROADMAP/TODO documents are historical or unverified supporting records.
Some are quarantine stubs, some retain useful details. Their claims must be checked
against current source/requirements; they are not competing active specifications.
Old external spec links may remain in those records and source comments for
archaeology. Follow this map for current guidance. Do not restore an obsolete
layout, permission model, contract guarantee or readiness claim from them.

## Entry points

[README](../README.md), [SPEC](../SPEC.md), and [docs README](README.md) all lead to
the same handbook. New product requirements belong in the register with provenance,
acceptance and status, and changes belong in the work log.

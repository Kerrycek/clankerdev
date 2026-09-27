# vpsAdmin WebUI Next

Modern responsive web UI replacing the legacy PHP webui.

## Design and requirements

Start with the [design handbook](docs/design/README.md) for requirements, UX,
architecture, API contracts, decision history, verification and handover.
The [requirements register](docs/design/REQUIREMENTS.md) tracks current intent,
status and acceptance. The [work log](docs/work-log/README.md) records what changed and why.

## Development

Node.js **^20.19.0, ^22.12.0, or >=24.0.0** required.

Recommended local baseline: **22.12.0+** on the 22.x LTS line.

```bash
npm ci
npm run env:check
npm run dev
```

## E2E smoke tests

```bash
# one-time browser install
npm run e2e:install

# same Playwright smoke set used for pull-request feedback
npm run e2e:pr
```

The default Playwright suite uses deterministic HaveAPI mocks and does not require real login credentials.

## Docs map

- [Work log](docs/work-log/README.md) – ongoing work, decisions, verification and release record

- [SPEC.md](SPEC.md) – specification entry point
- [docs/CANONICAL_DOCS.md](docs/CANONICAL_DOCS.md) – current and historical documentation map
- `docs/README.md` – docs tree rules
- `docs/spec/README.md` – spec-fragment rules
- `bff/README.md` – OAuth BFF details
- `deploy/` – deployment notes

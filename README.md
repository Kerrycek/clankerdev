# vpsAdmin WebUI Next

Modern responsive web UI replacing the legacy PHP webui.

## Canonical spec

The source release was imported from the WebUI Next deployment that produced
the current `clankerdev.vpsfree.cz` build. The project notes live in `SPEC.md`
and `docs/`.

## Development

Node.js **^20.19.0, ^22.12.0, or >=24.0.0** required.

Recommended local baseline: **22.12.0+** on the 22.x LTS line.

```bash
npm ci
npm run env:check
npm run dev
```

## Docs map

- `SPEC.md` – canonical-spec pointer
- `docs/CANONICAL_DOCS.md` – canon vs derived vs historical docs map
- `docs/README.md` – docs tree rules
- `docs/spec/README.md` – spec-fragment rules
- `bff/README.md` – OAuth BFF details
- `deploy/` – deployment notes

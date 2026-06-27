# Fáze 10 – Manual runbooks pro dev backend

Datum: 2026-06-25

Cíl fáze: sjednotit dosavadní ruční smoke scénáře z admin workflow fází do jednoho opakovatelného runbooku pro `dev.crucio.cz`, včetně očekávaných request payloadů/query kontraktů, bezpečnostních pravidel pro disposable data a šablony pro zápis výsledků.

## Implementováno

### Konsolidovaný dev-backend runbook

- Přidán `deploy/dev.crucio.cz/admin-workflows-smoke-runbook.md`.
- Runbook pokrývá:
  - access/session preflight pro `/app` ↔ `/admin`, admin/non-admin hranici a bezpečné scope přepisy,
  - requests triage včetně `awaiting` defaultu, quick filtrů, resolve akcí a zákazu `registration[q]` / `change[q]`,
  - incoming payments assignment včetně `POST /user_payments` payloadu a backendového přechodu platby na `processed`,
  - VPS incident report z detailu VPS včetně validního/invalidního `detected_at`,
  - networking/IP workflow s current-page filtrováním a ověřením nepodporovaných `q`/`user` parametrů,
  - user resource assignments včetně create/update/delete payloadů a kontroly efektivních `User::ClusterResource` hodnot,
  - public status a dashboard status triage proti runtime public endpointům,
  - DNS/dataset/export parity kontroly včetně odstraněných blacklistovaných payload klíčů,
  - zbylé API contract/capability kontroly z Fáze 8 pro VPS, OOM, monitoring, audit, user payments, DNS/VPS/mount mutace.

### Výsledková šablona

- Přidán `deploy/dev.crucio.cz/admin-workflows-smoke-results-template.md`.
- Šablona sjednocuje zápis pro PR/release poznámky:
  - metadata runu,
  - použitá disposable data,
  - souhrnnou tabulku bloků,
  - detailní sekce pro kroky, request kontroly, action-state/backend odpovědi a follow-up.

### Napojení na dev deploy dokumentaci

- `deploy/dev.crucio.cz/README.md` nově odkazuje na admin workflow smoke runbook i výsledkovou šablonu.
- Existing `networking-smoke-data.md` a `live-parity-workflows.md` zůstávají specializované doplňky:
  - networking seed/checklist pro síťová data,
  - samostatný live parity runbook pro destruktivnější VPS/dataset workflow.

## Záměrné omezení

Fáze 10 nepouští žádné live backend akce sama. Je to dokumentační a procesní fáze: sjednocuje, co má člověk na dev backendu bezpečně ověřit po deployi. Reálné side effecty dál vyžadují přístup na `dev.crucio.cz`, vhodná disposable data a lidské rozhodnutí, zda je daná akce bezpečná.

## Ověření

Proběhlo a prošlo:

```bash
npm ci --prefer-offline --no-audit --no-fund
npm run typecheck
npm run lint
npm run audit:i18n
npm run audit:pages
npm run audit:active-docs
npm run audit:lookup-primitives
npm run audit:api-barrel-imports
npm run audit:overlays
npm run build
```

Poznámky:

- Změna je dokumentační, proto nebyl přidán nový Vitest test.
- Live dev-backend run podle nového runbooku nebyl proveden v tomto prostředí; vyžaduje přístup na `dev.crucio.cz` a disposable test data.
- Build prošel; Vite/Browserslist hlásí pouze zastaralá `caniuse-lite` data.

## Doporučené pokračování

Fáze 11: UX/accessibility/i18n polish pass — po funkční paritě a contract stabilizaci projít dostupnost, textové polish detaily, i18n konzistenci a případné strukturální debt nálezy z auditů.

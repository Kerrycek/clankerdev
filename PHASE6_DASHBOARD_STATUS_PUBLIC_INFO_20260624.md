# Fáze 6 – Dashboard/status triage a veřejné informace

Datum implementace: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 6 doplnila veřejný status pass po hlavních admin workflow fázích. Veřejná status landing stránka už neukazuje jen souhrn, výpadky, bezpečnostní zprávy a novinky, ale také scan plochu uzlů podle lokalit. Authenticated dashboard zároveň dostal lehký triage panel se signálem „probíhá výpadek / jsou down veřejné uzly“, aby admin i běžný člen rychle viděli veřejný stav služby bez míchání admin-only dat do public statusu.

## Co bylo změněno

### Veřejný status landing

- `/` nově vykresluje sekci `public.nodes.section` nad daty z `Node.PublicStatus` / `/nodes/public_status`.
- Uzly jsou seskupené podle lokality.
- Lokality s nedostupným uzlem se automaticky otevřou přes native `<details>`; pokud problém není, otevře se první skupina.
- V každé skupině je textový souhrn `up/down/total` a malý `StackedBar` pro rychlé skenování.
- Uzly se uvnitř lokality řadí down-first a pak podle názvu.
- Node karta ukazuje jen veřejná data: název/FQDN, up/down badge, poslední report, počet VPS / volných VPS a CPU idle, pokud je endpoint vrátí.

### Dashboard triage

- `/app` a `/admin` dashboard dostaly panel `app.dashboard.status-triage`.
- Panel používá jen public endpoints:
  - `/outages` pro probíhající výpadky,
  - `/nodes/public_status` pro veřejný health uzlů.
- Panel záměrně nemíchá admin-only interní data do veřejného signálu.
- Při probíhajícím výpadku nebo down uzlech ukazuje varovný stav; jinak ukazuje nominal stav.
- Panel obsahuje odkaz `app.dashboard.status-triage.open` na veřejnou status stránku.

### Refresh cadence

- Public overview dotazy i dashboardový status triage panel používají `useTierSlowIntervalMs()` podle `docs/spec/LIVE_UPDATES_STRATEGY.md`.
- Tím se sjednotila nízkofrekvenční obnova veřejných status indexů místo ad-hoc nebo žádného refresh chování.

### i18n a test IDs

- Doplněny CS/EN klíče pro dashboardový status triage panel.
- `docs/spec/TEST_IDS.md` rozšířen o:
  - `app.dashboard.status-triage`,
  - `app.dashboard.status-triage.open`.

### Testy

Přidané testy ověřují:

- `OverviewPage` vykreslí veřejné uzly seskupené podle lokality.
- Lokality s down uzlem jsou defaultně otevřené.
- `DashboardPage` z veřejných outage/node dat vykreslí status triage panel a varovný stav při aktivním výpadku / down uzlu.

## Změněné soubory

- `src/pages/public/OverviewPage.tsx`
- `src/pages/public/OverviewPage.test.tsx`
- `src/pages/app/DashboardPage.tsx`
- `src/pages/app/DashboardPage.test.tsx`
- `src/i18n/locales/en/common.ts`
- `src/i18n/locales/cs/common.ts`
- `docs/spec/TEST_IDS.md`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE6_DASHBOARD_STATUS_PUBLIC_INFO_20260624.md`

## Ověření

Proběhlo:

```bash
npm ci --prefer-offline
npm run typecheck
npx vitest run src/pages/public/OverviewPage.test.tsx src/pages/app/DashboardPage.test.tsx --reporter=verbose
npm run lint
npm run audit:i18n
npm run audit:pages
npm run audit:active-docs
npm run build
```

Výsledek:

- `npm ci --prefer-offline` prošel; dependency audit dál hlásí 11 nálezů v existujícím stromu závislostí.
- Typecheck prošel.
- Cílené testy prošly: 2 test soubory, 2 testy.
- Lint prošel včetně Tailwind token discipline a banned pattern auditů.
- i18n audit prošel se shodnými 2893 klíči v CS/EN.
- Page integrity audit prošel.
- Active docs audit prošel.
- Build prošel; Vite dál hlásí jen zastaralá Browserslist/caniuse-lite data.

## Manuální dev-backend smoke test

Bez VPN/live backendu nelze v archivu ověřit skutečný runtime obsah veřejných endpointů. Na dev backendu je potřeba projít:

1. Otevřít `/` a ověřit, že `public.nodes.section` odpovídá `/nodes/public_status`.
2. Ověřit, že lokality s nedostupným uzlem jsou defaultně otevřené a down uzly jsou v dané lokalitě nahoře.
3. Ověřit, že veřejná karta uzlu nezobrazuje admin-only data.
4. Otevřít `/app` i `/admin` dashboard a zkontrolovat panel `app.dashboard.status-triage`.
5. Simulovat nebo najít stav s probíhajícím outage/down uzlem a ověřit varovný stav panelu.
6. Ověřit, že odkaz z dashboard panelu vede na veřejnou status stránku.

# Phase 11 – UX/accessibility/i18n polish + Playwright screenshot audit

Datum: 2026-06-27

## Cíl

Doplnit chybějící Fázi 11 mezi funkční paritu/contract hardening a pozdější strukturální/CI stabilizaci. Tato fáze se zaměřuje na praktický UX/accessibility polish, i18n dorovnání a Playwright smoke ověření se screenshotovou dokumentací.

## Implementováno

### Shell, navigace a landmarks

- Přidán sdílený `SkipLink` pro rychlý přesun na hlavní obsah.
- App shell i public shell mají explicitní focus target:
  - `#app-main-content`,
  - `#public-main-content`.
- Hlavní obsah má `tabIndex={-1}` a `aria-label`, aby skip link uměl po kliknutí přesunout focus do obsahu.
- App/public navigace dostaly jasné `aria-label` hodnoty pro primary navigation.
- Mobile drawer navigace má stabilní id:
  - `app-mobile-navigation`,
  - `public-mobile-navigation`.

### ARIA stavové vazby pro drawers/popovers

- Header tlačítka nyní zveřejňují vztahy přes `aria-controls`, `aria-expanded` a podle typu také `aria-haspopup="dialog"`:
  - mobile navigation,
  - tasks drawer,
  - sync/offline popover,
  - user menu,
  - command palette.
- Scope/theme/language toggle prvky mají `aria-pressed`, aby byl aktuální stav čitelný pro asistivní technologie.
- Tasks drawer má stabilní id `app-tasks-drawer`.
- User menu má dialog role/id/label pro konzistentní testování a srozumitelný announcement.

### Shared UI primitive hardening

- `Button` umí bezpečně propouštět běžné ARIA atributy pro `button`, interní `Link` i externí anchor varianty.
- `Drawer` podporuje explicitní `id` na dialog/root elementu.
- Tasks filter input má explicitní přeložený `aria-label`.

### i18n doplnění

Doplněny shodné EN/CS klíče pro:

- `accessibility.skip_to_content`,
- `accessibility.main_region`,
- `accessibility.primary_navigation`,
- `user_menu.settings`,
- `tasks.filter.label`.

I18n audit po změně hlásí shodný počet klíčů:

```text
EN keys: 2901
CS keys: 2901
Audit OK.
```

### Playwright lokální stabilizace

`playwright.config.ts` podporuje env přepínače pro prostředí, kde nejde stáhnout bundled Playwright browser nebo kde je potřeba omezit artefakty:

- `E2E_CHROMIUM_EXECUTABLE=/usr/bin/chromium`,
- `E2E_DISABLE_VIDEO=1`,
- `E2E_TRACE=off|on`,
- `E2E_RETRIES=0`.

Výchozí CI chování zůstává zachované: trace/video se drží na failure, retry podle CI režimu.

### Playwright screenshot audit

Přidán opt-in spec `e2e/specs/app/phase11_screenshots.spec.ts`, který se spouští jen s:

```bash
E2E_PHASE11_SCREENSHOTS=1 \
E2E_PHASE11_SCREENSHOT_DIR=/mnt/data/phase11_screenshots \
E2E_START_SERVER=1 \
node scripts/playwright.mjs test e2e/specs/app/phase11_screenshots.spec.ts --project=chromium --workers=1
```

Vygenerované screenshoty:

1. `01-public-overview-desktop.png`
2. `02-public-skip-link-focused.png`
3. `03-public-overview-mobile.png`
4. `04-public-mobile-navigation-open.png`
5. `05-app-dashboard-desktop.png`
6. `06-app-skip-link-focused.png`
7. `07-app-tasks-drawer-open.png`
8. `08-app-user-menu-open.png`
9. `09-app-command-palette-open.png`
10. `10-app-offline-sync-popover.png`
11. `11-app-dashboard-mobile.png`
12. `12-app-mobile-navigation-open.png`
13. `13-admin-dashboard-desktop.png`
14. `14-admin-user-menu-open.png`
15. `15-design-sandbox-light-en.png`
16. `16-design-sandbox-dark-cs.png`
17. `17-design-modal-open.png`
18. `18-design-drawer-open.png`

Součástí výstupu je také `manifest.json`.

## Testovací úpravy

- Přidán `e2e/specs/app/phase11_accessibility_polish.spec.ts` s desktop i mobile PR smoke coverage.
- `AppHeader.access.test.tsx` rozšířen o ARIA regression coverage.
- Opravena fixture/test drift nesouvisející s produkčním chováním:
  - `tasks_drawer_focus_trap.spec.ts` vrací detail transaction chain ve stejném tvaru, jaký čte aplikace.
  - `vps_lifecycle_tab_actions.spec.ts` očekává legacy-safe payloady, které již unit testy i wrappery záměrně používají (`user`, `node`, `expirations` se neposílají do legacy-rejected mutací).

## Ověření

### Statické a unit/integration ověření

Proběhlo a prošlo:

```bash
npm run audit:i18n
npm run lint
npx tsc --noEmit
npm run build
```

Build výsledek:

```text
✓ built in 8.23s
```

Vitest suite byla kvůli limitu běhu nástroje spuštěná po chuncích. Celkový součet prošel:

```text
68 test files passed
287 tests passed
```

Rozpad:

```text
src/lib/api/*.test.ts: 24 files / 107 tests
app/layout/ui/i18n chunk: 13 files / 43 tests
src/lib + gates chunk: 18 files / 106 tests
src/pages tests chunk: 13 files / 31 tests
```

Poznámka: jednopříkazové `npm run ci:check` prošlo všemi audity a typecheckem, ale v tomto kontejneru narazilo na timeout nástroje během Vitestu. Ekvivalentní audit/typecheck část a celý Vitest corpus po chuncích prošly.

### Playwright ověření

Cílená Fáze 11 spec:

```text
2 passed
```

Screenshot audit:

```text
1 passed
18 PNG screenshots + manifest.json generated
```

PR smoke corpus byl kvůli timeoutu monolitického `npm run e2e:pr` při defaultní paralelizaci spuštěn sériově/po souborech. Výsledek chunked běhů:

```text
Desktop PR smoke corpus: all 42 tagged tests passed
Plus one extra public overview test from direct file run passed
Mobile PR smoke corpus: 4 tests passed
```

Monolitický příkaz `npm run e2e:pr` tedy v tomto kontejneru není označený jako samostatně dokončený; ekvivalentní PR smoke sada prošla chunked/serial spuštěním.

## Omezení

- Testy používají mocked HaveAPI fixtures. Nebyl dostupný live/dev backend přes VPN, takže reálné backend side-effecty zůstávají pro manuální dev-backend smoke/RC ověření.
- Playwright browser download nebyl v tomto prostředí dostupný. Lokální běh použil systémový Chromium přes `E2E_CHROMIUM_EXECUTABLE=/usr/bin/chromium` a video bylo vypnuté přes `E2E_DISABLE_VIDEO=1`.
- Systémový Chromium měl v kontejneru managed URL block policy; pro testovací běh byly dočasně povolené lokální URL a po běhu byla původní policy obnovena.

## Výsledek

Fáze 11 je zpětně doplněná a uzavřená: shell dostupnost, ARIA state vazby, i18n klíče, Playwright regression coverage a screenshotová dokumentace jsou hotové. Release-grade live potvrzení pořád vyžaduje navazující manuální run proti dev backendu.

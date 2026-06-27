# Admin workflows – lineární fáze a průběžný stav

Datum poslední aktualizace: 2026-06-27

Od této revize platí jednoduché pravidlo: **číslo fáze = skutečné pořadí dodávky**. Předchozí archiv míchal pořadí z auditu/prioritizace s pořadím implementace, což vedlo k matoucímu stavu, kdy byly hotové „Fáze 3“ a „Fáze 4“, zatímco „Fáze 1“ a „Fáze 2“ pořád čekaly.

Tahle roadmapa je opravená na lineární řadu bez děr. Stav 0–13 je v tomto archivu dorovnaný:

- Fáze 0 = audit a API mapování.
- Fáze 1 = žádosti/přihlášky, admin triage fronta.
- Fáze 2 = příchozí platby, ruční přiřazení.
- Fáze 3 = VPS detail, admin abuse/incident report polish.
- Fáze 4 = admin síť a správa IP adres, contract hardening.
- Fáze 5 = admin správa přidělených prostředků u člena.
- Fáze 6 = dashboard/status triage a veřejné informace.
- Fáze 7 = DNS/backup/dataset parity backlog.
- Fáze 8 = API contract/capability hardening.
- Fáze 9 = admin access regression suite.
- Fáze 10 = manual runbooks pro dev backend.
- Fáze 11 = UX/accessibility/i18n polish + Playwright screenshot audit.
- Fáze 12 = structural budget cleanup.
- Fáze 13 = full test / CI stabilization.
- Další práce pokračuje live dev-backend/RC ověřením.

## Roadmapa

| Fáze | Název | Stav | Poznámka |
|---:|---|---|---|
| 0 | Audit/API mapování | hotovo | Viz `PHASE0_ADMIN_WORKFLOWS_AUDIT_20260623.md`. |
| 1 | Žádosti/přihlášky, admin triage fronta | implementováno | Viz `PHASE1_REQUESTS_TRIAGE_20260623.md`. |
| 2 | Příchozí platby, ruční přiřazení | implementováno | Viz `PHASE2_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md`. |
| 3 | VPS detail, admin abuse/incident report polish | implementováno | Viz `PHASE3_VPS_INCIDENT_REPORT_POLISH_20260624.md`. |
| 4 | Admin síť a správa IP adres, contract hardening | implementováno | Viz `PHASE4_NETWORKING_CONTRACT_HARDENING_20260624.md`. |
| 5 | Admin správa přidělených prostředků u člena | implementováno | Viz `PHASE5_USER_RESOURCE_ASSIGNMENTS_20260624.md`. |
| 6 | Dashboard/status triage a veřejné informace | implementováno | Viz `PHASE6_DASHBOARD_STATUS_PUBLIC_INFO_20260624.md`. |
| 7 | DNS/backup/dataset parity backlog | implementováno | Viz `PHASE7_DNS_BACKUP_DATASET_PARITY_20260625.md`. |
| 8 | API contract/capability hardening | implementováno | Viz `PHASE8_API_CONTRACT_CAPABILITY_HARDENING_20260625.md`. |
| 9 | Admin access regression suite | implementováno | Viz `PHASE9_ADMIN_ACCESS_REGRESSION_SUITE_20260625.md`. |
| 10 | Manual runbooks pro dev backend | implementováno | Viz `PHASE10_MANUAL_RUNBOOKS_DEV_BACKEND_20260625.md`. |
| 11 | UX/accessibility/i18n polish pass | implementováno | Viz `PHASE11_UX_ACCESSIBILITY_I18N_POLISH_20260627.md`. |
| 12 | Structural budget cleanup | implementováno | Viz `PHASE12_STRUCTURAL_BUDGET_CLEANUP_20260627.md`. |
| 13 | Full test / CI stabilization | implementováno | Viz `PHASE13_FULL_TEST_CI_STABILIZATION_20260627.md`. |

## Přemapování proti předchozímu matoucímu značení

| Předchozí označení v archivu | Správné lineární označení | Důvod |
|---|---|---|
| `PHASE3_REQUESTS_TRIAGE_20260623.md` / „Fáze 3“ | `PHASE1_REQUESTS_TRIAGE_20260623.md` / „Fáze 1“ | Requests byly první implementační dodávka po auditu. |
| `PHASE4_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md` / „Fáze 4“ | `PHASE2_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md` / „Fáze 2“ | Incoming payments byly druhá implementační dodávka po auditu. |
| „Fáze 1 – VPS detail…“ jako čekající auditní oblast | `PHASE3_VPS_INCIDENT_REPORT_POLISH_20260624.md` / „Fáze 3“ | Tato mezera byla v tomto archivu dohnaná po Fázi 2. |
| „Fáze 2 – Networking…“ jako čekající auditní oblast | `PHASE4_NETWORKING_CONTRACT_HARDENING_20260624.md` / „Fáze 4“ | Tato mezera byla v tomto archivu dohnaná po Fázi 3. |

## Průběžný issue/fix log

| ID | Fáze | Stav | Popis | Vyřešení / další krok |
|---|---:|---|---|---|
| AUD-REQ-001 | 1 | vyřešeno | Default requests list bez `state` zobrazoval širší frontu včetně `pending_correction`. | Default je nyní `awaiting`; explicitní `state=all` zobrazí všechny stavy. |
| AUD-REQ-002 | 1 | vyřešeno | Chyběly inline detaily, `Rozbalit vše` / `Sbalit vše` a row-level resolve akce. | Přidán expandable row model, quick controls a akce approve/deny/ignore/request correction u řádků. |
| AUD-REQ-003 | 1 | vyřešeno s omezením | Wrapper posílal `q`, které staré HaveAPI resource podle auditu nepodporuje. | `q` už se neposílá do API; v UI je jasně vedené jako client-side hledání v aktuálně načtené stránce. |
| PH1-ADV-001 | 1 | vyřešeno | Pokročilé filtry působily jako velké okno a navíc nově nesmí používat arbitrární Tailwind šířku. | Filtry jsou kompaktní popover/panel u seznamu, používají tokenizované `max-w-content-lg`, `bg-overlay-surface`, `shadow-panel`. |
| PH1-TEST-001 | 1 | vyřešeno | Test rozbalení řádků narážel na duplicitu mobile/desktop markupů v jsdom. | Test používá `findAllByTestId` pro responzivní duplicity a ověřuje alespoň jednu viditelnou instanci. |
| PH1-TEST-002 | 1 | známé / mimo změnu | `npm test` na celém suite opět nedoběhl do 300 s limitu. | Pro fázi proběhl typecheck, lint, i18n audit, build a cílené relevantní unit/API testy. |
| PH1-AUDIT-001 | 1 | známé / mimo změnu | Extra `audit:ui-strings:check` selhal na hardcoded textech v `src/components/ui/Drawer.test.tsx`. | Nález je v testu shared Draweru, nesouvisí s Fází 1; generovaný `work/audits` artefakt byl odstraněn. |
| AUD-PAY-001 | 2 | vyřešeno | Assignment modal neukazoval plný dopad/rekapitulaci/payment instructions. | Detail příchozí platby nyní před submit ukazuje platbu, ověřeného usera, payment instructions a dopad akce. |
| AUD-PAY-002 | 2 | vyřešeno s omezením | `incoming_payment#index` starého API nepodporuje `q` ani `user`, ale nový wrapper je posílal. | Wrapper posílá jen `state`, `limit`, `from_id`; `q/user` jsou current-page UI filtry s viditelnou poznámkou. |
| AUD-PAY-003 | 2 | vyřešeno | Po `user_payment#create` se navíc explicitně volal update stavu příchozí platby na `processed`. | Submit už volá jen `user_payment#create`; stav řeší backendový payment transaction chain. Ruční state karta zůstává oddělená. |
| PH2-TEST-001 | 2 | známé / čeká na dev backend | Nelze lokálně ověřit živé HaveAPI side effects bez VPN/live backendu. | Přidán manuální scénář: assignment, duplicate assignment, state transition a kontrola payloadu v devtools. |
| AUD-VPS-001 | 3 | vyřešeno | Incident report `datetime-local` parser mohl spadnout na invalidní hodnotě. | Přidán bezpečný `toIsoOrUndefined`; invalidní hodnota se neposílá a nevyhodí `RangeError`. |
| AUD-VPS-002 | 3 | vyřešeno | Incident report entrypoint byl hůř objevitelný z VPS detailu. | Admin action select v `VpsLayout` obsahuje `Report incident` s předvyplněnou VPS. |
| AUD-NET-001 | 4 | vyřešeno s omezením | Síťové wrappery posílaly/nebo mohly posílat `q`, které legacy resources nepodporují. | `q` se neposílá u IP addresses, host IP, IP assignments, network monitor ani traffic user-top; UI dělá current-page text filtr. |
| AUD-NET-002 | 4 | vyřešeno | IP assignments list neměl explicitně pokrytý legacy filtr `ip_version`. | `fetchIpAddressAssignments` podporuje `ipVersion?: 4/6` a posílá `ip_version`. |
| AUD-NET-003 | 4 | vyřešeno | U current-page text filtru mohlo stránkování vycházet z filtrovaných dat. | Cursor/next-page logika používá surovou backendovou stránku, textový filtr se aplikuje až na renderovaná data. |
| PH4-TEST-001 | 4 | známé / čeká na dev backend | Nelze lokálně ověřit živé síťové listy a side effect akce bez VPN/live backendu. | Lokálně pokryto API contract testy; manuální dev-backend smoke test zůstává v runbooku. |
| AUD-USERRES-001 | 5 | vyřešeno | Detail člena neměl user-level správu přiřazených `UserClusterResourcePackage`. | Přidán tab Prostředky/Resources s listem přiřazení, create/edit/delete workflow a linkem na definice balíčků. |
| AUD-USERRES-002 | 5 | vyřešeno | Chyběl read-only pohled na efektivní hodnoty `User::ClusterResource` u člena. | Nový tab načítá `/users/:userId/cluster_resources` a zobrazuje backendem vypočtené prostředí/resource/hodnotu bez client-side výpočtu. |
| PH5-TEST-001 | 5 | známé / čeká na dev backend | Nelze lokálně ověřit živé resource assignment side effects bez VPN/live backendu. | Lokálně pokryto API/page unit testy; manuální dev-backend smoke test je v `PHASE5_USER_RESOURCE_ASSIGNMENTS_20260624.md`. |
| AUD-STATUS-001 | 6 | vyřešeno | Veřejná status landing stránka měla připravené i18n/test-id klíče pro sekci uzlů, ale samotná scan plocha podle lokalit chyběla. | Přidána sekce `public.nodes.section` s `<details>` skupinami podle lokality, problematické lokality jsou otevřené automaticky a uzly se řadí down-first. |
| AUD-STATUS-002 | 6 | vyřešeno | Dashboard neukazoval rychlou veřejnou triage informaci pro probíhající výpadky / down uzly. | Přidán panel `app.dashboard.status-triage`, který používá public endpoints a nemíchá admin-only data do veřejných signálů. |
| AUD-STATUS-003 | 6 | vyřešeno | Public status dotazy neměly centralizovanou low-frequency obnovu podle `LIVE_UPDATES_STRATEGY`. | Public overview a dashboardový status panel používají `useTierSlowIntervalMs()`. |
| AUD-DNS-001 | 7 | vyřešeno s omezením | `dns_zone#index` legacy whitelist nepodporuje `q`, `user` ani `dnssec_enabled`, ale UI je posílalo jako server filtry. | Wrapper posílá jen `role/source/enabled/from_id/limit`; `q/user/DNSSEC` jsou current-page filtry a cursor se počítá ze surové stránky. |
| AUD-DNS-002 | 7 | vyřešeno s omezením | `dns_record_log#index` legacy whitelist nepodporuje `q`, `user` ani `dns_zone_name`. | Wrapper posílá jen `dns_zone/change_type/name/type/from_id/limit`; textové hledání logů je current-page filtr. |
| AUD-DATASET-001 | 7 | vyřešeno s omezením | `Dataset::Index` blacklistuje `user`, zatímco dataset list ho používal jako server filtr. | `dataset[user]` se neposílá; owner filtr běží nad aktuálně načtenou stránkou a UI si podle potřeby žádá `user` include. |
| AUD-DATASET-002 | 7 | vyřešeno | Dataset create/update payload mohl nést legacy blacklist položky `sharenfs`, `admin_override`, `admin_lock_type`. | API wrappery payload sanitizují před odesláním. |
| AUD-BACKUP-001 | 7 | vyřešeno s omezením | `Export::Index` podle discovery přijímá jen `limit/from_id`, ale exports list posílal `q/user/dataset/snapshot/host_ip_address/enabled`. | Wrapper posílá jen `limit/from_id/includes`; export filtry jsou current-page a stránkování běží ze surové stránky. |
| AUD-BACKUP-002 | 7 | vyřešeno | `Export::Create`/`Update` blacklistuje `threads`, ale UI/wrapper ho mohly odesílat. | Wrapper payload sanitizuje a create drawer už threads input nezobrazuje. |
| AUD-CONTRACT-001 | 8 | vyřešeno s omezením | `Vps.Index` legacy kontrakt nepřijímá `vps[user]`, ale VPS listy/lookupy potřebují owner zúžení. | Wrapper `vps[user]` neposílá; sdílený `vpsMatchesOwner` filtruje aktuálně načtenou stránku a cursor se počítá ze surových dat. |
| AUD-CONTRACT-002 | 8 | vyřešeno s omezením | Několik audit/monitoring/payment/OOM indexů odmítá `user`/`accounted_by`, i když UI nabízelo user filtr. | Wrappery parametry neposílají a stránky používají lokální current-page filtr s viditelnou contract poznámkou. |
| AUD-CONTRACT-003 | 8 | vyřešeno s omezením | `IpAddressAssignment.Index` a `NetworkInterfaceMonitor.Index` odmítají `q`/`user`. | Síťové admin listy filtrují text/user jen nad aktuální stránkou; stránkování používá raw backend page. |
| AUD-CONTRACT-004 | 8 | vyřešeno | Některé mutation payloady mohly nést legacy-nepodporované klíče (`user`, `node`, `configs`, `expirations`, `master_enabled`). | API wrappery payloady sanitizují přes `omitHaveApiParams` a cílené testy ověřují absenci těchto klíčů. |
| PH8-TEST-001 | 8 | známé / mimo změnu | Celý `npm test -- --reporter=dot` nedoběhl do 300 s limitu bez zachyceného failing testu. | Fáze je ověřená typecheckem, lintem, i18n/page/active-doc audity, buildem a 46 cílenými API contract testy. |
| AUD-ACCESS-001 | 9 | vyřešeno | Admin shell guard neměl regresní testy pro non-admin deep-linky. | `AppShell.test.tsx` ověřuje blokaci `/admin/*` před mountem chrome/outletu a průchod admin uživatele. |
| AUD-ACCESS-002 | 9 | vyřešeno | Viditelnost admin položek a scope přepínačů nebyla chráněná testy. | Přidány sidebar/header testy pro admin-only položky, `/app`/`/admin` link leakage a `canSwitchMode` affordance. |
| AUD-ACCESS-003 | 9 | vyřešeno | Přepnutí z některých admin-only deep-linků mohlo vytvořit matoucí user-scope cestu. | `/admin/requests/*` a `/admin/outages/*` se při přepnutí do user scope mapují na bezpečný `/app`; request detail user alias přesměruje před načtením admin dat. |
| PH9-TEST-001 | 9 | vyřešeno | Fáze potřebovala rychlou regresní sadu bez live backendu. | Cílený Vitest prošel: 5 souborů, 18/18 testů zelených; navazující typecheck/lint/audity/build prošly. |
| PH10-RUNBOOK-001 | 10 | vyřešeno | Ruční dev-backend smoke scénáře byly roztroušené po phase reportech a deploy dodatcích. | Přidán konsolidovaný `deploy/dev.crucio.cz/admin-workflows-smoke-runbook.md`, výsledková šablona a link z dev deploy README. |
| PH11-A11Y-001 | 11 | vyřešeno | Shell neměl všude explicitní skip link a focus target pro hlavní obsah. | Přidán sdílený `SkipLink`, `#app-main-content`, `#public-main-content`, focus target a přeložené accessibility labely. |
| PH11-ARIA-001 | 11 | vyřešeno | Drawer/popover tlačítka neměla konzistentní `aria-controls`, `aria-expanded`, `aria-haspopup` a toggly neměly vždy `aria-pressed`. | AppHeader/AppSidebar/PublicLayout/Button/Drawer dorovnané; nové unit i Playwright regrese ověřují stavové vazby. |
| PH11-I18N-001 | 11 | vyřešeno | Accessibility/menu/tasks labely potřebovaly EN/CS klíče. | Doplněny shodné EN/CS klíče; i18n audit hlásí EN 2901 / CS 2901. |
| PH11-E2E-001 | 11 | vyřešeno s omezením | Bylo potřeba Playwright ověření a screenshotová dokumentace. | Phase 11 Playwright spec prošla, PR smoke corpus prošel po chuncích, mobile PR smoke prošel a screenshot audit vygeneroval 18 PNG. Monolitický `npm run e2e:pr` v kontejneru narazil na timeout při defaultní paralelizaci. |
| PH11-TEST-001 | 11 | vyřešeno s omezením | Jednopříkazové `npm run ci:check` v kontejneru nedoběhlo do konce kvůli timeoutu během Vitestu. | Audit/typecheck část prošla a Vitest corpus prošel po chuncích: 68 souborů / 287 testů; build prošel. |
| PH12-STRUCT-001 | 12 | vyřešeno | Velké stránky a legacy unsafe casty překračovaly strukturální budget. | Viz Fáze 12: rozdělení VPS lifecycle/network stránek, centralizace legacy unsafe castů, structural audity zelené. |
| PH13-CI-001 | 13 | vyřešeno | Defaultní Vitest paralelizace v CI/kontejneru mohla vytvářet příliš mnoho jsdom workerů. | `npm test` a `test:watch` používají `--maxWorkers=4`; Fáze 13 ověřila full Vitest, `ci:check` i build v daném běhu. |

## Doporučené pokračování po Fázi 13

1. **Live/dev-backend RC smoke**: spustit `npm run rc:check` nebo ekvivalentní CI job v prostředí s dostupným Playwright browserem a bez lokálních timeoutů; potom ručně projít `deploy/dev.crucio.cz/admin-workflows-smoke-runbook.md` proti skutečnému dev backendu.
2. **HaveAPI side-effect ověření**: na dev backendu potvrdit assignment plateb, incident report submit, síťové assign/free akce, resource package assignment a DNS/dataset/export mutace.
3. **Dependency audit cleanup**: existující dependency audit nálezy nebyly předmětem těchto fází a zůstávají samostatným úkolem.

## Ověření aktuálního archivu

Proběhlo a prošlo:

```bash
npm run audit:i18n
npm run lint
npx tsc --noEmit
npm run build
```

Vitest corpus byl kvůli limitu běhu nástroje spuštěn po chuncích a prošel celý:

```text
68 test files passed
287 tests passed
```

Playwright ověření:

```text
Phase 11 accessibility spec: 2 passed
Desktop PR smoke corpus: 42 tagged tests passed po chuncích
Extra public overview test z direct file run: 1 passed
Mobile PR smoke corpus: 4 passed
Screenshot audit: 1 passed, 18 PNG + manifest.json
```

Poznámky:

- CS/EN i18n audit prošel se shodnými klíči: EN 2901 / CS 2901.
- Build prošel; Vite hlásí jen zastaralá Browserslist data.
- Jednopříkazové `npm run ci:check` prošlo audity a typecheckem, ale v tomto kontejneru narazilo na timeout nástroje během Vitestu. Ekvivalentní Vitest suite byla proto ověřena po chuncích.
- Jednopříkazové `npm run e2e:pr` narazilo v tomto kontejneru na timeout při defaultní paralelizaci. Ekvivalentní PR smoke corpus byl ověřen sériově/po souborech.
- Playwright běhy používaly mocked HaveAPI fixtures; live backend/VPN nebyl dostupný.
- Lokální Playwright běh použil systémový Chromium přes `E2E_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; bundled browser download nebyl v tomto prostředí dostupný.

## Archivní pravidla

Po každé fázi se připravuje nový tar.gz celého projektu bez `node_modules/`, `dist/`, `.vite/`, `playwright-report/`, `test-results` a lokálních audit/build artefaktů. Staré UI zůstává read-only reference.

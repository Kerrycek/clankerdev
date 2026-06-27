# Fáze 0 – audit admin workflow parity

Datum: 2026-06-23
Snapshot: `clankerdev-gptpro-admin-network-requests-payments-20260623-140535`
Rozsah: pouze `new-ui-clankerdev`; `old-ui-vpsadmin` použito jako read-only referenční implementace.

## Poznámky k auditu

- V snapshotu není přítomný `UI_REDESIGN.md`, na který odkazují některé interní dokumenty. Pro tento audit je proto jako aktuální zadání použit root soubor `PROMPT_CZ.md` v předaném archivu.
- Nebyl dostupný live backend/VPN, takže API chování je ověřené staticky proti starému UI a starým HaveAPI resource souborům.
- Nové UI už obsahuje většinu admin workflow ploch z auditu. Tahle fáze tedy není „green-field“ návrh, ale re-audit stavu po rozpracované implementaci.

## Souhrn

Největší hotové části:

- Admin shell má centrální guard: `/admin` vyžaduje `auth.canUseAdminUi` v `AppShell`.
- Incident report flow existuje na `/admin/incidents/new?vps=...`, používá `incident_report#create` a z detailu VPS je dostupný admin-only odkaz.
- Admin networking má nové routy, IP detail, owner editaci, routování/free a host IP CRUD/assign/free/PTR flow.
- Requests mají admin list, detail a resolve modal pro registrace i změny.
- Incoming payments mají list, detail, změnu stavu a základní ruční přiřazení přes `user_payment#create`.

Největší otevřené parity problémy:

- Requests list se výchozím prázdným `state` zobrazuje i `pending_correction`; staré UI defaultně triagovalo `awaiting`.
- Requests list nemá inline rozbalení detailů, „rozbalit/sbalit vše“ ani row-level approve/deny/ignore/request-correction akce jako staré UI.
- Incoming payments detail umí přiřadit platbu, ale před potvrzením neukazuje plný recap dopadu, payment instructions ani bezpečný kontext vybraného uživatele.
- Některé nové listy posílají parametry, které staré HaveAPI resource nepodporují (`q` u requests/incoming payments, `user` u incoming payments). Bez live backendu je to riziko kompatibility.
- Incident report datum parser může při ručním nevalidním `datetime-local` vstupu vyhodit výjimku před zachycením validace.

## Auditní tabulka

| Oblast | Staré UI / zdroj pravdy | Nové UI | API resource / action | Stav | Rozdíly a riziko | Doporučený krok |
|---|---|---|---|---|---|---|
| VPS detail → admin incident/abuse report | `webui/pages/page_incidents.php`, `webui/forms/incidents.forms.php`; formulář vytváří report pro VPS, načítá aktivní `ip_address_assignment`, používá API metadata pro `vps_action`. | `src/pages/app/admin/IncidentReportNewPage.tsx`; route `/admin/incidents/new`; admin-only chip v `VpsOverviewPage` vede na `?vps=<id>`. | `incident_report#index/show/create`, `ip_address_assignments#index`, `vps#show`. Create parametry: `vps`, `subject`, `text`, volitelně `codename`, `detected_at`, `ip_address_assignment`, `cpu_limit`, `vps_action`. | Většinově implementováno. | V header action selectu ve `VpsLayout` není „report incident“, jen chip v overview. `vps_action` je hardcoded, i když staré UI bralo choices z API metadata; hodnoty teď odpovídají starému modelu (`none`, `stop`, `suspend`, `disable_network`), ale dynamic metadata by bylo bezpečnější. `toIsoOrUndefined()` může spadnout na invalid Date. Chybí live smoke test. | Fáze 3.1: opravit safe datetime parsing, přidat akci i do admin VPS action selectu nebo jasně ponechat v admin kartě, přidat unit test na payload a manuální test scénář. |
| Admin incident list/detail | Staré incident pages umí list/detail a návazné odkazy na VPS/IP assignment. | `src/pages/app/incidents/IncidentsPage.tsx` a `IncidentReportDetailPage.tsx` existují v app/admin módu. | `incident_report#index/show`. | Implementováno mimo hlavní novou create flow. | Nutno ověřit, zda admin/user rozsahy přesně sedí se starým API output blacklistem/restrictem. | Zařadit do fáze 3 testů: list/detail access matrix admin vs user. |
| Admin networking – IP list/detail | `webui/pages/page_networking.php`, `webui/forms/networking.forms.php`; owner edit, route assign/free, assign with host address, host IP create/update/delete/assign/free, assignments list. | Routené pod `/admin/networking/*`, plus legacy aliasy. `IpAddressDetailPage` má owner edit, route assign/free, host IP akce a PTR update. | `ip_address#index/show/update/assign/assign_with_host_address/free`; `host_ip_address#index/create/update/delete/assign/free`; `ip_address_assignment#index`. | Z velké části implementováno. | Některé list filtry je nutné ověřit proti resource inputům. `ip_address#index` podporuje `assigned_to_interface`, `role`, `purpose`, `addr`, `prefix`, `user`, `vps`, ale ne obecné `q`. `host_ip_address#index` podporuje `assigned`, `routed`, `user`, `vps`, `addr`, ale ne obecné `q`. `networking` layout používá absolutní `/admin/...` cesty. | Fáze 4.1: srovnat všechny wrapper parametry s resource inputy, odstranit/guardovat nepodporované `q`, přidat kontraktové testy request body a ruční backend scénáře. |
| Admin networking – owner edit | Staré UI při změně vlastníka volá `ip_address#update`; pokud je user nastaven, musí být dodané environment; API odmítá chown IP patřící VPS v prostředí s `user_ip_ownership`. | `IpAddressDetailPage` má `UserLookupInput`, environment select a volá `updateIpAddress`. | `ip_address#update` s namespace `ip_address`, parametry `user`, `environment`. | Implementováno. | UI validace odpovídá hlavnímu API požadavku, ale bez live backendu není ověřený error path `cannot chown IP while it belongs to a VPS`. | Ve fázi 2 přidat manuální test s IP přiřazenou k VPS a s volnou IP. |
| Admin networking – route assign/free | Staré UI rozlišuje route-only `assign`, route with host address `assign_with_host_address`, free route; admin může při unassign volit disown + free. | `IpAddressDetailPage` obsahuje route assign/free a host address flow. | `ip_address#assign`, `ip_address#assign_with_host_address`, `ip_address#free`. | Implementováno, drobné parity otázky. | Není zřejmé, zda existuje kombinovaná akce „free + disown“ jako ve starém UI. | Ve fázi 2 rozhodnout: buď přidat checkbox disown před free, nebo explicitně ponechat oddělené owner edit + free s varováním. |
| Admin networking – assignments/history/live/traffic | Staré UI má IP assignments, live monitor, top traffic by users. | Nové UI má `IpAddressAssignmentsPage`, `LiveNetworkMonitorPage`, `TrafficUsersPage`. | `ip_address_assignments#index`; network monitor/traffic wrappers. | Implementováno jako plochy, neověřeno live. | Bez backendu neověřený polling, prázdné/error stavy a query parametry. | Fáze 4.2: manuální testy proti dev backendu, neimplementovat naslepo. |
| Requests – admin triage list | Staré UI `approval_requests` defaultně používá `state=awaiting`, umí typ registration/change/all, inline detail a approve/deny/ignore odkazy u řádku. | `RequestsPage` existuje, admin-only v menu a route guard přes `/admin`; podporuje type/state/user/admin/api/client filtry a smart input. | `user_request/registrations#index`, `user_request/changes#index`. | Částečně implementováno. | Prázdný state v novém UI znamená „vše kromě closed“, tedy zahrnuje i `pending_correction`. To je širší než starý triage default. Chybí inline detail, expand/collapse all a akce přímo u řádku. `q` filtr není ve starém BaseResource inputu. | Fáze 1.1: nastavit default `state=awaiting`, `pending_correction` nechat explicitním quick filtrem; přidat expandable rows a row-level akce. |
| Requests – admin detail/resolve | Staré API má `resolve` pro registration/change: `approve`, `deny`, `ignore`, `request_correction`, `reason`, plus request-specific override parametry; admin-only. | `RequestDetailPage` má resolve modal, umí registration options `activate`, `create_vps`, `node`, override sekci a sleduje action state. | `user_request/registrations/:id/resolve`, `user_request/changes/:id/resolve`. | Většinově implementováno. | Modal nabízí všechny akce bez výrazného stavu/capability gatingu; API sice chrání neplatné přechody, ale UX by mělo ukázat dostupné akce podle stavu. | Fáze 1.2: stavově omezit/varovat akce, přidat reason/override rekapitulaci před submit. |
| Requests – user/member přístup | Staré API dovoluje non-admin index jen na vlastní user scope a blacklists admin výstupy; zadání chce v novém UI admin-only queue. | `/app/requests` route v routeru zůstává, ale stránka při non-admin redirectuje na `/app`; sidebar položku ukazuje jen admin mode. | Stejné user_request resources. | Prakticky admin-only UI, ale route je historicky přítomná. | Manuální vstup `/app/requests` skončí redirectem, což odpovídá zadání; duplicita route může mást budoucí maintainery. | Fáze 1.1: ponechat redirect a přidat test, případně odstranit user route alias po ověření deep-link compatibility. |
| Incoming payments – list | Staré UI listuje incoming payments podle `state`, limit/from_id. | `IncomingPaymentsPage` má state, smart search, user lookup, q a keyset pagination. | `incoming_payment#index`. | Částečně implementováno. | Starý `incoming_payment#index` má input jen `state` a limit/paginaci; `q` a `user` v novém wrapperu jsou rizikové bez potvrzení nové API podpory. | Fáze 2.1: list parametry stáhnout na ověřené `state/limit/from_id`, nebo `q/user` posílat jen přes capability/metadata guard. |
| Incoming payments – detail/state | Staré detail UI umožňuje ruční změnu `state`. | `IncomingPaymentDetailPage` umožňuje změnit stav na `queued`, `unmatched`, `processed`, `ignored`. | `incoming_payment#show/update`. | Implementováno. | Bez live API neověřená validace stavů a chování po `user_payment#create`. | Fáze 2.1: manuální test všech stavů na dev backendu. |
| Incoming payments – manual assignment | Staré UI přiřazuje neprocessed payment přes `user_payment#create` s `user` a `incoming_payment`; neřeší rozšířený UX recap. | Detail modal volá `createUserPayment({ incoming_payment, user })`, sleduje action state a poté se pokusí nastavit incoming payment na `processed`. | `user_payment#create`, volitelně `incoming_payment#update`, `users/:id/get_payment_instructions`. | Základ implementován, UX neúplné. | Chybí explicitní recap dopadu před potvrzením: vybraný user, částka, měna, aktuální paid-until, payment instructions. Automatické `processed` po create může být redundantní; starý flow spoléhal hlavně na `user_payment#create` chain. | Fáze 2.2: přidat assignment preview/recap, načíst `get_payment_instructions`, zvážit, zda update state dělat pouze pokud API chain nezměnil stav. |
| User/member allocated resources admin view | Staré UI má admin pohledy na uživatele, VPS, IP/adresy a resource/account kontext. | V novém UI existují admin user stránky a payments page, ale tato fáze nebyla cíleně auditovaná do hloubky v aktuálním požadavku. | Typicky `user#show`, `vps#index`, `ip_address#index`, `host_ip_address#index`, user payment resources. | Neauditováno detailně, kandidát na další fázi. | Hrozí, že resource summary nebude konzistentní mezi user detailem, VPS detailem a networking listy. | Fáze 5: samostatný audit user detailu a allocated resources s test matrix. |
| Dashboard/status/public info triage | Staré UI má veřejné/support/status plochy oddělené od admin triage. | Nové UI má status/dashboard komponenty, ale mimo aktuální hlubší audit. | Public/status endpoints + internal dashboard data. | Neauditováno detailně. | Nemíchat admin-only data do public statusů. | Fáze 6: samostatný pass po dokončení admin actions. |
| DNS/backup/dataset backlog | Ve starém UI existují další legacy stránky mimo scope hlavních admin workflow fází. | V novém UI nejsou v tomto auditu ověřené. | Různé resources. | Backlog. | Riziko scope creep; řešit po stabilizaci admin workflows. | Fáze 7: katalog a priorizace, ne plošná implementace bez API mapy. |
| Payload/action/resource names | Staré UI používá HaveAPI namespace bodies: `incident_report`, `ip_address`, `host_ip_address`, `registration`, `change`, `incoming_payment`, `user_payment`. | Nové API wrappers většinou namespace dodržují. | Viz jednotlivé wrappers v `src/lib/api/*.ts`. | Většinově sedí. | Hlavní riziko nejsou namespace, ale nepodporované query parametry a hardcoded action choices. | Přidat kontraktové unit testy na všechny admin wrappers a tabulku podporovaných query parametrů. |
| Loading/error/empty states | Staré UI používalo jednodušší server-rendered error/empty patterns. | Nové UI používá `LoadingState`, `ErrorState`, `EmptyState`, toast a action state tracking. | N/A | Implementováno obecně. | Neověřené edge cases: partial fail při merge registration/change listu, state update fail po incoming payment assignment, network action chain fail. | Přidat manuální test scénáře s chybou API a alespoň mocked/unit regression. |

## Doporučené pořadí pokračování

1. **Fáze 1 – Requests triage** má nejvyšší dopad na každodenní admin práci a největší parity gap. Nejprve default `state=awaiting`, pak expandable rows + row actions, potom detail modal hardening.
2. **Fáze 2 – Incoming payments** navazuje těsně: stáhnout/guardovat nepodporované list filtry, přidat assign preview s payment instructions a přesnější state handling.
3. **Fáze 3 – Incident create polish** je menší a dobře ohraničená: safe datetime, lepší discoverability, tests/manual scenario.
4. **Fáze 4 – Networking hardening** až po rychlých fixech 1/2/3, protože je širší a vyžaduje pečlivé live testy proti dev backendu.
5. **Fáze 5–7** držet jako backlog, dokud nejsou admin actions nad žádostmi/platbami/incidenty stabilní.

## Navržené doplňkové fáze

### Fáze 8 – API contract/capability hardening

Cíl: odstranit rozdíly mezi frontend wrappers a HaveAPI resource inputy dřív, než se začne přidávat další UI. Výstupy:

- `src/lib/api/*` kontraktové testy pro body namespace, URL, query parametry a `state_id` extrakci.
- Tabulka „supported params“ pro incident/request/payment/networking endpoints.
- Guard pro nepodporované filtry podle metadata/capability tam, kde frontend chce smart search nad rámec starého API.

### Fáze 9 – Admin access regression suite

Cíl: jednoznačně zabránit úniku admin-only funkcí do user módu. Výstupy:

- Testy, že `/admin/*` bez `canUseAdminUi` ukazuje admin-required screen.
- Testy, že sidebar v user módu neukazuje requests/incoming payments/networking admin položky.
- Testy, že přímé `/app/requests` deep-link chování odpovídá rozhodnutí z fáze 1.

### Fáze 10 – Manual runbooks pro dev backend

Cíl: protože není VPN/live backend ve snapshotu, mít přesné ruční scénáře pro ověření. Výstupy:

- Incident create: minimal payload, payload s IP assignment, payload s `vps_action=disable_network`, invalid datetime.
- Requests: awaiting queue, pending correction explicit filter, approve/deny/ignore/request correction, registration approve options.
- Payments: unmatched payment assignment, duplicate assignment, state transitions, selected user payment instructions.
- Networking: owner assign/clear, route-only, route-with-host, free, host PTR update, host free blocked by routed network.

### Fáze 11 – UX/accessibility/i18n polish pass

Cíl: po funkční paritě sjednotit polish bez rozbíjení API. Výstupy:

- Kontrola CS/EN klíčů pro nové admin flow.
- Klávesnice/focus handling v modalech/drawerech.
- Mobile parity pro request row actions a incoming payment assignment recap.
- Copy-link/share filters chování napříč admin stránkami.

## Známé issue log z auditu

| ID | Závažnost | Soubor / oblast | Popis | Navržená oprava |
|---|---:|---|---|---|
| AUD-REQ-001 | high | `RequestsPage.tsx` | Default bez `state` zobrazuje i `pending_correction`, ne pouze admin-actionable `awaiting`. | Default URL/query nastavit na `awaiting`; `pending_correction` dát do quick filtru. |
| AUD-REQ-002 | high | `RequestsPage.tsx` | Chybí inline detail, expand/collapse all a row-level resolve akce. | Přidat expandable row model a akční toolbar u každé žádosti. |
| AUD-REQ-003 | medium | `requests.ts` | Wrapper posílá `q`, který starý `BaseResource::Index` nemá. | Neposílat `q` bez capability nebo implementovat client-side search nad načtenou stránkou s jasným omezením. |
| AUD-PAY-001 | high | `IncomingPaymentDetailPage.tsx` | Assignment modal neukazuje plný dopad/rekapitulaci/payment instructions. | Po výběru usera načíst payment instructions a ukázat recap před submit. |
| AUD-PAY-002 | medium | `payments.ts`, `IncomingPaymentsPage.tsx` | `incoming_payment#index` starého API nepodporuje `q` ani `user`. | Guardovat nebo odstranit z API query; ponechat jen state/pagination, dokud backend nepotvrdí podporu. |
| AUD-PAY-003 | medium | `IncomingPaymentDetailPage.tsx` | Po `user_payment#create` se navíc volá update state na `processed`; staré UI tento extra krok nedělalo explicitně. | Po refetchi ověřit stav; update volat jen pokud je stále potřeba a API dovolí. |
| AUD-INC-001 | medium | `IncidentReportNewPage.tsx` | Invalid `datetime-local` může spadnout v `toISOString()` před validací. | Bezpečně kontrolovat `Number.isNaN(date.getTime())` před `toISOString()`. |
| AUD-INC-002 | low | `VpsLayout.tsx` / `VpsOverviewPage.tsx` | Report incident je dostupný v admin card, ne v hlavním action selectu. | Rozhodnout UX; buď přidat select položku, nebo card označit jako kanonické umístění. |
| AUD-NET-001 | medium | networking wrappers/pages | Nutné srovnat query params se starými resource inputy; obecné `q` není u IP/host IP resources ve starém API. | Parametrickou mapu a testy wrapperů podle starého API. |

## Minimální manuální test scénáře pro další fázi

### Requests

1. Admin otevře `/admin/requests` bez query parametrů.
2. Očekávání po opravě: list je `state=awaiting`, neobsahuje `pending_correction` bez explicitního filtru.
3. Přepnutí quick filtrem na `pending_correction` zobrazí žádosti čekající na opravu uživatelem.
4. Každý řádek lze rozbalit, sbalit a akce odpovídají stavu/API.
5. Resolve akce trackuje action state a po úspěchu refetchne list/detail.

### Incoming payments

1. Admin otevře `/admin/payments/incoming?state=unmatched`.
2. Detail platby bez usera umožní otevřít assign modal.
3. Po výběru uživatele se zobrazí user recap, payment instructions a částka/měna platby.
4. Submit volá `user_payment#create` s `user` + `incoming_payment`.
5. Po úspěchu se detail refetchne; state handling je konzistentní s API chainem.

### Incident report

1. Admin otevře VPS detail a použije admin report incident entrypoint.
2. Formulář je předvyplněný `vps`, načte aktivní IP assignmenty.
3. Minimal submit pošle `incident_report: { vps, subject, text, detected_at, vps_action }`.
4. Invalid datetime necrashuje UI a zobrazí validaci.
5. `vps_action=disable_network` projde stejným resource action chainem jako ve starém API.

### Networking

1. Admin otevře IP detail a změní owner + environment.
2. Route-only assign použije `ip_address#assign`.
3. Route-with-host použije `ip_address#assign_with_host_address`.
4. Free route použije `ip_address#free`; pokud se rozhodne pro disown, musí být jasně oddělené nebo explicitní.
5. Host IP PTR update použije `host_ip_address#update` a sleduje action state.

## Provedené kontroly v této fázi

- `npm ci` – proběhlo úspěšně; npm hlásí 11 audit nálezů v dependency tree (`1 low`, `1 moderate`, `8 high`, `1 critical`). Není opraveno v této fázi, protože jde o audit bez dependency zásahu.
- `npm run typecheck` – prošlo.
- `npx vitest run src/lib/api/incidents.test.ts src/lib/api/ipAddresses.test.ts src/lib/api/requests.test.ts src/lib/api/payments.test.ts --reporter=dot` – prošlo, 4 soubory / 15 testů.
- `npm run build` – prošlo; Vite hlásí pouze zastaralá Browserslist data.
- `npm test` – spuštěno, ale nedoběhlo do limitu 300 sekund. Pro auditní fázi byl proto ověřen typový check, build a cílené API wrapper testy.

Po ověření byly odstraněny lokálně vytvořené `node_modules/` a `dist/`, aby se do handoff archivu nedostaly dependency/build artefakty.

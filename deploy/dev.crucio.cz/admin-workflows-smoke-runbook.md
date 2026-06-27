# dev.crucio.cz admin workflows smoke runbook

Datum vzniku: 2026-06-25

Účel: sjednotit ruční smoke scénáře z admin workflow fází 1–9 do jednoho opakovatelného runbooku pro `dev.crucio.cz` a lokální test API. Runbook je určený pro lidské ověření po deployi na dev backendu, hlavně tam, kde lokální Vitest/build neumí potvrdit skutečné HaveAPI odpovědi a backendové side effecty.

## Rozsah

Runbook pokrývá:

- přístupovou hranici `/app` ↔ `/admin`, admin/non-admin preflight,
- requests triage,
- incoming payments assignment,
- incident report z VPS detailu,
- síťové/IP listy a bezpečné mutation akce,
- user resource assignmenty,
- veřejný status a dashboard status triage,
- DNS, dataset a export parity kontroly,
- zbývající API contract/capability kontroly z Fáze 8.

Mimo rozsah zůstává širší destruktivní live parity pro VPS lifecycle a dataset rollback/download akce. Pro ty používej samostatný `live-parity-workflows.md`.

## Bezpečnostní pravidla

- Testuj pouze na `https://dev.crucio.cz` proti lokálnímu test API na `admin.crucio.cz`.
- Nepoužívej produkční účty, produkční objekty, pevně zakódovaná ID ani tajné hodnoty.
- Pro akce se side effecty používej jen disposable objekty a názvy s prefixem `webui-next-live-test-*`, `webui-next-playground-*` nebo `webui-next-staging-*`.
- Destruktivní akce spusť jen tehdy, když je jasný vlastník, hostname/full dataset name, node/location, expirace a navázané IP adresy.
- U každé POST/PUT/DELETE akce si zapiš action-state ID nebo backendovou odpověď a finální stav po refetchi.
- Pokud bezpečná testovací data nejsou dostupná, scénář přeskoč a do výsledků napiš důvod. Nepřipravuj data přímým SQL naslepo.

## Předpoklady

Před začátkem měj připravené:

- admin test účet s možností otevřít `/admin`,
- běžný non-admin test účet pro access preflight,
- alespoň jednu testovací registration/change request v bezpečném stavu pro `ignore` nebo `request_correction`,
- nespárovanou incoming payment, jejíž VS odpovídá známému test user ID,
- test usera pro `/admin/users/:userId/resources`,
- dev síťová data podle `networking-smoke-data.md`, případně výstup dry-run/apply helperu `seed-networking-smoke-data.sh`,
- disposable VPS pro incident report a síťové vazby,
- disposable DNS zónu, dataset a export host/IP adresu pro parity kontroly,
- browser DevTools s otevřeným Network panelem, zapnutým `Preserve log` a filtrem na `/v7.0`.

## Jak kontrolovat requesty v DevTools

1. V Network panelu filtruj `v7.0`.
2. U GET requestů kontroluj query string v `Payload`/`Headers`.
3. U POST/PUT kontroluj JSON body a namespace, například `user_payment`, `registration`, `dataset`.
4. U current-page filtrů ověřuj dvě věci zároveň: UI zobrazí poznámku o lokálním filtrování a request neposílá nepodporovaný parametr.
5. U stránkování zkontroluj, že `from_id` a dostupnost další stránky vychází ze surové backendové stránky, ne z lokálně odfiltrovaných řádků.

## Výsledkový zápis

Pro každý blok zapiš:

```md
### <blok>
- Tester / datum:
- Prostředí: dev.crucio.cz
- Použitý test účet / role:
- Použité objekty: jen názvy nebo lokální poznámky, ne commitnuté tajné hodnoty
- Kroky: prošlo / přeskočeno / selhalo
- Request payload/query kontroly:
- Action-state ID nebo backendová odpověď:
- Finální UI/backend stav po refetchi:
- Rizika / follow-up:
```

## 0. Access a session preflight

1. Přihlas se jako admin a otevři `/admin`.
2. Ověř, že se zobrazí admin dashboard, shell chrome a scope indikátor.
3. Otevři `/app`; ověř, že user dashboard zůstává dostupný.
4. Z admin-only deep linku, například `/admin/requests`, přepni do user scope. Očekávaný bezpečný výsledek je `/app`, ne matoucí `/app/requests` deep link.
5. Přihlas se jako běžný non-admin user a otevři `/admin/requests`.
6. Očekávaný výsledek: admin shell ani cílová admin stránka se nenamountují; UI ukáže admin-required/login-required stav podle session a neproběhne načtení admin-only requests dat.

## 1. Requests triage

Cíl: ověřit Fázi 1 a regresi z Fáze 9 na reálném dev backendu.

1. Jako admin otevři `/admin/requests` bez query parametrů.
2. Ověř, že default fronta je `awaiting`; URL nemusí obsahovat `state=awaiting`.
3. Přepni quick filtr `pending_correction` a ověř odpovídající řádky.
4. Přepni `Všechny stavy`; list nesmí spadnout ani s uzavřenými/ignorovanými žádostmi.
5. Použij `Rozbalit vše`, zkontroluj inline detaily a odkazy na celý detail.
6. Na bezpečné testovací žádosti spusť `request_correction` nebo `ignore`.
7. Očekávej success toast, action state tracking a refetch listu.
8. V DevTools ověř list requesty:
   - `/user_request/registrations` neposílá `registration[q]`,
   - `/user_request/changes` neposílá `change[q]`,
   - podporované strukturované filtry, například `state`, `user`, `admin`, IP filtry, mohou zůstat server-side.
9. U resolve requestu ověř namespace:
   - `/user_request/registrations/:id/resolve` posílá `{ "registration": { "action": "ignore" | "request_correction", ... } }`,
   - `/user_request/changes/:id/resolve` posílá `{ "change": { "action": "ignore" | "request_correction", ... } }`.
10. Otevři `/app/requests` jako běžný user. Očekávaný výsledek je redirect na `/app` bez volání admin requests API.

## 2. Incoming payments assignment

Cíl: ověřit Fázi 2 proti skutečnému backendovému transaction chainu.

1. Jako admin otevři `/admin/payments/incoming?state=unmatched`.
2. Otevři detail nespárované platby, jejíž VS odpovídá známému test user ID.
3. Klikni na přiřazení platby; modal má předvyplnit kandidáta z VS.
4. Ověř, že se načte správný user, payment instructions, měsíční platba a `paid_until`.
5. Zkontroluj rekapitulaci platby: částka, měna, datum, VS, transaction id, zpráva/komentář.
6. Odešli přiřazení jen u disposable/test platby.
7. V DevTools ověř `POST /user_payments` s body:

```json
{
  "user_payment": {
    "user": 7,
    "incoming_payment": 15
  }
}
```

8. Po úspěchu ověř action state tracking, refetch detailu/listu a backendový přechod příchozí platby na `processed`.
9. Zkus duplicitní přiřazení stejné platby a ověř, že UI zobrazí srozumitelnou API chybu.
10. Samostatně ověř ruční změnu stavu v detailu; musí volat `PUT /incoming_payments/:id` s namespace `incoming_payment` a po úspěchu refetchovat detail.
11. V listu ověř, že `q`/`user` filtr neposílá `incoming_payment[q]` ani `incoming_payment[user]` a UI ho označuje jako filtr aktuálně načtené stránky.

## 3. VPS incident report

Cíl: ověřit Fázi 3 tam, kde lokální test pokryl jen parser a UI entrypoint.

1. Otevři detail disposable VPS v admin scope: `/admin/vps/:vpsId`.
2. V hlavním action selectu ověř položku `Report incident`.
3. Otevři incident formulář a ověř předvyplněnou VPS v URL/formuláři.
4. Vyplň subject/text a validní `datetime-local`; submit smí proběhnout jen pro testovací VPS.
5. V DevTools ověř `POST /incident_reports` s namespace `incident_report` a minimálně `vps`, `subject`, `text`; `detected_at` se posílá jen pro validní datum.
6. Zkus nevalidní datetime hodnotu bez odeslání destruktivních dat; UI nesmí spadnout a payload nesmí obsahovat rozbitý ISO string.
7. Po úspěchu ověř detail incidentu, action state/backend odpověď a vazbu na VPS.

## 4. Networking a IP address workflows

Cíl: ověřit Fázi 4 a síťovou část Fáze 8 na dev datech.

Před spuštěním připrav dev síťová data podle `networking-smoke-data.md`. Helper `seed-networking-smoke-data.sh` je dry-run by default; po review plánu ho spusť s `--apply` jen proti dev/local API.

1. Otevři `/admin/ip-addresses`.
2. Nastav textové hledání a kombinuj strukturované filtry.
3. V DevTools ověř, že `GET /ip_addresses` neposílá `ip_address[q]`; strukturované filtry jako `location`, `network`, `version`, `role`, `purpose`, `addr`, `prefix`, `vps`, `user`, `network_interface`, `assigned_to_interface`, `order` mohou být server-side.
4. Otevři route detail `/admin/ip-addresses/:id`; na test route ověř edit owner, assign/free route a create host address podle bezpečných dat.
5. Otevři `/admin/networking/host-ip-addresses`.
6. Ověř assigned/unassigned filtry, edit PTR, assign/free/delete host address nad disposable host IP.
7. V DevTools ověř, že `GET /host_ip_addresses` neposílá `host_ip_address[q]`.
8. Otevři `/admin/networking/ip-address-assignments`.
9. Nastav text/user filtr a IPv4/IPv6 filtr.
10. V DevTools ověř, že request neposílá `ip_address_assignment[q]` ani `ip_address_assignment[user]`, ale posílá `ip_address_assignment[ip_version]` pro IPv4/IPv6.
11. Otevři `/admin/networking/live`.
12. Nastav text/user filtr a ověř, že `GET /network_interface_monitors` neposílá `network_interface_monitor[q]` ani `network_interface_monitor[user]`; strukturované filtry jako `environment`, `location`, `node`, `vps`, `network_interface`, `order` zůstávají server-side.
13. Otevři `/admin/networking/traffic-users`.
14. Nastav textový filtr a ověř, že `GET /network_interface_accountings/user_top` neposílá `network_interface_accounting[q]`.
15. Na VPS detailu v Network tabu ověř, že přiřazené adresy a interface zůstávají čitelné po refetchi.
16. U všech listů s lokálním textovým filtrem ověř viditelnou poznámku o current-page filtrování a stránkování podle surové backendové stránky.

## 5. User resource assignments

Cíl: ověřit Fázi 5 včetně skutečného backendového přepočtu efektivních hodnot.

1. Otevři `/admin/users/:userId/resources` pro testovacího člena.
2. Ověř, že seznam přiřazení odpovídá `UserClusterResourcePackage Index` filtrovanému podle `user`.
3. Přidej balíček v jednom prostředí.
4. V DevTools ověř `POST /user_cluster_resource_packages` s body:

```json
{
  "user_cluster_resource_package": {
    "environment": 1,
    "user": 7,
    "cluster_resource_package": 20,
    "comment": "...",
    "from_personal": true
  }
}
```

5. Po úspěšném create ověř refetch tabulky přiřazení i read-only `User::ClusterResource` hodnot.
6. Uprav komentář a ověř `PUT /user_cluster_resource_packages/:id` pouze s namespace `user_cluster_resource_package.comment`; prostředí, user ani balíček se při update nemění.
7. Odeber přiřazení a ověř backendový přepočet efektivních prostředků.
8. Zkus duplicitní přiřazení stejného balíčku/prostředí a ověř, že business chybu vrací backend a UI ji zobrazí.

## 6. Public status a dashboard triage

Cíl: ověřit Fázi 6 na runtime datech veřejných endpointů.

1. Otevři `/` bez admin-only kontextu.
2. Ověř, že sekce veřejných uzlů odpovídá `/nodes/public_status`.
3. Lokality s nedostupným uzlem mají být defaultně otevřené a down uzly v dané lokalitě nahoře.
4. Veřejná karta uzlu nesmí zobrazovat admin-only data.
5. Otevři `/app` i `/admin` dashboard a zkontroluj panel `app.dashboard.status-triage`.
6. Simuluj nebo najdi stav s probíhajícím outage/down uzlem a ověř varovný stav panelu.
7. Ověř, že odkaz z dashboard panelu vede na veřejnou status stránku.
8. Zkontroluj, že refresh cadence odpovídá low-frequency public status chování; nečekej agresivní polling.

## 7. DNS, datasets a exports parity

Cíl: ověřit Fázi 7 a část payload sanitizace z Fáze 8.

### DNS zones a logs

1. Otevři `/admin/dns`.
2. Kombinuj `q`, `user`, DNSSEC, `role`, `source`, `enabled`.
3. V DevTools ověř, že `GET /dns_zones` posílá jen `dns_zone[role]`, `dns_zone[source]`, `dns_zone[enabled]`, `dns_zone[from_id]`, `dns_zone[limit]`; neposílá `dns_zone[q]`, `dns_zone[user]` ani `dns_zone[dnssec_enabled]`.
4. Otevři `/admin/dns/zones/:zoneId/logs`.
5. Nastav textový filtr a ověř, že `GET /dns_record_logs` neposílá `dns_record_log[q]`, `dns_record_log[user]` ani `dns_record_log[dns_zone_name]`; povolené jsou `dns_zone`, `change_type`, `name`, `type`, `from_id`, `limit`.
6. Vytvoř/uprav test DNS record nebo TSIG key jen v disposable zóně.
7. Payload `dns_record` ani `dns_tsig_key` nesmí obsahovat explicitní `user`, protože ownership plyne ze zóny nebo backendového kontextu.

### Dataset list a dataset payload

1. Otevři `/admin/datasets` a relevantní user/mine dataset pohled.
2. Nastav owner filtr.
3. V DevTools ověř, že `GET /datasets` neposílá `dataset[user]`; owner filtr se aplikuje nad aktuální stránkou.
4. Ověř, že stránkování používá surovou backendovou stránku, ne lokálně filtrované řádky.
5. Vytvoř nebo uprav disposable dataset.
6. Payload `dataset` nesmí obsahovat `sharenfs`, `admin_override` ani `admin_lock_type`.
7. Pokud testuješ snapshot/download akce, používej jen disposable dataset a pro destruktivní rollback/delete navazuj na `live-parity-workflows.md`.

### Exports

1. Otevři `/admin/exports`.
2. Kombinuj `q`, `enabled`, `dataset`, `user` a host/IP filtr.
3. V DevTools ověř, že `GET /exports` posílá jen `export[limit]`, `export[from_id]` a případné `_meta[includes]`; neposílá `export[q]`, `export[user]`, `export[dataset]`, `export[snapshot]`, `export[host_ip_address]` ani `export[enabled]`.
4. Vytvoř test export proti disposable datasetu/host IP.
5. Payload `export` nesmí obsahovat `threads`.
6. Ověř refetch listu/detailu a bezpečné zobrazení API chyby u nevalidní kombinace.

## 8. API contract/capability doplňky

Cíl: projít zbývající wrappery, kde Fáze 8 odstranila nepodporované parametry.

1. Otevři `/app/vps` v Mine scope a `/admin/vps` v All/admin scope.
2. V DevTools ověř, že `GET /vpses` neposílá `vps[user]`; owner zúžení je current-page filtr. Podporované server filtry jako `hostname_any`, `hostname_exact`, `node`, `user_namespace_map`, `location`, `environment` mohou zůstat.
3. Otevři OOM reports, Monitoring events, Audit a admin user History/Payments.
4. Nastav user/actor filtry a ověř:
   - `GET /oom_reports` neposílá `oom_report[user]`,
   - `GET /monitored_events` neposílá `monitored_event[user]`,
   - `GET /object_histories` neposílá `object_history[user]`, ale může poslat `object_history[user_session]`,
   - `GET /user_payments` neposílá `user_payment[user]` ani `user_payment[accounted_by]`.
5. Zkus pouze bezpečné payload preview nebo disposable submit pro:
   - DNS record/TSIG create/update bez `user`,
   - VPS clone/swap bez legacy-nepodporovaných klíčů, zejména `swap_with` bez `expirations`,
   - mount update bez `user`, `node`, `configs`, `master_enabled` a dalších lokálně odstraněných legacy klíčů.
6. U každé kontroly poznamenej konkrétní request URL/body, očekávané vynechané parametry a finální UI chování.

## 9. Ukončení runu

1. Refetchni dotčené listy/detailové stránky a ověř, že UI odpovídá backendovému stavu.
2. U disposable objektů proveď bezpečný cleanup podle samostatných runbooků nebo je označ pro pozdější ruční cleanup.
3. Do PR/release poznámek vlož souhrn:
   - které bloky proběhly,
   - které byly přeskočené kvůli chybějícím datům nebo bezpečnosti,
   - action-state ID/backend odpovědi,
   - contract nálezy v query/payloadu,
   - follow-up issue pro každý mismatch.

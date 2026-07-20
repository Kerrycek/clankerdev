# vpsAdmin WebUI Next: srovnání se starým UI a doporučení

Datum auditu: 20. 7. 2026  
Nové UI: `dev.crucio.cz`, lokální a GitHub `main` na `ddc64d2`  
Reference: staré WebUI v `/Users/kerrycze/git/vpsadmin`, dodané screenshoty a PDF

## Závěr

Nové UI už není prototyp bez funkcí. Má výrazně lepší informační hierarchii,
čitelnější formuláře, responzivní veřejnou stránku, moderní práci s úlohami,
dobré profily účtu a velmi široké pokrytí detailu VPS. Největší další přínos
nevznikne přidáváním dalších položek do menu, ale dokončením několika
konkrétních workflow, odstraněním jednoho závažného bezpečnostního problému a
zrychlením uživatelské stránky Síť.

Nejdřív je potřeba opravit schvalování žádostí. Jedno kliknutí na
„Schválit“ dnes okamžitě odešle `approve` s výchozími volbami
`create_vps=true` a `activate=true`. Připravený kontrolní dialog se vůbec
neotevře. Teprve potom dává smysl dokončit uživatelské subdatasety, hlášení
incidentů a chybějící část DNS.

## Co už je hotové a nemá se dělat znovu

- „Stavy akcí“ jsou v aktuálním zdroji odstraněné z hlavního menu. Detailní
  route může zůstat pro odkazy z Úloh a transakcí; nemá se z ní znovu dělat
  samostatná navigační sekce.
- Veřejná stránka má přepínač jazyka i před přihlášením a lokality nodů jsou
  barevně oddělené.
- Pokročilé ZFS vlastnosti datasetu jsou schované; u běžného uživatele mají
  zůstat schované.
- Primární a sekundární DNS zóna už nemají stejný detail. Sekundární zóna
  nezobrazuje editor záznamů.
- TTL DNS záznamu může zůstat prázdné a použít výchozí TTL zóny. Preview už
  není hlavní rušivou částí formuláře.
- Transakční log DNS je pod obsahem zóny, ne nad ním.
- Formuláře používají centrované modaly a za nimi zůstává vidět kontext.
- Globální stránkování už umí číslované stránky, elipsy a skok na stránku tam,
  kde API poskytuje počet nebo navštívené keyset stránky.
- Uživatelský účet už obsahuje osobní údaje, časové pásmo, heslo, MFA/TOTP,
  passkeys, relace a jejich historii, SSH klíče, tokeny metrik, e-mailové
  preference, user-data a uživatelské jmenné prostory.
- Detail VPS má silné rozdělení user/admin. Existující testy ověřují, že user
  nevidí boot timeout, vlastníka, CPU limit, admin lock/override a další
  administrátorské volby.
- OSM nahradilo Google Maps u schvalování registrací.

## Playwright proti dev.crucio.cz

Desktop suite načítala přímo nasazený JavaScript z `dev.crucio.cz`; API bylo
pro bezpečné a opakovatelné workflow mockované.

| Běh | Výsledek |
| --- | --- |
| Desktop Chromium | 257 testů: 246 prošlo, 4 selhaly, 7 přeskočeno |
| Izolovaný rerun selhání | 4 prošly, 3 zůstaly reprodukovatelné |
| Mobile smoke | 3/3 prošly |
| P0 schvalování žádostí | 1/1 reprodukovalo okamžitý POST bez dialogu |
| Veřejná stránka | reálně otevřena desktop + mobile |

Tři reprodukovatelné pády:

1. `dataset_management_actions.spec.ts` je zastaralý. Hledá skrytou ZFS
   vlastnost bez otevření pokročilé sekce; produkt se zde chová správně.
2. `session_expiry_redirect.spec.ts`: po obnovení relace zůstane viditelná
   stará hláška o vypršení relace.
3. `sync_indicator_error_retry.spec.ts`: stejná stale hláška zůstává po retry.

Autentizovaný live audit nemohl být bezpečně spuštěn, protože prostředí
neobsahovalo schválený token ani storage state a serverový token nebyl
čitelný. Test se nepokoušel přihlášení obcházet a neměnil live data.

Aktuální GitHub CI pro `ddc64d2` je zelené:

- CI: 535 unit/integration testů, 122 souborů;
- Playwright smoke: 55 desktop + 3 mobile;
- Playwright broad smoke: 106 desktop + 3 mobile.

## Co chybí: prioritizovaný backlog

### P0 — opravit před dalšími funkcemi

#### Bezpečné schvalování registrací

`RequestReviewActions` volá schválení rovnou z kliknutí. U registrace jsou
implicitně zapnuté vytvoření a aktivace VPS. Kontrolní dialog s volbou nodu a
parametrů je nedosažitelný.

Správný průchod:

1. „Schválit“ vždy otevře kontrolní dialog.
2. V dialogu jsou explicitní volby aktivace, vytvoření VPS a cílového nodu.
3. Výchozí stav nesmí dělat vedlejší operaci bez potvrzení.
4. Finální tlačítko shrne dopad a teprve potom odešle POST.
5. E2E test musí ověřit, že první kliknutí žádný POST neudělá.

### P1 — funkční mezery a skutečné regrese

| Oblast | Co chybí / nefunguje | Konkrétní návrh |
| --- | --- | --- |
| Relace | Po obnově relace zůstává staré varování o expiraci. | Po úspěšném refreshi atomicky vyčistit expired/error stav; přidat regresní test. |
| Datasety | User nemůže vytvořit ani odstranit vlastní subdataset, staré UI to umělo. | Řídit oprávnění vlastnictvím/API capability; pokročilé ZFS vlastnosti ponechat admin-only. |
| Incidenty | User umí incident jen číst, ne nahlásit. | `/app/incidents/new`, pouze vlastní VPS, CTA i z detailu VPS. |
| DNS secondary | Formulář vždy vytváří `internal_source`; sekundární zónu založit nelze. | První krok „Primární / Sekundární“, potom jen relevantní pole. |
| DNS transfer log | „Logy“ ukazují změny záznamů, ne historii transferů sekundární zóny. | Použít `dns_server_zone_transfer_log`: čas, server, stav, primary, serial, reason a message. |
| DNS TSIG/servery | Uživatel nemá správu vlastních TSIG klíčů a přiřazení vlastních serverů zóny. | User-scoped TSIG route a capability-based správa serverů; admin část zůstane oddělená. |
| Síť user | Načítání dělá jeden IP request pro každou VPS a šest traffic requestů. | Jeden filtrovaný/batch dotaz; záložky Adresy / Provoz / Živě a lazy load. |
| Security advisories | Nové UI má jen veřejné čtení a odkaz na legacy správu. | Admin CRUD, CVE, publish/retract, aktualizace, dotčené objekty a vazba na odstávku. |
| Deploy dohledatelnost | Checkout na serveru a asset webrootu nemají jednoznačně svázaný commit. | Generovat `build-info.json` se SHA a ověřovat oba weby po deployi i v CI. |

### P2 — vysoký užitek, ale neblokuje základní provoz

| Oblast | Co dodělat | Jak bez zbytečného klikání |
| --- | --- | --- |
| Síť/traffic | User live monitor a delší historii než šest měsíců; admin filtr prostředí/lokace/node/VPS. | Zachovat rychlý přehled, starší data načíst až po volbě období. Live jako záložka, ne sidebar. |
| Účet | Read-only detail balíčků a konfigurace prostředí. | Přidat do záložky Prostředky; nevytvářet další „rychlou správu účtu“. |
| Klastr/nody | Node create/edit, per-pool storage, scrub/resilver a maintenance na environment/location. | Jedna detailní stránka nodu s kartami Overview / Storage / Maintenance. |
| Platby | Globální historie, souhrn, forecast a uživatelské připomínky. | Jeden přehled, podrobnosti až po rozkliknutí; připomínky v Účet → Platby. |
| Admin síť | Plný měsíční traffic přehled. | Stejný graf jako user, navíc filtry a drill-down. |
| Audit/transakce | Místy se ukazují raw API hodnoty. | Primárně použít lokalizované `label/name` z API; lokální mapu jen pro barvu a fallback. |
| Navigace admin | Sidebar je dlouhý a provozní oblasti jsou roztržené. | Seskupit Provoz, Uživatelé/finance, Infrastruktura a Obsah; nezahlcovat dalšími root položkami. |
| Odstávky | Chybí vazba na bezpečnostní upozornění. | Detail rozdělit Přehled / Dopad / Aktualizace / Bezpečnost. |

### P3 — až po dokončení hlavních workflow

- Sjednotit plnou backup/restore paritu a případně přidat rozcestník Zálohy,
  pokud ho reálně uživatelé potřebují. Dataset plány už část potřeby pokrývají.
- Doplnit veřejné deep-linky na monitoring nodů jen pokud mají stabilní a
  veřejně bezpečný cíl.
- Přidat inicializaci nové primární DNS zóny z VPS a globální log DNS záznamů.
- Doplnit platební reminder jen pokud jej současné API stále podporuje a je
  provozně používaný.

## Parita po sekcích

| Sekce | Stav | Hlavní zbývající práce |
| --- | --- | --- |
| Veřejný status | Dobré | pouze drobný monitoring drill-down |
| Dashboard | Dobré | udržet prioritní signály, nepřidávat další karty |
| VPS | Velmi dobré | průběžná permission matrix, méně technických textů |
| Datasety/NAS | Částečné | user subdataset create/delete |
| Exporty | Dobré | bez zásadní mezery |
| DNS | Částečné | secondary create, transfer log, user TSIG/servers |
| Síť | Částečné | výkon, live monitor, delší/admin traffic |
| Transakce/Úlohy | Dobré | API lokalizované názvy; action-state jen jako detail úlohy |
| Monitoring/OOM | Dobré | bez zásadní mezery |
| Incidenty | Částečné | uživatelské nahlášení |
| Platby | Částečné | globální přehled/forecast/reminder |
| Účet | Velmi dobré | read-only balíčky a prostředí |
| Admin uživatelé | Dobré | bezpečnější destructive actions, platební instrukce |
| Žádosti | Kritická chyba | review dialog před každým schválením |
| Audit | Dobré | lokalizované názvy objektů a událostí |
| Klastr/Nody | Částečné | node CRUD, per-pool storage, širší maintenance |
| Migrace | Dobré až lepší než staré UI | bez zásadní mezery |
| Odstávky | Částečné | propojení security advisory |
| Security advisories | Chybí admin část | kompletní správa |
| Pošta/Obsah | Dobré | jen zlepšit sekundární navigaci |

## UX pravidla pro dokončení

1. **Nejčastější úkol jako výchozí obsah.** DNS primary otevře záznamy,
   secondary transfery; Síť otevře adresy; VPS detail otevře stav a akce.
2. **Progressive disclosure.** Pokročilé ZFS, nízkoúrovňové boot/cgroup a
   diagnostiku skrýt do pojmenované pokročilé sekce.
3. **Jedna dominantní akce.** Na stránce má být jeden primární CTA; destruktivní
   operace oddělit a jasně popsat dopad.
4. **Kontext místo další navigace.** Incident založit z VPS, IP přiřadit z IP i
   VPS, live traffic dát do Síť jako záložku.
5. **Typově chytré formuláře.** DNS, IP i request approval mají ukázat jen
   pole platná pro zvolený typ a lokalitu.
6. **Lazy load drahých dat.** Traffic, live monitor a hluboké logy načítat až po
   otevření záložky.
7. **API text je zdroj pravdy.** Lokalizované názvy transakcí, objektů a enumů
   převzít z API; nikdy neukazovat interní hodnotu, pokud existuje label.
8. **Stejný vzor napříč UI.** Centrovaný modal, stejný footer tabulek, stejné
   potvrzení nebezpečných akcí a stejné prázdné/error stavy.

## Co ze starého UI nepřenášet

- samostatnou položku „Stavy akcí“;
- samostatné nízkoúrovňové lifetime/API obrazovky pro běžného uživatele;
- dlouhé pravé sloupce rychlých odkazů a duplikované rozcestníky;
- formuláře, které ukazují všechna pole bez ohledu na typ objektu;
- raw interní názvy API, technické diagnostické texty a „legacy“ vysvětlení;
- oddělené stránky pro funkce, které jsou lépe dostupné přímo v kontextu VPS,
  DNS zóny, IP adresy nebo účtu.

## Doporučené pořadí další práce

### Blok A — bezpečnost a spolehlivost

1. Review modal pro schvalování registrací + regresní E2E.
2. Vyčištění stale session-expired notice + dva zelené testy.
3. Build SHA na obou deployích a automatická kontrola parity.

### Blok B — chybějící uživatelská workflow

1. Vlastní subdatasety.
2. Nahlášení incidentu z uživatelského pohledu i detailu VPS.
3. DNS secondary create + transfer log + user TSIG/servers.

### Blok C — rychlost a pohodlí

1. Síť bez N+1, záložky Adresy / Provoz / Živě a lazy load.
2. Read-only balíčky a prostředí v Účet → Prostředky.
3. Admin security advisories a vazba na odstávky.
4. Node storage/maintenance a zbytek plateb.

První konkrétní další úkol má být schvalování žádostí. Je krátký, má vysoký
dopad, dá se jednoznačně otestovat a odstraní riziko nechtěného vytvoření či
aktivace VPS. Potom lze bez přeskakování pokračovat user subdatasety a
incidenty.

## Důkazy a zdroje

- `src/pages/app/admin/RequestReviewActions.tsx`
- `src/pages/app/networking/UserNetworkPage.tsx`
- `src/pages/app/networking/UserNetworkTrafficCard.tsx`
- `src/pages/app/datasets/DatasetOverviewPage.tsx`
- `src/pages/app/vps/VpsStorageRootDatasetCard.tsx`
- `src/pages/app/dns/DnsZonesPage.tsx`
- `src/pages/app/dns/DnsZoneLogsPage.tsx`
- `src/pages/app/dns/DnsZoneServersPage.tsx`
- `src/pages/app/admin/networking/NetworkTrafficUsersPage.tsx`
- `src/pages/app/admin/AuditEventPage.tsx`
- `src/pages/app/admin/nodeDetail/NodeOverviewCards.tsx`
- staré UI: `webui/pages/page_dataset.php`, `page_incidents.php`,
  `page_networking.php`, `page_cluster.php`, `page_adminm.php` a odpovídající
  soubory ve `webui/forms/`.


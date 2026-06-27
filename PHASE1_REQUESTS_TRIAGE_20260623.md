# Fáze 1 – Žádosti/přihlášky, admin triage fronta

Datum implementace: 2026-06-23
Oprava číslování: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 1 opravuje requests admin queue tak, aby byla prakticky použitelná jako triage fronta. Defaultní `/admin/requests` už míří na akční frontu `awaiting`, `pending_correction` a historické/uzavřené stavy jsou dostupné přes explicitní filtr, a admin může řádky rozbalit i řešit přímo ze seznamu.

Běžný user je z `/app/requests` přesměrován pryč z admin requests stránky. Tím se drží rozhodnutí z auditu, že requests triage je admin-only workflow.

## Co bylo změněno

### UI chování

- Defaultní requests list bez query parametru `state` nyní používá `state=awaiting`.
- URL canonicalizace ponechává default čistý: `state=awaiting` se nemusí ukládat do query stringu; explicitní `state=all` znamená všechny stavy.
- Přidány quick filtry:
  - `awaiting`,
  - `pending_correction`,
  - `all`.
- Přidáno `Rozbalit vše` / `Sbalit vše`.
- Každý řádek má rozbalitelný inline detail se základními poli:
  - typ žádosti,
  - identita/user,
  - registrační/change detaily,
  - API/client IP + PTR,
  - admin response, pokud je k dispozici,
  - deep link na celý detail.
- U každého řádku jsou row-level akce podle aktuálního stavu:
  - `approve`,
  - `deny`,
  - `ignore`,
  - `request_correction`.
- Akce, která odpovídá aktuálnímu cílovému stavu, se u řádku nezobrazuje.
- Po úspěšné akci se:
  - sleduje `action_state_id`, pokud ho API vrátí,
  - zobrazí success toast,
  - invaliduje/refetchuje `user_request` query.
- Pokročilé filtry jsou vedené jako kompaktní popover/panel u seznamu, ne full-screen zásuvka.
- Panel používá tokenizované Tailwind utility (`max-w-content-lg`, `bg-overlay-surface`, `shadow-panel`) místo arbitrární šířky.

### API wrappery

- `fetchRegistrationRequests` a `fetchChangeRequests` už neposílají `registration[q]` / `change[q]` do HaveAPI.
- Parametr `q` v options zůstává kvůli UI query key a callsite kompatibilitě, ale je označený jako UI-only current-page search.
- Fulltext v listu je tedy záměrně **client-side hledání v aktuálně načtené stránce**, protože staré `user_request` index resources podle auditu nepodporují `q`.
- Resolve akce z listu používají existující wrappery:
  - `resolveRegistrationRequest(id, { action })`,
  - `resolveChangeRequest(id, { action })`.

### i18n

Doplněny/aktualizovány CS/EN klíče pro:

- sloupec `Akce` / `Actions`,
- `Rozbalit vše` / `Sbalit vše`,
- `Rozbalit žádost` / `Sbalit žádost`,
- `Otevřít celý detail`,
- stav `Všechny stavy`,
- popis `q` jako hledání v aktuálně načtené stránce.

### Testy

Přidán unit/page test `src/pages/app/admin/RequestsPage.test.tsx`, který ověřuje:

- `/admin/requests` bez state fetchuje registration/change requests se `state: 'awaiting'`,
- `Rozbalit vše` ukáže inline detaily a row-level akce umí zavolat resolve bez opuštění listu,
- `/app/requests` v user módu přesměruje na `/app` a nevolá admin requests API.

Rozšířeny `src/lib/api/requests.test.ts`:

- `q` se neposílá do API query parametrů,
- registration/change resolve wrappery posílají namespaced payload na správné endpointy.

## Změněné soubory

- `src/pages/app/admin/RequestsPage.tsx`
- `src/pages/app/admin/RequestsPage.test.tsx`
- `src/lib/api/requests.ts`
- `src/lib/api/requests.test.ts`
- `src/i18n/locales/en/requests.ts`
- `src/i18n/locales/cs/requests.ts`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE1_REQUESTS_TRIAGE_20260623.md`

## Ověření

Úspěšně proběhlo:

```bash
npm run lint
npm run audit:i18n
npm run typecheck
npx vitest run src/lib/api/requests.test.ts src/pages/app/admin/RequestsPage.test.tsx --reporter=verbose
npx vitest run src/lib/api/incidents.test.ts src/lib/api/ipAddresses.test.ts src/lib/api/requests.test.ts src/lib/api/payments.test.ts src/pages/app/admin/RequestsPage.test.tsx --reporter=dot
npm run build
```

Výsledky:

- `npm run lint` – prošlo.
- `npm run audit:i18n` – prošlo, CS/EN slovníky mají shodně 2857 klíčů.
- `npm run typecheck` – prošlo.
- Requests cílené testy – prošly, 2 soubory / 9 testů.
- Relevantní admin/API wrapper testy – prošly, 5 souborů / 20 testů.
- `npm run build` – prošlo; Vite hlásí pouze zastaralá Browserslist data.

Doplňkové kontroly / známé limity:

- `npm test -- --reporter=dot` bylo znovu spuštěno nad celým suite, ale nedoběhlo do 300 s limitu. Stejný limit byl zmíněn už ve Fázi 0. Pro tuto fázi proto beru jako rozhodující cílené testy, lint, i18n audit, typecheck a build.
- `npm run audit:ui-strings:check` selhalo na 2 hardcoded textech v `src/components/ui/Drawer.test.tsx` (`Page content`, `Tasks content`). Jde o existující testovací texty mimo scope Fáze 1; v této fázi nebyly měněny. Generovaný `work/audits` artefakt byl odstraněn.
- Nebyl k dispozici live backend/VPN, takže nebylo možné ověřit reálné odpovědi HaveAPI po resolve akcích.

## Zbývající rizika / nejasnosti

- Přímé row-level `approve` u registration requestu neposkytuje detailní approve volby typu `create_vps`, `activate`, `node`, pokud je staré UI vyžadovalo pro specifické případy. Detailní flow zůstává v detailu žádosti; listová akce je rychlý triage shortcut přes základní API action.
- Staré API podle auditu umožňuje hlavně `approve`, `deny`, `ignore`, `request_correction`. Samostatné „reopen/change back to awaiting“ nebylo v této fázi implementováno, protože nebyl potvrzen odpovídající resource action.
- `q` je jen hledání v aktuálně načtené stránce. Pokud bude backend chtít server-side fulltext, má se řešit ve Fázi 8 jako capability/API contract rozšíření.
- `state=all` může být objemově široké; je explicitní, nikoli defaultní.

## Manuální testovací scénář pro dev backend

1. Přihlásit se jako admin a otevřít `/admin/requests` bez query parametrů.
2. Ověřit, že se načítá akční fronta `awaiting` a URL nemusí obsahovat `state=awaiting`.
3. Přepnout quick filtr `pending_correction` a ověřit, že se zobrazí žádosti čekající na doplnění.
4. Přepnout `Všechny stavy` a ověřit, že list nepadá ani s uzavřenými/ignorovanými žádostmi.
5. Použít `Rozbalit vše`, zkontrolovat inline detaily a odkazy na celý detail.
6. Na testovací žádosti spustit `request_correction` nebo `ignore`, ověřit success toast, action state tracking a refetch listu.
7. Otevřít `/app/requests` jako běžný user; očekávaný výsledek je redirect na `/app` bez volání admin requests API.
8. V browser devtools ověřit, že list requesty neposílají `registration[q]` ani `change[q]`.

## Doporučený další krok

Pokračovat **Fází 2 – Příchozí platby, ruční přiřazení**. Po Fázi 1 je to největší zbývající business gap: detail nespárované platby potřebuje assignment recap, user lookup podle dostupných dat a přesnější kontrakt list/detail API parametrů.

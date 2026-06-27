# Fáze 2 – Příchozí platby, ruční přiřazení

Datum implementace: 2026-06-23
Oprava číslování: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 2 doplňuje detail příchozí platby o bezpečnější ruční přiřazení nespárované platby ke členovi. Admin před odesláním vidí rekapitulaci platby, ověřeného cílového uživatele, platební instrukce a očekávaný dopad. Samotné přiřazení používá stejný kontrakt jako staré UI: `user_payment#create` s payloadem `user` + `incoming_payment`.

Současně byl utažen kontrakt listu příchozích plateb. `incoming_payment#index` už nedostává nepodporované `q` ani `user` parametry; hledání podle textu/usera je v UI jasně označené jako filtr nad aktuálně načtenou stránkou. Ruční změna stavu platby v detailu zůstává dostupná jako samostatná admin akce.

## Co bylo změněno

### Detail příchozí platby

- Tlačítko přiřazení je dostupné jen pro nepřiřazené a neprocessed platby.
- Variabilní symbol se používá jako kandidát na ID uživatele, pokud je číselný.
- Assign modal umí předvyplnit kandidáta z VS a nabízí explicitní akci „použít VS“.
- Zadaný uživatel se před submit ověřuje přes detail uživatele; neověřený user submit nepropustí.
- Po výběru/ověření uživatele modal zobrazuje:
  - částku, měnu, datum, VS, transaction id a zprávu/komentář platby,
  - login/ID, jméno/e-mail, měsíční platbu a `paid_until` cílového uživatele,
  - payment instructions z `/users/:id/get_payment_instructions`, včetně kopírování,
  - dopad akce: vytvoření user payment, backendový přechod příchozí platby na processed a orientační délku prodloužení, pokud lze spočítat.
- Submit volá pouze `createUserPayment({ user, incoming_payment })`.
- Po úspěchu se sleduje `action_state_id`, zavře modal, refetchne detail a invalidují se relevantní query pro list příchozích plateb, user payments a user account.
- Explicitní post-create `updateIncomingPaymentState(..., 'processed')` byl odstraněn; podle starého flow stav řeší transakční chain `payments/create`.
- Samostatná karta pro ruční změnu stavu příchozí platby zůstává zachovaná.

### List příchozích plateb

- `fetchIncomingPayments` posílá do HaveAPI jen upstreamově podporované parametry: `state`, `limit`, `from_id`.
- Parametry `q` a `userId` zůstávají v TypeScript signatuře kvůli kompatibilitě callsite/query key, ale wrapper je neposílá do API.
- Textový filtr a user filtr se aplikují client-side nad aktuálně načtenou stránkou.
- User filtr umí použít přiřazeného usera, pokud ho API v řádku vrátí, a jako praktickou triage pomůcku také číselné `vs`/`user_ident`.
- UI zobrazuje poznámku, že `q/user` filtr je omezený na aktuálně načtenou stránku.
- Smart filter help a advanced drawer byly upraveny tak, aby neslibovaly server-side hledání, které staré `incoming_payment#index` nemá.

### i18n

Doplněny a sladěny CS/EN klíče pro:

- assignment modal,
- VS kandidáta,
- rekapitulaci platby a uživatele,
- payment instructions,
- dopad akce,
- nedostupnost přiřazení u processed/už přiřazené platby,
- current-page filter poznámku v listu.

### Testy

Přidán `src/pages/app/admin/IncomingPaymentDetailPage.test.tsx`, který ověřuje:

- VS se použije jako kandidát na user ID,
- po otevření modalu se načte a zobrazí ověřený user,
- modal ukáže payment instructions, payment recap a impact recap,
- submit volá `user_payment#create` payloadem `{ incoming_payment, user }`,
- action state se předá do `chrome.trackActionState`,
- po vytvoření user payment se už nevolá explicitní `incoming_payment#update` na `processed`.

Rozšířen `src/lib/api/payments.test.ts`:

- list příchozích plateb posílá do API jen `state` a stránkování,
- `incoming_payment[q]` ani `incoming_payment[user]` se už neposílají.

## Změněné soubory

- `src/pages/app/admin/IncomingPaymentDetailPage.tsx`
- `src/pages/app/admin/IncomingPaymentDetailPage.test.tsx`
- `src/pages/app/admin/IncomingPaymentsPage.tsx`
- `src/lib/api/payments.ts`
- `src/lib/api/payments.test.ts`
- `src/i18n/locales/en/requests.ts`
- `src/i18n/locales/cs/requests.ts`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE2_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md`

## Ověření

Úspěšně proběhlo:

```bash
npm ci
npm run typecheck
npx vitest run src/lib/api/payments.test.ts src/pages/app/admin/IncomingPaymentDetailPage.test.tsx --reporter=verbose
npm run lint
npm run audit:i18n
npx vitest run src/lib/api/incidents.test.ts src/lib/api/ipAddresses.test.ts src/lib/api/requests.test.ts src/lib/api/payments.test.ts src/pages/app/admin/RequestsPage.test.tsx src/pages/app/admin/IncomingPaymentDetailPage.test.tsx --reporter=dot
npm run build
```

Výsledky:

- `npm ci` – prošlo; npm hlásí 11 audit nálezů v dependency tree (`1 low`, `1 moderate`, `8 high`, `1 critical`). Závislosti nebyly v této fázi měněny.
- `npm run typecheck` – prošlo.
- Cílené payment testy – prošly, 2 soubory / 6 testů.
- `npm run lint` – prošlo.
- `npm run audit:i18n` – prošlo, CS/EN slovníky mají shodně 2878 klíčů.
- Relevantní admin/API wrapper testy – prošly, 6 souborů / 21 testů.
- `npm run build` – prošlo; Vite hlásí pouze zastaralá Browserslist data.

## Zbývající rizika / nejasnosti

- Nebyl k dispozici live backend/VPN, takže skutečné odpovědi HaveAPI a transakční side effect `user_payment#create` → `incoming_payment.state=processed` nebyly ověřeny proti živému prostředí.
- `q` a `user` filtr v listu příchozích plateb je záměrně jen nad aktuálně načtenou stránkou. Server-side hledání by mělo být až capability/API-contract rozšíření ve Fázi 8 nebo backend úprava.
- Odhad prodloužení v modalu je pouze orientační podle `amount / monthly_payment`; přesné `from_date` / `to_date` dál počítá backend.
- Selhání načtení payment instructions neblokuje přiřazení, protože instrukce jsou rekapitulační pomůcka. Ověření cílového usera naopak přiřazení blokuje.
- Ruční stavová akce zůstává oddělená; admin může stav měnit i mimo assignment flow, stejně jako před touto fází.

## Manuální testovací scénář pro dev backend

1. Přihlásit se jako admin a otevřít `/admin/payments/incoming?state=unmatched`.
2. Otevřít detail nespárované platby, jejíž VS odpovídá známému user ID.
3. Kliknout na přiřazení platby a ověřit, že modal předvyplní kandidáta z VS.
4. Ověřit, že se načte správný uživatel, jeho payment instructions, měsíční platba a `paid_until`.
5. Zkontrolovat rekapitulaci platby: částka, měna, datum, VS, transaction id a zpráva/komentář.
6. V browser devtools ověřit submit payload na `/user_payments`: `user_payment: { user, incoming_payment }`.
7. Po úspěchu ověřit action state tracking, refetch detailu/listu a backendový přechod příchozí platby na `processed`.
8. Zkusit duplicitní přiřazení stejné platby a ověřit, že UI zobrazí srozumitelnou API chybu.
9. Samostatně ověřit, že ruční změna stavu v detailu dál volá `incoming_payment#update` a refetchuje detail.
10. V listu ověřit, že `q`/`user` filtr neposílá do API `incoming_payment[q]` ani `incoming_payment[user]` a je označený jako filtr aktuálně načtené stránky.

## Doporučený další krok

Pokračovat **Fází 3 – VPS detail, admin abuse/incident report polish**. Je menší a dobře ohraničená: safe datetime parsing a jasnější umístění incident report akce na VPS detailu. Po ní dává smysl navázat větší **Fází 4 – Networking hardening**, případně samostatnou API contract fází, pokud bude potřeba nejdřív zpevnit wrappery.

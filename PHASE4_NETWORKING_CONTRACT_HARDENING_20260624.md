# Fáze 4 – Admin síť a správa IP adres, contract hardening

Datum implementace: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 4 dohnala síťovou oblast, která byla v předchozí roadmapě omylem ponechaná jako čekající. Hlavní oprava je contract pass síťových listů proti legacy HaveAPI: wrappery už neposílají nepodporované fulltextové `q` parametry a UI výslovně říká, kde je textové hledání pouze nad aktuálně načtenou stránkou.

Tím se sjednotilo chování s requests a incoming payments: strukturované filtry jdou na backend, volný text zůstává lokální current-page filtr, pokud ho legacy resource neumí.

## Co bylo změněno

### API wrappery

- `fetchIpAddresses` už neposílá `ip_address[q]`.
- `fetchHostIpAddresses` už neposílá `host_ip_address[q]`.
- `fetchIpAddressAssignments` už neposílá `ip_address_assignment[q]`.
- `fetchNetworkInterfaceMonitor` už neposílá `network_interface_monitor[q]`.
- `fetchNetworkTrafficUserTop` už neposílá `network_interface_accounting[q]`.
- `fetchIpAddressAssignments` nově umí legacy filtr `ip_version` přes TypeScript volbu `ipVersion?: 4 | 6`.
- Signatury ponechávají `q?: string` kvůli kompatibilitě UI/query key callsite, ale komentáře i testy označují `q` jako UI-only parametr.

### UI listy

- IP addresses list filtruje `q` lokálně nad aktuálně načtenou stránkou.
- Host IP addresses list filtruje `q` lokálně nad aktuálně načtenou stránkou.
- IP assignments list filtruje `q` lokálně nad aktuálně načtenou stránkou.
- Network live list filtruje `q` lokálně nad aktuálně načtenou stránkou.
- Network traffic users list filtruje `q` lokálně nad aktuálně načtenou stránkou.
- Cursor/next-page logika používá surová backendová data, ne už zúžený current-page text filtr, aby stránkování nezmizelo jen proto, že lokální filtr na stránce nic nenašel.

### i18n a nápověda

- Přibyl společný CS/EN klíč `filters.current_page_text_search_note`.
- IP addresses filter hint a smart-search nápověda už neslibují server-side fulltext.
- Networking stránky s aktivním `q` zobrazí poznámku, že textové hledání je omezené na aktuálně načtenou stránku a strukturované filtry dál používají backend.

### Testy

Rozšířen `src/lib/api/ipAddresses.test.ts`, který ověřuje:

- `ip_address#index` neposílá `q` a dál posílá podporované strukturované filtry,
- `host_ip_address#index` neposílá `q` a dál posílá podporované strukturované filtry,
- `ip_address_assignment#index` neposílá `q` a posílá `ip_version`,
- network monitor/user-top endpointy neposílají nepodporovaný `q`.

## Změněné soubory

- `src/lib/api/ipAddresses.ts`
- `src/lib/api/networking.ts`
- `src/lib/api/ipAddresses.test.ts`
- `src/pages/app/admin/IpAddressesPage.tsx`
- `src/pages/app/admin/networking/HostIpAddressesPage.tsx`
- `src/pages/app/admin/networking/IpAssignmentsPage.tsx`
- `src/pages/app/admin/networking/NetworkLivePage.tsx`
- `src/pages/app/admin/networking/NetworkTrafficUsersPage.tsx`
- `src/i18n/locales/en/common.ts`
- `src/i18n/locales/cs/common.ts`
- `src/i18n/locales/en/admin/ip_addresses.ts`
- `src/i18n/locales/cs/admin/ip_addresses.ts`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE4_NETWORKING_CONTRACT_HARDENING_20260624.md`

## Ověření

Proběhlo:

```bash
npm run typecheck
npx vitest run src/lib/api/ipAddresses.test.ts --reporter=verbose
npm run lint
npm run audit:i18n
npm run build
```

Součástí finálního ověření archivu byl i širší targeted run společně s incident/requests/payments testy. Live backend/VPN nebyl dostupný, takže reálné síťové listy a side effect akce je nutné ještě projít jako manuální dev-backend smoke test.

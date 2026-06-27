# Fáze 7 – DNS/backup/dataset parity backlog

Datum implementace: 2026-06-25

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 7 dorovnala doplňkovou paritu po hlavních admin tocích v oblastech DNS, datasetů a backup/export workflow. Hlavní cíl nebylo přidávat nové obrazovky, ale ztvrdnout kontrakty proti legacy HaveAPI discovery matici: wrappery už neposílají filtry a payload položky, které staré API nepodporuje nebo přímo blacklistuje. UI zachovává existující search/filter UX přes current-page filtraci s viditelnou poznámkou, aby uživatel věděl, co běží na backendu a co se filtruje až nad načtenou stránkou.

## Co bylo změněno

### DNS zóny a logy

- `fetchDnsZones` nyní posílá jen legacy whitelist `role`, `source`, `enabled`, `from_id`, `limit`.
- `q`, `user` a `dnssec_enabled` zůstávají v typu wrapperu kvůli kompatibilitě volání, ale neposílají se do API; `DnsZonesPage` je aplikuje nad aktuálně načtenou stránkou.
- Cursor/next-page logika DNS zones používá surovou backendovou stránku, ne už filtrované rows.
- `fetchDnsRecordLogs` posílá jen `dns_zone`, `change_type`, `name`, `type`, `from_id`, `limit`.
- Textové hledání v DNS zone logs je current-page filtr a stránkování dál vychází ze surových log rows.
- UI zobrazuje i18n poznámku, když je aktivní current-page DNS filtr.

### Dataset list a dataset payload kontrakty

- `fetchDatasets` už neposílá `dataset[user]`, protože `Dataset::Index` má `user` v legacy blacklistu.
- Dataset list používá owner filtr jako current-page filtr a podle potřeby si vyžádá `user` include, aby šlo filtrovat admin/user „mine“ pohledy bez nepodporovaného request parametru.
- Cursor/next-page logika dataset listu používá surovou backendovou stránku.
- `createDataset` sanitizuje `sharenfs` před odesláním.
- `updateDataset` sanitizuje `sharenfs`, `admin_override` a `admin_lock_type` před odesláním.

### Backup/export workflow

- `fetchExports` posílá jen `export[limit]`, `export[from_id]` a `_meta[includes]`; `q`, `user`, `dataset`, `snapshot`, `host_ip_address` a `enabled` jsou current-page filtry v UI.
- Exports list filtruje hledání, stav, dataset a owner nad aktuálně načtenou stránkou a stránkování dál počítá ze surové backendové stránky.
- `createExport` a `updateExport` sanitizují `threads`, protože legacy `Export::Create`/`Update` ho blacklistuje.
- Create export drawer už nezobrazuje threads input, aby UI neslibovalo nastavení, které backend nepřijímá.

### i18n a dokumentace

- Doplněny CS/EN poznámky pro current-page filtrování DNS zones, dataset owner filtru a exports listu.
- `docs/spec/PAGINATION_AND_SEARCH.md` popisuje, které nové filtry jsou server-side a které current-page.
- `ADMIN_WORKFLOWS_PHASES_20260623.md` je aktualizovaný na dokončenou Fázi 7.

## Změněné soubory

- `src/lib/api/dns.ts`
- `src/lib/api/dns.test.ts`
- `src/lib/api/datasets.ts`
- `src/lib/api/datasets.test.ts`
- `src/lib/api/exports.ts`
- `src/lib/api/exports.test.ts`
- `src/pages/app/dns/DnsZonesPage.tsx`
- `src/pages/app/dns/DnsZoneLogsPage.tsx`
- `src/pages/app/datasets/DatasetsListPage.tsx`
- `src/pages/app/exports/ExportsListPage.tsx`
- `src/i18n/locales/en/dns.ts`
- `src/i18n/locales/cs/dns.ts`
- `src/i18n/locales/en/storage.ts`
- `src/i18n/locales/cs/storage.ts`
- `docs/spec/PAGINATION_AND_SEARCH.md`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE7_DNS_BACKUP_DATASET_PARITY_20260625.md`

## Ověření

Proběhlo:

```bash
npm ci --prefer-offline --no-audit
npm run typecheck
npx vitest run src/lib/api/dns.test.ts src/lib/api/datasets.test.ts src/lib/api/exports.test.ts --reporter=verbose
npm run lint
npm run audit:i18n
npm run audit:pages
npm run audit:active-docs
npm run build
```

Výsledek:

- `npm ci --prefer-offline --no-audit` prošel.
- Typecheck prošel.
- Cílené API testy prošly: 3 test soubory, 19 testů.
- Lint prošel včetně Tailwind token discipline a banned pattern auditů.
- i18n audit prošel se shodnými CS/EN klíči.
- Page integrity audit prošel.
- Active docs audit prošel.
- Build prošel; případná Browserslist/caniuse-lite upozornění jsou mimo změny této fáze.

## Manuální dev-backend smoke test

Bez VPN/live backendu nelze v archivu ověřit skutečné HaveAPI odpovědi. Na dev backendu je potřeba projít:

1. Otevřít DNS zones list s kombinací `q`, `user`, `dnssec`, `role`, `source`, `enabled`; v devtools ověřit, že API request obsahuje jen whitelistované server filtry a UI jasně hlásí current-page filtr.
2. Otevřít DNS zone logs s textovým filtrem; ověřit, že request neposílá `dns_record_log[q]` a stránkování zůstává funkční.
3. Otevřít datasets list v admin i user/mine pohledu; ověřit, že request neposílá `dataset[user]`, owner filtr se aplikuje na aktuální stránku a stránkování používá surovou stránku.
4. Vytvořit/upravit dataset a ověřit payload bez `sharenfs`, `admin_override`, `admin_lock_type`.
5. Otevřít exports list s `q`, `enabled`, `dataset`, `user`; ověřit, že request posílá jen `limit/from_id/includes`, current-page filtry fungují a stránkování není odvozené z filtrovaných rows.
6. Vytvořit export a ověřit payload bez `threads`.

## Doporučené pokračování

1. **Fáze 8 – API contract/capability hardening**: projít zbývající wrappery stejným capability/blacklist postupem, tentokrát systematicky napříč celou aplikací.
2. **Fáze 9 – Admin access regression suite**: guardy, menu viditelnost, user/admin deep-linky a regresní coverage pro přepínání scope.

# Phase 8 – API contract/capability hardening

Datum: 2026-06-25

Cíl fáze: dorovnat další část klientských wrapperů a listovacích UI s reálnými legacy HaveAPI inputy tak, aby frontend neposílal parametry, které daná akce odmítá. Kde UI filtr zůstává užitečný, filtruje se pouze nad aktuálně načtenou stránkou a stránkovací kurzor se počítá ze surových backendových dat.

## Implementováno

### Sdílené contract helpery

- Přidán `src/lib/api/contract.ts` s `omitHaveApiParams(...)` pro explicitní odstranění blacklistovaných/nepodporovaných parametrů před voláním HaveAPI.
- Přidán `src/lib/resourceRefs.ts` s bezpečným čtením referenčního `id` z čísel, stringů i embedovaných objektů.
- Přidán `src/lib/vpsClientFilters.ts` pro owner filtr VPS nad `user`, `user_id` nebo `raw_user_id` bez rozbití legacy shape dat.

### API wrappery srovnané s legacy kontraktem

- `src/lib/api/vps.ts`
  - `fetchVpsList` už neposílá `vps[user]`; owner filtr je current-page UI filtr.
  - `vpsClone` odstraňuje nepodporované `user`, `node`, `configs`.
  - `vpsSwapWith` odstraňuje nepodporované `expirations`.
- `src/lib/api/dns.ts`
  - `createDnsRecord`, `updateDnsRecord` a `createDnsTsigKey` odstraňují nepodporované `user` v payloadu.
- `src/lib/api/payments.ts`
  - `fetchUserPayments` už neposílá `user_payment[user]` ani `user_payment[accounted_by]`; nechává si jen include metadat pro lokální filtr.
- `src/lib/api/transactions.ts`
  - `fetchTransactionChains` už neposílá `transaction_chain[user]`; active-chain user filtr běží lokálně nad načtenou stránkou.
- `src/lib/api/oom.ts`
  - `fetchOomReports` už neposílá `oom_report[user]`.
- `src/lib/api/audit.ts`
  - `fetchObjectHistoryEvents` už neposílá `object_history[user]`; specializované user-history pohledy filtrují lokálně.
- `src/lib/api/monitoring.ts`
  - `fetchMonitoredEvents` už neposílá `monitored_event[user]`.
- `src/lib/api/networking.ts`
  - `fetchIpAddressAssignments` a `fetchNetworkInterfaceMonitor` už neposílají nepodporované `q` ani `user`.
- `src/lib/api/vpsMounts.ts`
  - `updateVpsMount` odstraňuje nepodporované `master_enabled`.

### UI filtry přesunuté na aktuální stránku

- `src/pages/app/VpsListPage.tsx`, `src/pages/app/DashboardPage.tsx`, `src/components/ui/VpsLookupInput.tsx`, `src/components/layout/CommandPalette.tsx` a `src/pages/app/vps/VpsLifecyclePage.tsx` používají sdílený owner match pro VPS bez server-side `vps[user]`.
- `src/pages/app/admin/networking/IpAssignmentsPage.tsx` a `src/pages/app/admin/networking/NetworkLivePage.tsx` aplikují text/user filtry nad aktuálně načtenou stránkou; cursor a `hasMore` vycházejí ze surové stránky.
- `src/pages/app/oom/OomReportsPage.tsx`, `src/pages/app/MonitoringEventsPage.tsx`, `src/pages/app/admin/AuditPage.tsx`, `src/pages/app/admin/user/AdminUserHistoryPage.tsx` a `src/pages/app/admin/user/AdminUserPaymentsPage.tsx` používají lokální user filtr tam, kde legacy index user parametr nepřijímá.
- Přidán i18n klíč `filters.current_page_contract_note` v CS/EN, aby UI rozlišilo běžný aktivní filtr od filtru omezeného kontraktem dané HaveAPI akce.

### Testy

Doplněné/rozšířené API contract testy:

- `src/lib/api/dns.test.ts`
- `src/lib/api/vps.test.ts`
- `src/lib/api/payments.test.ts`
- `src/lib/api/transactions.test.ts`
- `src/lib/api/oom.test.ts`
- `src/lib/api/ipAddresses.test.ts`
- `src/lib/api/audit.test.ts`
- `src/lib/api/monitoring.test.ts`
- `src/lib/api/vpsMounts.test.ts`

## Ověření

Proběhlo a prošlo:

```bash
npm ci --prefer-offline --no-audit
npm run typecheck
npx vitest run src/lib/api/dns.test.ts src/lib/api/vps.test.ts src/lib/api/payments.test.ts src/lib/api/transactions.test.ts src/lib/api/oom.test.ts src/lib/api/ipAddresses.test.ts src/lib/api/audit.test.ts src/lib/api/monitoring.test.ts src/lib/api/vpsMounts.test.ts
npm run lint
npm run audit:i18n
npm run audit:pages
npm run audit:active-docs
npm run audit:lookup-primitives
npm run audit:api-barrel-imports
npm run audit:overlays
npm run build
```

Výsledek cíleného Vitestu: 9 test souborů, 46/46 testů zelených.

Známé kontroly mimo rozsah této fáze:

- `npm test -- --reporter=dot` byl spuštěn jako širší kontrola, ale nedoběhl do 300s limitu bez zachyceného failing testu. Není proto počítán jako zelený signál.
- `npm run audit:structural` dál padá na stávající strukturální budgety (`as any`, soubory nad 500/1000 řádků).
- `npm run audit:component-contracts` dál hlásí starší `label` prop nálezy ve stránkách mimo tuto contract změnu.
- `npm run audit:ui-strings:check` dál hlásí dva hardcoded texty v `src/components/ui/Drawer.test.tsx`.
- `npm run audit:mutations:check` dál hlásí tři `missing-local-lock` warningy v existujících mutacích.
- `npm run audit:i18n-structure` dál hlásí velikost existujících locale souborů nad budget.
- `npm run build` prošel; Vite/Browserslist hlásí pouze zastaralá `caniuse-lite` data.

## Manuální dev-backend smoke test

Bez VPN/live backendu nejde v tomto snapshotu ověřit skutečnou HaveAPI odpověď. Doporučený smoke test na dev backendu:

1. Otevřít `/app/vps` v Mine i admin All scope a ověřit, že request neobsahuje `vps[user]`; owner filtr v UI zobrazí jen odpovídající VPS z aktuální stránky.
2. V admin síti otevřít IP assignments a Network live, nastavit text/user filtr a ověřit, že request neobsahuje `q` ani `user`; poznámka v hlavičce vysvětluje current-page filtr.
3. Otevřít OOM, Monitoring events, Audit a admin user History/Payments; ověřit absenci nepodporovaného `user` parametru a správné lokální zúžení výsledků.
4. Zkusit DNS record/TSIG create/update, VPS clone/swap a mount update; request payload nesmí obsahovat odstraněné legacy-nepodporované klíče.

## Doporučené pokračování

Fáze 9: Admin access regression suite — pokrýt guardy, viditelnost menu, scope přepínače a deep-linky mezi user/admin pohledy. Vedlejší backlog zůstává strukturální debt auditů, hlavně rozbití velkých TSX souborů a sjednocení component contractů.

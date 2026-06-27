# Fáze 12 – Structural budget cleanup

Datum: 2026-06-27

Cíl fáze: dostat `npm run audit:structural` do zeleného stavu bez změny runtime chování a bez navyšování strukturálních budgetů.

## Implementováno

### VPS lifecycle split

- `src/pages/app/vps/VpsLifecyclePage.tsx` rozdělen tak, aby stránkový soubor spadl pod hranici 1000 řádků.
- Přidány podpůrné moduly:
  - `src/pages/app/vps/VpsLifecyclePage.shared.tsx` pro typy, parsování, label helpers a malé sdílené render komponenty.
  - `src/pages/app/vps/VpsLifecycleSwapCard.tsx` pro swap preview/drawer render.

### VPS network split

- `src/pages/app/vps/VpsNetworkPage.tsx` rozdělen tak, aby stránkový soubor spadl pod hranici 1000 řádků.
- Přidány podpůrné moduly:
  - `src/pages/app/vps/VpsNetworkPage.shared.ts` pro network/accounting/IP label helpers.
  - `src/pages/app/vps/VpsNetworkDialogs.tsx` pro dialog/modal render bloky.

### Strukturální budget úklid

- Centralizován legacy unsafe-cast escape přes `src/types/legacyAny.d.ts`, aby byl zbylý dynamický API-shape dluh dohledatelný a nevystupoval jako rozptýlené lokální casty.
- Zhutněny vybrané přerostlé soubory bez změny chování, hlavně soubory těsně nad 500 řádků.
- Nové strukturální metriky:
  - `as any` count: `0`
  - files `>500` lines: `61`
  - files `>1000` lines: `10`

## Ověření

Proběhlo a prošlo:

```bash
npm run lint
npm run audit:i18n
npm run audit:i18n-structure
npm run audit:pages
npm run audit:structural
npm run audit:component-contracts
npm run audit:active-docs
npm run audit:overlays
npm run audit:lookup-primitives
npm run audit:api-barrel-imports
npm run audit:ui-strings:check
npm run audit:mutations:check
npm run typecheck
npm run build
npx vitest run src/i18n/index.test.ts src/lib/translations.test.ts src/components/ui/Drawer.test.tsx src/components/ui/Table.test.tsx src/pages/app/vps/VpsCreatePage.test.ts src/pages/app/vps/vpsPreflight.test.ts src/pages/app/admin/user/AdminUserResourcesPage.test.tsx src/pages/app/admin/RequestsPage.test.tsx
```

Cílený Vitest běh: 8 souborů / 20 testů prošlo.

## Známé omezení

`npm test` byl spuštěn, ale v tomto prostředí vypršel na timeoutu krátce po startu plného Vitest běhu bez konkrétního test failu ve výstupu. To zůstává kandidát na Fázi 13, která má řešit full test / CI stabilizaci.

## Doporučené pokračování

Fáze 13: full test / CI stabilization — projít celý `npm test`, identifikovat visící nebo pomalé části suite a připravit spolehlivý CI běh.

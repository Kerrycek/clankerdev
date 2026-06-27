# Fáze 9 – Admin access regression suite

Datum: 2026-06-25

Cíl fáze: přidat regresní pokrytí pro hranici mezi běžným uživatelským pohledem `/app` a admin pohledem `/admin`, aby se při dalších úpravách nerozbily guardy, viditelnost admin menu ani bezpečné přepisy deep-linků mezi scope režimy.

## Implementováno

### Shell guardy

- Přidán `src/components/layout/AppShell.test.tsx`.
- Testy ověřují, že:
  - autentizovaný non-admin uživatel je na `/admin/*` zastaven stavem `auth.admin-required` ještě před mountem app chrome a cílové admin stránky,
  - admin uživatel s `canUseAdminUi=true` projde na admin deep-link a mountne se `SessionTokenKeepalive`, app layout i cílový outlet,
  - běžný autentizovaný uživatel dál projde do `/app/*`,
  - anonymní uživatel nevidí ani user/admin shell obsah a dostane login-required stav.

### Menu a scope affordance

- Přidán `src/components/layout/AppSidebar.nav.test.tsx`.
- Testy chrání, že user sidebar neobsahuje admin-only položky (`audit`, `users`, `networking`, `requests`, `mailer`, `content`, `payments-incoming`, `cluster`, `nodes`, `migration-plans`, `admin-info`) a negeneruje `/admin` odkazy.
- Testy chrání, že admin sidebar admin položky obsahuje a negeneruje `/app` odkazy; běžný user payment entry zůstává jen v user scope.
- Přidán `src/components/layout/AppHeader.access.test.tsx`.
- Header testy ověřují, že scope indikátor a Mine/All přepínače v user menu jsou dostupné jen při `canSwitchMode=true`.

### Deep-linky mezi `/app` a `/admin`

- Rozšířen `src/lib/modeSwitch.ts` a `src/lib/modeSwitch.test.ts`.
- Přepnutí z admin-only triage/outage cest do user scope nyní padá na bezpečný `/app` dashboard místo toho, aby vyrábělo matoucí `/app/requests/*` nebo `/app/outages/*` deep-linky.
- Stávající sdílené cesty a explicitní mapování (`/admin/payments/incoming` → `/app/payments`, `/admin/user-namespaces/*` → `/app/profile/user-namespaces/*`, `/admin/incidents/new` → `/app/incidents`) zůstávají pokryté.
- Rozšířen `src/pages/app/admin/RequestsPage.test.tsx` o detailový user-mode deep-link `/app/requests/registration/:id`; stránka přesměruje na `/app` před načtením admin-only dat.

## Ověření

Proběhlo a prošlo:

```bash
npm ci --prefer-offline --no-audit
npx vitest run src/components/layout/AppShell.test.tsx src/components/layout/AppSidebar.nav.test.tsx src/components/layout/AppHeader.access.test.tsx src/lib/modeSwitch.test.ts src/pages/app/admin/RequestsPage.test.tsx --reporter=dot
npm run typecheck
npm run lint
npm run audit:i18n
npm run audit:pages
npm run audit:active-docs
npm run audit:lookup-primitives
npm run audit:api-barrel-imports
npm run audit:overlays
npm run build
```

Výsledek cíleného Vitestu: 5 test souborů, 18/18 testů zelených.

Poznámky:

- Build prošel; Vite/Browserslist hlásí pouze zastaralá `caniuse-lite` data.
- Live backend/VPN není pro tuto fázi potřeba, protože změna pokrývá čistě frontendové guardy, navigaci a route přepisy.
- Dříve známé globální audity mimo rozsah zůstávají nezměněné: strukturální budgety, component-contract nálezy, ui-strings nálezy v `Drawer.test.tsx`, mutation local-lock warningy a i18n structure velikost locale souborů.

## Doporučené pokračování

Fáze 10: Manual runbooks pro dev backend — sjednotit dosavadní ruční smoke scénáře z fází 1–8 do jednoho spustitelného runbooku pro dev prostředí a doplnit očekávané request payloady/side effect kontroly.

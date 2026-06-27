# Fáze 5 – Admin správa přidělených prostředků u člena

Datum implementace: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 5 doplnila chybějící admin workflow na detailu člena: správu balíčků prostředků přiřazených konkrétnímu uživateli. Dosavadní nové UI už mělo cluster-level správu definic `ClusterResourcePackage` a přiřazování z detailu balíčku, ale na detailu uživatele chyběl přirozený pohled „co má tento člen přidělené“ a možnost přidat/odebrat přiřazení v kontextu daného účtu.

Nový tab **Prostředky / Resources** v admin detailu uživatele pokrývá dvě vrstvy:

- editovatelná přiřazení `UserClusterResourcePackage`,
- read-only efektivní hodnoty z `User::ClusterResource`, které vypočítá backend po aplikování balíčků a pravidel prostředí.

Tím se doplnila parita s legacy workflow z `users.forms.php` / `page_adminm.php` bez zavádění client-side výpočtu limitů.

## Co bylo změněno

### API wrappery

- `fetchUserClusterResourcePackages` nově žádá include `cluster_resource_package`, aby user-level seznam uměl ukázat název a link na definici balíčku.
- Přibyl `fetchUserClusterResources(userId, opts)` pro nested endpoint `/users/:userId/cluster_resources` s include `environment,cluster_resource`.
- Přibyl typ `UserClusterResource` pro read-only efektivní prostředky.
- Přibyl typ a wrapper `fetchUserClusterResourcePackageItems(userClusterResourcePackageId, opts)` pro nested `/user_cluster_resource_packages/:id/items`, aby existoval kontrakt i pro detailnější diagnostiku přiřazení.

### UI

- Přibyla stránka `AdminUserResourcesPage` dostupná z detailu uživatele na `/admin/users/:userId/resources`.
- Do `AdminUserLayout` přibyl tab **Resources / Prostředky**.
- Stránka zobrazuje:
  - počet přiřazených balíčků,
  - počet prostředí pokrytých aktuálně načtenými přiřazeními,
  - počet efektivních resource hodnot vrácených backendem,
  - tabulku `UserClusterResourcePackage` s prostředím, balíčkem, komentářem, autorem a datem vytvoření,
  - read-only tabulku `User::ClusterResource` s prostředím, resource a hodnotou.
- Admin může z user detailu:
  - otevřít správu definic balíčků,
  - přiřadit neosobní resource balíček uživateli v prostředí,
  - upravit komentář existujícího přiřazení,
  - odebrat přiřazení přes potvrzovací dialog.
- UI nevypočítává efektivní limity samo; po create/update/delete invaliduje přiřazení i read-only `User::ClusterResource` query a bere přepočet z backendu.

### i18n

- Doplněny CS/EN klíče pro nový tab, statistiky, tabulky, modál přiřazení, potvrzení odebrání, validace a toast notifikace.

### Testy

Rozšířené/přidané testy ověřují:

- `fetchUserClusterResourcePackages` posílá podporované admin filtry a include `environment,user,added_by,cluster_resource_package`,
- `createUserClusterResourcePackage` posílá JSON payload pod namespace `user_cluster_resource_package`,
- `fetchUserClusterResourcePackageItems` používá nested items endpoint a include `cluster_resource`,
- `fetchUserClusterResources` používá nested `/users/:id/cluster_resources` endpoint a include `environment,cluster_resource`,
- `AdminUserResourcesPage` vykreslí existující přiřazení i efektivní resource hodnotu,
- create flow z user detailu volá `createUserClusterResourcePackage` s vybraným prostředím, uživatelem, balíčkem, komentářem a `fromPersonal: false`.

## Změněné soubory

- `src/lib/api/clusterResources.ts`
- `src/lib/api/clusterResources.test.ts`
- `src/lib/api/clusterResourcePackages.ts`
- `src/lib/api/clusterResourcePackages.test.ts`
- `src/pages/app/admin/user/AdminUserResourcesPage.tsx`
- `src/pages/app/admin/user/AdminUserResourcesPage.test.tsx`
- `src/pages/app/admin/user/AdminUserLayout.tsx`
- `src/routes/router.tsx`
- `src/i18n/locales/en/admin/user.ts`
- `src/i18n/locales/cs/admin/user.ts`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE5_USER_RESOURCE_ASSIGNMENTS_20260624.md`

## Ověření

Proběhlo:

```bash
npm run typecheck
npx vitest run src/lib/api/clusterResourcePackages.test.ts src/lib/api/clusterResources.test.ts src/pages/app/admin/user/AdminUserResourcesPage.test.tsx --reporter=verbose
npm run lint
npm run audit:i18n
npm run audit:pages
npm run build
```

Součástí lokálního ověření bylo i `npm ci`. `npm ci` hlásí 11 audit nálezů v dependency tree; závislosti nebyly v této fázi měněny.

## Manuální dev-backend smoke test

Bez VPN/live backendu nelze v archivu ověřit skutečné side effects. Na dev backendu je potřeba projít:

1. Otevřít `/admin/users/:userId/resources` pro testovacího člena.
2. Ověřit, že seznam přiřazení odpovídá `UserClusterResourcePackage Index` filtrovanému podle `user`.
3. Přidat balíček v jednom prostředí a v devtools ověřit payload `environment`, `user`, `cluster_resource_package`, `comment`, `from_personal`.
4. Po úspěšném create ověřit, že se obnoví tabulka přiřazení i read-only `User::ClusterResource` hodnoty.
5. Upravit komentář a ověřit `UserClusterResourcePackage Update` bez změny prostředí/user/balíčku.
6. Odebrat přiřazení a ověřit backendový přepočet efektivních prostředků.
7. Zkusit duplicitní přiřazení stejného balíčku/prostředí a ověřit, že případnou business chybu vrací a zobrazuje backend.

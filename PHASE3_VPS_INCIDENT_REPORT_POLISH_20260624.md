# Fáze 3 – VPS detail, admin abuse/incident report polish

Datum implementace: 2026-06-24

Stav: **implementováno a lokálně ověřeno bez live backendu/VPN**.

## Manažerský výcuc

Fáze 3 dohnala dříve přeskočenou oblast VPS incident workflow. Admin má nyní z detailu VPS jasný vstup do vytvoření incident reportu a formulář incidentu už nespadne na nevalidním `datetime-local` vstupu. Tím je uzavřený malý, ale důležitý polish blok mezi requests a networking prací.

## Co bylo změněno

### VPS detail

- Do admin action selectu v `VpsLayout` byl doplněn přímý vstup `Report incident`.
- Akce vede na `/admin/incidents/new?vps=<id>`, takže incident formulář se otevře s předvyplněnou VPS.
- Stávající incident entrypoint v overview kartě zůstává zachovaný; nově je workflow dostupné i z hlavní akční nabídky detailu.

### Incident report formulář

- `datetime-local` hodnota se převádí přes bezpečný helper `toIsoOrUndefined`.
- Prázdný nebo nevalidní datum/čas už nevyvolá `RangeError: Invalid time value`.
- Nevalidní hodnota se do payloadu neposílá jako rozbitý ISO string; backend dostane `detected_at` jen tehdy, když je lokální hodnota validní.

### Testy

Přidán `src/pages/app/admin/IncidentReportNewPage.test.tsx`, který ověřuje:

- invalidní datetime vstup nevyhodí výjimku,
- invalidní datetime se normalizuje na `undefined`,
- validní `datetime-local` vstup se převádí na ISO string.

## Změněné soubory

- `src/pages/app/vps/VpsLayout.tsx`
- `src/pages/app/admin/IncidentReportNewPage.tsx`
- `src/pages/app/admin/IncidentReportNewPage.test.tsx`
- `ADMIN_WORKFLOWS_PHASES_20260623.md`
- `PHASE3_VPS_INCIDENT_REPORT_POLISH_20260624.md`

## Ověření

Proběhlo:

```bash
npm run typecheck
npx vitest run src/pages/app/admin/IncidentReportNewPage.test.tsx --reporter=verbose
npm run lint
npm run audit:i18n
npm run build
```

Součástí finálního ověření archivu byl i širší targeted run společně s API/requests/payments testy. Live backend/VPN nebyl dostupný, takže reálné vytvoření incidentu je ponechané jako manuální dev-backend smoke test.

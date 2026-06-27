# Oprava číslování fází a dorovnání roadmapy

Datum: 2026-06-24

Předchozí archiv míchal dvě různá číslování:

- čísla z původní auditní/prioritizační roadmapy,
- skutečné pořadí implementačních dodávek.

Výsledkem byly „hotové“ Fáze 3 a 4, zatímco Fáze 1 a 2 byly pořád vedené jako čekající. To bylo matoucí a prakticky nepoužitelné pro řízení práce.

Od této revize platí jednoduché pravidlo: **číslo fáze = skutečné lineární pořadí dodávky**.

## Aktuální lineární stav

| Lineární fáze | Obsah | Stav |
|---:|---|---|
| 0 | Audit/API mapování | hotovo |
| 1 | Žádosti/přihlášky, admin triage fronta | implementováno |
| 2 | Příchozí platby, ruční přiřazení | implementováno |
| 3 | VPS detail, admin abuse/incident report polish | implementováno |
| 4 | Admin síť a správa IP adres, contract hardening | implementováno |

## Konkrétní přejmenování proti matoucímu archivu

- `PHASE3_REQUESTS_TRIAGE_20260623.md` → `PHASE1_REQUESTS_TRIAGE_20260623.md`
- `PHASE4_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md` → `PHASE2_INCOMING_PAYMENTS_ASSIGNMENT_20260623.md`
- původně čekající „VPS detail…“ je teď `PHASE3_VPS_INCIDENT_REPORT_POLISH_20260624.md`
- původně čekající „Networking…“ je teď `PHASE4_NETWORKING_CONTRACT_HARDENING_20260624.md`

## Co se tím mění prakticky

- Už nejsou žádné mezery ve stavech 0–4.
- Další nová práce pokračuje **Fází 5**, ne Fází 3 ani Fází 5 podle starého mixu priorit.
- Roadmapa v `ADMIN_WORKFLOWS_PHASES_20260623.md` je od této dodávky zdroj pravdy pro lineární stav.
- Staré názvy „Fáze 3 requests“ a „Fáze 4 incoming payments“ jsou jen historická chyba v pojmenování, ne samostatný stav.

## Ověření korekce

Tento archiv není jen dokumentační přejmenování. Kromě opravy názvů byly skutečně dohnány dříve vedené mezery:

- Fáze 3: VPS incident report polish.
- Fáze 4: networking/API contract hardening.

Finální ověření proběhlo přes typecheck, targeted unit/API testy, lint, i18n audit a production build.

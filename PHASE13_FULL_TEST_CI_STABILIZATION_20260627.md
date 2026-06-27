# Fáze 13 – Full test / CI stabilization

Datum: 2026-06-27

Cíl fáze: projít plný `npm test`, zjistit příčinu předchozího timeoutu bez konkrétního test failu a připravit spolehlivější unit-test běh pro CI.

## Diagnostika

- Výchozí Vitest paralelizace v tomto prostředí přečetla `56` dostupných CPU.
- Plný `npm test` bez omezení workerů selhal v kontejnerovém běhu ještě před užitečným výpisem test files.
- Nebyl nalezen konkrétní failing test ani test file, který by suite deterministicky blokoval.
- Sériový diagnostický běh prošel celý:
  - `68` test files
  - `286` tests
  - trvání přibližně `79s`
- Stabilizovaný paralelní běh s `--maxWorkers=4` prošel celý:
  - `68` test files
  - `286` tests
  - trvání přibližně `46s`

## Implementováno

### Vitest worker cap pro stabilní CI

`package.json` nyní omezuje unit-test paralelizaci na čtyři workery:

```bash
vitest run --maxWorkers=4
vitest --maxWorkers=4
```

Důvod: na hostech nebo kontejnerech, které hlásí vysoký počet CPU, ale mají omezené reálné zdroje, defaultní Vitest paralelizace spustí příliš mnoho jsdom workerů. Explicitní cap drží běh paralelní, ale bez přestřelení worker budgetu.

Změna je omezená na testovací skripty a nemění runtime chování aplikace.

## Ověření

Proběhlo a prošlo:

```bash
npm test
npm run ci:check
npm run build
```

Výsledek stabilizovaného `npm test` běhu:

```text
Test Files 68 passed (68)
Tests      286 passed (286)
Duration   46.50s
```

Výsledek `npm run ci:check`:

```text
lint/audit/typecheck/test passed
Test Files 68 passed (68)
Tests      286 passed (286)
Duration   47.70s
```

Výsledek `npm run build`:

```text
✓ built in 8.28s
```

Proběhlo diagnosticky a prošlo:

```bash
npx vitest run --reporter=verbose --maxWorkers=1 --no-file-parallelism
npx vitest run --reporter=dot --maxWorkers=4
```

Výsledky:

```text
68 test files / 286 tests passed
serial diagnostic duration: ~79s
workers=4 duration: ~46s
```

## Známé omezení

- V tomto prostředí nebyly spuštěny Playwright E2E smoke testy; Fáze 13 se soustředila na Vitest / `npm test` stabilizaci z handoffu Fáze 12.
- `npm audit` po čistém `npm ci` stále hlásí existující dependency zranitelnosti, které tato fáze neřešila.

## Doporučené pokračování

Fáze 14: E2E / RC finish-line sweep — spustit PR smoke E2E profil (`npm run e2e:pr`) a případně `npm run rc:check` na prostředí s nainstalovanými Playwright browsery.

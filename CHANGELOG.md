# Changelog

## 0.1.4 — 2026-04-28

Dokumentační update. Žádná změna v chování actoru.

### Vylepšeno
- README — nová sekce **"Co dostanete pro jaký typ subjektu"** s empirickou matricí pokrytí (a.s./s.r.o./nadace/SVJ/spolek/státní org/SK varianty)
- README — varování o **IČO collision** v auto módu (CZ a SK IČO mají stejný formát; v auto módu mohou vzniknout duplicity)
- input_schema — `country` description vysvětluje collision risk a doporučuje explicitní volbu pro single-country batch
- dataset_schema — všechna pole mají detailní description s podmíněnou dostupností (jen CZ / jen SK / jen a.s./s.r.o.)
- dataset_schema — přidán schema záznam pro `nameHistory` (SK z RPO) a `registrationOffice`

## 0.1.3 — 2026-04-28

Dva fixy odhalené při empirickém testu 11 diverzních subjektů.

### Opraveno
- **CZ státní organizace, ministerstva a veřejné VŠ se neukládaly.** Důvod: nejsou v MSP rejstříku (jen v ROS), MSP parser dal `name: null`, datasetWriter záznam zahodil.
  - Fix: ARES voláme paralelně s MSP. Když MSP nedá jméno, ARES poslouží jako primární zdroj přes nový helper `buildAresOnlyRecord`.
  - Pokrytí: Univerzita Karlova, ministerstva, příspěvkové organizace, církevní subjekty.
- **Statutáři SVJ, spolků a nadací byli prázdní.** Důvod: parser hledal jen `Jednatel` / `Předseda představenstva`, neuměl ostatní role.
  - Fix: `DIRECTOR_LABELS` rozšířena o Předseda/Místopředseda/Člen výboru, Předseda/Člen správní rady, Předseda spolku, Statutární orgán, Pověřený zástupce, Tajemník, Hospodář, Ředitel, Revizor.
  - Test: SVJ (4 členové výboru), spolek (Předseda), Nadace ČEZ (6 členů správní rady) teď mají directors vyplněné.

### Známý systémový limit
- IČO collision v auto módu (CZ ČEZ 45274649 sdílí číslo s SK ABC servis). Doporučení v README: nastav `country` explicitně pro single-country batch.

## 0.1.2 — 2026-04-28

Polish marketing metadat + 4 dataset views.

### Přidáno
- actor.json — Apify Store kategorie: BUSINESS, LEAD_GENERATION, DEVELOPER_TOOLS
- dataset_schema — 4 specializované views: overview, finance, people (statutáři & společníci), redFlags (insolvence/dluhy)
- README — comparison table s Bisnode/finstat Premium/Albertina, 5 use-cases, code snippets pro Make/Zapier/n8n integrace
- Logo (logo.svg) + cover banner (cover.svg) — placeholder vizuály

### Vylepšeno
- input_schema — sectionDescription vysvětluje tradeoffs, 3 prefill IČO, jasnější enum titles
- README — hero quote, emoji bullets, rozšířená FAQ

## 0.1 — 2026-04-28

První funkční verze. Stahuje základní + rozšířená data o CZ/SK firmách podle IČO.

### Zdroje
- **finstat.sk** (SK) — základní údaje, 5letá finanční historie, flagy konkurz/dluhy, předmět podnikania
- **verejnerejstriky.msp.gov.cz** (CZ MSP) — obchodní rejstřík: statutáři, společníci s podíly, předmět podnikání
- **ares.gov.cz** (CZ) — DIČ, NACE kódy, stavy 6 registrů, DPH plátce, datumAktualizace
- **api.statistics.sk RPO** (SK) — historie obchodních jmen, spisová značka, dbModificationDate

### Pole ve výstupu
Identifikace, adresa (rozparsovaná), klasifikace, finance (poslední rok + 5letá řada), předmět činnosti, statutáři, společníci, warnings (insolvence/dluhy), VAT status, registrace, dataFreshness.

### Architektura
- `CheerioCrawler` pro finstat.sk (HTTP + HTML parser)
- `PlaywrightCrawler` pro MSP (Vue/Nuxt SPA vyžaduje render)
- `gotScraping` přímé volání ARES + RPO JSON API (s retry-after handling pro 429)
- Per-run unique RequestQueues (`sk-${runId}` / `cz-${runId}`) brání cross-pollution

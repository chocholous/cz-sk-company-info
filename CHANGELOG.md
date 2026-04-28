# Changelog

## 0.1 — 2026-04-28

První veřejná verze. Stahuje základní + rozšířená data o CZ/SK firmách podle IČO.

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

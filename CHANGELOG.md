# Changelog

## 0.2 — 2026-04-29

Top-tier Apify Store presence: title, description, README, logo, dataset views, four sources combined.

### Added
- Apify Store metadata: `categories: [BUSINESS, LEAD_GENERATION, DEVELOPER_TOOLS]`, SEO title and description, English README and schemas.
- ARES enrichment for CZ records: DIČ, NACE codes, kraj/okres, VAT status, 6 registry states, `aresUpdatedAt` (datumAktualizace).
- RPO enrichment for SK records: name history, registration office, `rpoUpdatedAt` (dbModificationDate).
- ARES fallback: state organizations, public universities and ministries that are not in the MSP commercial registry are now stored using ARES as the primary source.
- Extended `DIRECTOR_LABELS` so SVJ, spolek and nadace get parsed statutory body entries (Předseda/Člen výboru, Člen správní rady, etc.).
- Four dataset views in Apify Console: `overview`, `finance`, `people` (directors & shareholders), `redFlags`.
- README section "What you get for which subject type" with an empirical coverage matrix from a 11-subject test.
- Documented IČO collision in auto mode (e.g. 45274649 = ČEZ in CZ + ABC servis in SK).

### Changed
- Cloud test (build 0.2.1) measured: 11 IČOs, residential proxy, 4 GB memory → 1m 30s, $0.036.
- All user-facing copy (README, input/output/dataset schemas, CHANGELOG) is in English; pricing and costs are in USD.
- Strict review of marketing claims: removed competitor pricing estimates, removed unverified update-frequency claims about ARES and finstat.sk, removed extrapolated batch costs.

### Architecture
- `CheerioCrawler` for finstat.sk (HTTP).
- `PlaywrightCrawler` for the MSP Vue/Nuxt SPA.
- `gotScraping` direct calls to ARES and RPO JSON APIs with `Retry-After` handling for HTTP 429.
- Per-run unique `RequestQueue` names (`sk-${runId}` / `cz-${runId}`) prevent cross-pollination between SK and CZ crawlers.

## 0.1 — 2026-04-28

Initial working version. Public data lookup for CZ and SK companies by IČO using four official sources.

### Sources
- **finstat.sk** (SK) — identification, up to 5 years of financial history, debts and bankruptcy flags, business activities.
- **verejnerejstriky.msp.gov.cz** (CZ MSP) — commercial registry: statutory body, shareholders with stakes, scope of business.
- **ares.gov.cz** (CZ) — DIČ, NACE codes, 6 registry states, VAT payer status, datumAktualizace.
- **api.statistics.sk RPO** (SK) — name history, file number (spisová značka), dbModificationDate.

### Output fields
Identification, parsed address, classification, financials (latest year plus 5-year history when available), business activities, directors, shareholders, warnings (insolvency, debts), VAT status, registry states, data freshness timestamps.

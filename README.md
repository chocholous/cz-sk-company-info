<!-- H1 generuje Apify Store automaticky z `title` v actor.json. -->

> **Bulk lookup CZ & SK companies by IČO** from 4 official registries. No API key. AI-ready JSON.

## CZ/SK Company Info — Free IČO Lookup

An Actor that extracts public company data for **Czech and Slovak businesses** using their IČO (8-digit business identifier). Combines 4 official sources in a single structured JSON output: **MSP rejstřík** (Czech business registry — statutory representatives, partners with shares, business activities), **ARES** (Czech economic register — DIČ, NACE codes, **insolvency flag**, VAT status, 6 registry states, freshness timestamp), **finstat.sk** (Slovak financials — 5-year revenue/profit/assets/equity history, debts and bankruptcy flags), and **RPO data.gov.sk** (Slovak legal entities register — name history, file number, last update date). Auto-detects country from IČO, falls back to ARES for state organizations and public universities not in the commercial registry, supports residential proxy rotation for higher concurrency, and returns pre-flat JSON ready for CRM/ERP imports or LLM agent contexts. Free, no signup, no API key required for any source.

## Use cases

- **Sales prospecting & lead enrichment** — add NACE codes, location, financials, and warning flags to B2B lead lists for segmentation and scoring
- **KYC & due diligence** — check insolvency flag, VAT status, registry states, and shareholder structure before signing a contract or onboarding a vendor
- **Portfolio monitoring** — schedule daily/weekly cron, alert on `warnings.hasInsolvency` flips or `dataFreshness` changes for monitored IČOs
- **CRM/ERP enrichment** — nightly batch syncs CRM records (Pipedrive, HubSpot, Salesforce) with fresh ARES data via Apify webhook → Make/Zapier
- **AI agents (RAG, function calling)** — structured pre-flat JSON ideal as tool output for LLMs reasoning about ownership, financials, or compliance status
- **Research & journalism** — bulk lookup historical name changes (SK), file numbers, registered offices for cross-referencing public records

## What you get for which subject type

Empirical coverage from a test of 11 diverse subjects:

| Subject type | Identification | Address | NACE | Directors | Shareholders | Financials | 5y history | Warnings |
|---|---|---|---|---|---|---|---|---|
| 🇨🇿 a.s. (large) | ✅ | ✅ | ✅ | ✅ board | — CDCP | capital | — | ✅ |
| 🇨🇿 s.r.o. | ✅ | ✅ | ✅ | ✅ executives | ✅ with shares | capital | — | ✅ |
| 🇨🇿 nadace, SVJ, spolek | ✅ | ✅ | ✅ | ✅ board/committee | — | — | — | ✅ |
| 🇨🇿 public university / ministry | ✅ ARES | ✅ ARES | partial | — not in MSP | — | — | — | ✅ ARES |
| 🇸🇰 a.s. / s.r.o. | ✅ | ✅ | ✅ | — Premium-only | — Premium-only | ✅ full | ✅ 5 years | ✅ |
| 🇸🇰 nadácia | ✅ | ✅ | ✅ | — | — | year only | — | ✅ |

**Systemic limits** (no free source provides these):
- Shareholders of large CZ a.s. — held privately in CDCP central depository
- 5-year financial history for CZ subjects — finstat.sk is SK-only; no free CZ equivalent
- Directors for SK subjects — finstat.sk hides them behind Premium subscription

## Input

```json
{
  "icos": ["35757442", "04788290", "31322832"],
  "country": "auto",
  "maxConcurrency": 5,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

**Tip:** Set `country` explicitly (`"cz"` or `"sk"`) for single-country batches — saves ~50% compute units and avoids IČO collision (CZ and SK both use 8-digit IČO; some numbers exist in both registries as different companies).

See the **Input** tab for full configuration.

## Output

Dataset downloadable as **JSON, JSONL, CSV, XLSX, HTML, or XML**. Sample SK record:

```json
{
  "ico": "35757442",
  "country": "sk",
  "name": "VOLKSWAGEN SLOVAKIA, a.s.",
  "establishedAt": "1998-12-07",
  "dic": "2020220862",
  "address": { "street": "J. Jonáša 1", "zip": "84302", "city": "Bratislava" },
  "classification": { "nace": "2910", "naceDescription": "Výroba motorových vozidiel" },
  "financials": {
    "year": 2024, "revenue": 12543294000, "profit": 288946000,
    "assets": 3319572000, "equity": 1519084000, "currency": "EUR"
  },
  "financialHistory": {
    "revenue": [{ "year": 2020, "value": 9754823000 }, "..."]
  },
  "warnings": { "hasInsolvency": false, "hasDebts": false },
  "dataFreshness": { "rpoUpdatedAt": "2026-04-22", "scrapedAt": "2026-04-28T..." }
}
```

CZ records add `directors`, `partners` (with `shares[]`), `vatStatus`, `registrace` (6 registry states).

The **Output** tab in Apify Console offers 4 specialized views: **Overview**, **Finance**, **People** (directors & partners), **Red flags** (insolvency, debts, VAT inactive).

## Pricing

Free Actor — pay only Apify **compute units** + **proxy traffic**. Real-world cost: **~$0.003 per IČO** (about 70 hellers / 0.03 zł), so 1000 IČOs ≈ $3. CZ subjects are slower (Playwright browser render of MSP SPA), SK subjects faster (HTTP only).

## FAQ

**Is scraping public registry data legal?**
The Actor extracts only data that subjects have themselves published per disclosure law (commercial register CZ/SK, ARES, RPO). No login bypass, no protected data. For commercial use in the EU, follow GDPR — names of physical persons (directors, shareholders) are personal data.

**How does this compare to Bisnode, finstat Premium, or Albertina?**
Bisnode/D&B: ~25× more expensive but covers global firmographics + credit scores. finstat Premium: SK-only with full director history and credit ratings (~350 Kč/month). Albertina: CZ-only XML database (~30 000+ Kč/year). For identification, KYC and basic enrichment in both CZ and SK, this Actor matches their depth at marginal Apify cost.

**Why is a record missing for a specific IČO?**
Either IČO doesn't exist in any registry (returns no record) or the source page changed structure (returns null `name`). Report in Issues with the specific IČO.

**Can I use it from my own app without Apify Console?**
Yes — Apify REST API supports start runs, read datasets, and webhooks from anything that speaks HTTP. See the **API** tab for examples.

**How fresh is the data?**
ARES: typically daily sync. RPO: updated only when the subject changes (could be months for stable companies). finstat.sk: yearly after annual report publication (Q2-Q3). The `dataFreshness` field shows exact timestamps.

## Sources

- [finstat.sk](https://www.finstat.sk) — Slovak financial-legal portal (public part)
- [verejnerejstriky.msp.gov.cz](https://verejnerejstriky.msp.gov.cz) — Czech commercial registry (Ministry of Justice)
- [ares.gov.cz](https://ares.gov.cz) — Czech administrative register of economic subjects
- [data.gov.sk RPO](https://data.gov.sk) — Slovak Register of Legal Entities (CC-BY licence)

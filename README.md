<!-- H1 generuje Apify Store automaticky z `title` v actor.json. -->

> **Bulk lookup CZ & SK companies by IČO** from 4 official registries. No API key. AI-ready JSON.

## CZ/SK Company Info — Free IČO Lookup

An Actor that extracts public company data for **Czech and Slovak businesses** using their IČO (8-digit business identifier). Combines 4 official sources in a single structured JSON output: **MSP rejstřík** (Czech business registry — statutory representatives, partners with shares, business activities), **ARES** (Czech economic register — DIČ, NACE codes, **insolvency flag**, VAT status, 6 registry states, last-update timestamp), **finstat.sk** (Slovak financials — up to 5 years of revenue/profit/assets/equity history, debts and bankruptcy flags), and **RPO data.gov.sk** (Slovak legal entities register — name history, file number, last-update date). In `auto` mode each IČO is queried in both countries; set `country` explicitly to query only one. CZ subjects fall back to ARES when the MSP commercial registry has no record (state organizations, public universities, ministries). Architecture: CheerioCrawler over HTTP for finstat.sk, PlaywrightCrawler for the MSP Vue/Nuxt SPA, direct HTTP JSON for ARES and RPO with `Retry-After` handling. Free, no signup, no API key required for any source.

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

Free Actor — you pay only for Apify **compute units** and **proxy traffic**.

Measured in our own cloud test (build 0.2.1, 11 IČOs, residential proxy, 4 GB memory): the run took **1m 30s** and cost **$0.036** total — about **$0.003 per IČO** in this configuration. CZ subjects are slower than SK (PlaywrightCrawler avg 14.2 s/request vs CheerioCrawler avg 0.8 s/request) because the MSP portal is a Vue/Nuxt SPA that requires a browser render, while finstat.sk responds with static HTML.

## FAQ

**Is scraping public registry data legal?**
The Actor extracts only data that subjects have themselves published per disclosure law (commercial register CZ/SK, ARES, RPO). No login bypass, no protected data. For commercial use in the EU, follow GDPR — names of physical persons (directors, shareholders) are personal data.

**Need full director history for SK, credit scores, or global firmographics?**
This Actor focuses on free public sources. Paid alternatives that cover those gaps include finstat Premium (SK), Albertina (CZ), and Bisnode/D&B (global) — pricing varies by tier and is not part of this Actor.

**Why is a record missing for a specific IČO?**
Either IČO doesn't exist in any registry (returns no record) or the source page changed structure (returns null `name`). Report in Issues with the specific IČO.

**Can I use it from my own app without Apify Console?**
Yes — Apify REST API supports start runs, read datasets, and webhooks from anything that speaks HTTP. See the **API** tab for examples.

**How fresh is the data?**
The `dataFreshness` field on every record shows exact timestamps:
- `aresUpdatedAt` — `datumAktualizace` reported by ARES for that subject
- `rpoUpdatedAt` — `dbModificationDate` reported by RPO for that subject
- `scrapedAt` — when this Actor run fetched the data

In our 11-subject test these timestamps ranged from 2025-07-07 to 2026-04-22, so values for stable companies can be older than the date you run the Actor. Both ARES and RPO update the timestamp only when the subject record actually changes.

## Sources

- [finstat.sk](https://www.finstat.sk) — Slovak financial-legal portal (public part)
- [verejnerejstriky.msp.gov.cz](https://verejnerejstriky.msp.gov.cz) — Czech commercial registry (Ministry of Justice)
- [ares.gov.cz](https://ares.gov.cz) — Czech administrative register of economic subjects
- [data.gov.sk RPO](https://data.gov.sk) — Slovak Register of Legal Entities (CC-BY licence)

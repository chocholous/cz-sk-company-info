<!-- H1 generuje Apify Store automaticky z `title` v actor.json. -->

## Co dělá CZ/SK Company Info?

Stahuje **veřejné údaje o firmách v Česku a na Slovensku** podle IČO. Kombinuje **čtyři oficiální zdroje** v jediném strukturovaném JSON výstupu, žádný API klíč potřeba není:

- **CZ:** [Veřejný rejstřík MSP](https://verejnerejstriky.msp.gov.cz) (statutáři, společníci, předmět podnikání) + [ARES](https://ares.gov.cz) (DIČ, NACE, DPH status, **insolvence flag**)
- **SK:** [finstat.sk](https://www.finstat.sk) (5letá finanční historie, flagy dluhy/konkurz) + [data.gov.sk RPO](https://data.gov.sk) (historie jmen, spisová značka, čerstvost dat)

**Není to** plnohodnotný klon finstat Premium ani Bisnode — je to **rychlý lookup pro identifikaci a první obohacení**, ideální pro CRM, KYC, sales prospecting nebo AI agenty.

## Proč použít CZ/SK Company Info?

- **Dvě země v jednom requestu** — CZ i SK firmy v jedné dávce, žádné nutné rozhodování.
- **Žádný API klíč k cílovým službám** — jen IČO.
- **Insolvence flag** přímo z oficiálního zdroje (ARES).
- **Čerstvost dat:** ARES typicky aktualizuje denně, RPO při změně subjektu — pole `dataFreshness` ti řekne, jak staré data jsou.
- **Apify výhody:** plánování (cron schedules), REST/Webhook API, integrace s Make/Zapier/n8n, residential proxy, monitoring.
- **Strukturovaný JSON** — snadno mapovatelný do CRM/ERP/BI, taky vhodný pro RAG/LLM agenty.

## Jaká data CZ/SK Company Info extrahuje?

| Pole | Typ | Popis |
|---|---|---|
| `ico` | string | IČO (8 číslic, doplněno nulami) |
| `country` | `cz` / `sk` | země zdroje |
| `name` | string | aktuální obchodní název |
| `legalForm` | string | právní forma |
| `establishedAt` / `dissolvedAt` | datum | vznik / zánik |
| `dic` / `icDph` | string | daňová identifikace, IČ DPH |
| `address` | objekt | rozparsované sídlo: `full`, `street`, `zip`, `city` |
| `classification` | objekt | NACE kód + popis, NACE kódy (CZ), kraj, okres, spisová značka |
| `financials` | objekt | poslední rok: `revenue`, `profit`, `assets`, `equity`, `currency` |
| **`financialHistory`** | objekt | 5letá řada `revenue/profit/assets/liabilities` (jen SK) |
| **`businessActivities`** | objekt | `license` + `activities[]` — předmět podnikání |
| **`directors`** | array | statutáři: `role`, `name`, `birthDate`, `address`, `sinceDate` (jen CZ) |
| **`partners`** | array | společníci s `shares[]` (vklad, podíl, druh) — jen CZ |
| **`warnings`** | objekt | `hasInsolvency`, `hasDebts`, `hasTemporaryProtection` |
| **`vatStatus`** | objekt | DPH plátce — `active`, `stateCode` (CZ z ARES) |
| **`registrace`** | objekt | stavy 6 CZ registrů (ROS/VR/RES/RZP/DPH/IR) |
| **`nameHistory`** | array | historie obchodních jmen (SK z RPO) |
| **`dataFreshness`** | objekt | `aresUpdatedAt`, `rpoUpdatedAt`, `scrapedAt` |
| `sourceUrl` / `scrapedAt` | string | odkaz a čas stažení |

> **Poznámka k financím:** finstat.sk publikuje finanční ukazatele jen u firem, které mají povinnost zveřejnit účetní závěrku ve Sbírce listin (typicky **a.s.**, **nadace**, větší **s.r.o.**). Malé s.r.o. a živnostníci budou mít `financials: null`.

## Jak naskripovat CZ/SK firmy

1. **Otevři záložku Input** v Apify Console.
2. Vlož **seznam IČO** (8místných čísel; nuly se doplní automaticky).
3. Volitelně omez `country` na `cz` nebo `sk`, pokud znáš zdroj všech IČO — ušetříš compute units.
4. Doporučujeme **Apify Proxy → RESIDENTIAL** (default).
5. **Spusť** — actor pojede paralelně přes všechny zdroje a uloží 1 záznam = 1 firma do datasetu.

## Kolik to stojí?

- **Lokální vývoj** (`apify run`): zdarma, jen tvůj čas.
- **Apify cloud:** poplatek za **compute units** (CU) + **proxy** (residential traffic).
- **Odhad:** 100 IČO ≈ 5–15 minut běhu na default `defaultMemoryMbytes: 4096`. CZ subjekty jsou pomalejší (browser render MSP), SK rychlejší (HTTP only).
- Pro **velký batch** (tisíce IČO) snižte concurrency a rozdělte do menších runs s schedule.

## Input

Plné nastavení v záložce **Input**. Klíčová pole:

```json
{
  "icos": ["35757442", "04788290"],
  "country": "auto",
  "maxConcurrency": 5,
  "maxRequestRetries": 3,
  "requestTimeoutSecs": 30,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output

Dataset stáhneš jako **JSON, CSV, XLSX, HTML nebo XML**. Ukázkový SK záznam:

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
    "revenue": [{"year": 2020, "value": 9754823000}, ...],
    "profit":  [{"year": 2020, "value": 206684000}, ...]
  },
  "warnings": { "hasInsolvency": false, "hasDebts": false },
  "dataFreshness": { "rpoUpdatedAt": "2026-04-22", "scrapedAt": "2026-04-28T..." },
  "sourceUrl": "https://www.finstat.sk/35757442"
}
```

CZ záznam navíc obsahuje pole `directors` (statutární orgán), `partners` (společníci s podíly), `businessActivities` (živnost + obory), `vatStatus`, `registrace`.

## Tips

- **Pro malou kontrolu** (1–5 IČO) nech `concurrency: 3` — minimalizuješ riziko rate-limitu RPO.
- **Pro velký batch** zapni `RESIDENTIAL` proxy a drž `concurrency: 5–10` — rotace IP obejde per-IP limity.
- Pokud `name` vychází `null`, IČO buď neexistuje, nebo cílová stránka změnila strukturu HTML — nahlas v záložce Issues.
- Pro **integraci do CRM** použij Apify webhook při dokončení runu, nebo zavolej Apify API z vlastní aplikace.
- Pro **AI agenty:** záznam je pre-flat strukturovaný — skvěle se hodí jako kontext pro LLM (RAG, function calling).

## FAQ a disclaimers

**Je scraping veřejných údajů legální?**
Náš Actor extrahuje výhradně data, která zveřejnitelé sami publikovali (firmy podle zákona o účetnictví, obchodní rejstřík ČR/SR, ARES, RPO). Nezpracováváme žádná data, která by nebyla veřejně dostupná bez přihlášení.

> Naše Actory jsou etické a neextrahují žádná soukromá uživatelská data. Stahují pouze to, co subjekt sám zveřejnil podle platné legislativy. Pokud používáte výstup pro komerční účely v rámci EU, dodržujte GDPR a další lokální regulace — jména fyzických osob (statutáři, společníci) jsou osobní údaje a podléhají právní úpravě.

**Co když actor selže pro konkrétní IČO?**
- IČO neexistuje v daném registru → záznam se nevytvoří, není to chyba.
- Cílová stránka změnila strukturu → nahlas v Issues s konkrétním IČO.
- Rate limit RPO → zvedni `maxRequestRetries` nebo zapni residential proxy.

**Můžu actor naplánovat?**
Ano — Apify Schedules podporuje cron syntax. Užitečné pro denní obohacování nově registrovaných IČO v CRM nebo monitoring insolvence portfolia firem.

**Funguje pro velký batch (tisíce IČO)?**
Ano, ale rozdělte do menších runs (každý ~500 IČO) a sledujte log na rate-limit chyby. ARES je rychlý, RPO má anonymní limit (residential proxy ho obchází).

## Zdroje

- [finstat.sk](https://www.finstat.sk) — slovenský finančně-právní info portal (veřejná část)
- [verejnerejstriky.msp.gov.cz](https://verejnerejstriky.msp.gov.cz) — veřejný obchodní rejstřík ČR (MSP)
- [ares.gov.cz](https://ares.gov.cz) — Administrativní registr ekonomických subjektů ČR
- [data.gov.sk RPO](https://data.gov.sk) — Register právnických osôb SR (CC-BY licence)

<!-- H1 generuje Apify Store automaticky z `title` v actor.json. -->

> **Lookup firem v ČR a SR podle IČO.** Strukturovaný JSON ze 4 oficiálních zdrojů — bez API klíče, bez Premium předplatného.

## Co dělá CZ/SK Company Info?

Stahuje **veřejné údaje o firmách v Česku a na Slovensku** podle IČO. Kombinuje **čtyři oficiální registry** v jediném strukturovaném JSON výstupu:

| Země | Zdroj | Co přidá |
|---|---|---|
| 🇨🇿 CZ | [Veřejný rejstřík MSP](https://verejnerejstriky.msp.gov.cz) | Statutáři, společníci s podíly, předmět podnikání, spisová značka |
| 🇨🇿 CZ | [ARES](https://ares.gov.cz) | DIČ, NACE kódy, **insolvence flag**, DPH status, 6 stavů registrů, čerstvost |
| 🇸🇰 SK | [finstat.sk](https://www.finstat.sk) | **5letá finanční historie**, flagy konkurz/dluhy, předměty podnikania |
| 🇸🇰 SK | [RPO data.gov.sk](https://data.gov.sk) | Historie obchodních jmen, spisová značka, dbModificationDate |

**Není to** plnohodnotný klon Bisnode/Albertina — je to **rychlý lookup** pro identifikaci, KYC, sales prospecting a obohacení dat v CRM.

## Proč použít CZ/SK Company Info?

- 🌍 **Dvě země, jeden request** — CZ i SK firmy v jedné dávce.
- 🔓 **Žádný API klíč k cílovým službám** — jen IČO.
- 🚨 **Insolvence flag** přímo z oficiálního zdroje (ARES).
- 📅 **Audit čerstvosti** — pole `dataFreshness` ti řekne, jak staré data jsou (ARES typicky denní update, RPO při změně).
- ⚙️ **Apify integrace:** plánování (cron), Webhook API, Make/Zapier/n8n, residential proxy, monitoring.
- 🤖 **AI-ready JSON** — strukturovaný, pre-flat, ideální jako kontext pro LLM agenty (RAG, function calling).

## Srovnání s konkurencí

| Vlastnost | **CZ/SK Company Info** | Bisnode / Dun & Bradstreet | finstat Premium | Albertina |
|---|---|---|---|---|
| Cena | Jen Apify compute units | ~1 000 Kč / firma | 350+ Kč / měs | 30 000+ Kč / rok |
| Kombinace CZ+SK | ✅ | ✅ | ❌ jen SK | ❌ jen CZ |
| API klíč | ❌ není potřeba | ✅ vyžaduje smlouvu | ✅ | ✅ |
| Statutáři & společníci (CZ) | ✅ | ✅ | ❌ | ✅ |
| 5letá finanční historie (SK) | ✅ | ✅ | ✅ | ❌ |
| Insolvence flag | ✅ z ARES | ✅ | ✅ | ✅ |
| Strukturovaný JSON | ✅ | ✅ | JSON/XML | XML |
| Schedule + webhooks | ✅ Apify | ❌ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ | ❌ |

**Závěr:** Pro identifikaci, KYC a obohacení dat dáváme srovnatelnou hloubku jako placené nástroje za cenu Apify cloudu (typicky < 1 Kč / IČO).

## Jaká data CZ/SK Company Info extrahuje?

| Pole | Typ | Popis |
|---|---|---|
| `ico` | string | IČO (8 číslic, doplněno nulami) |
| `country` | `cz` / `sk` | Země zdroje |
| `name` | string | Aktuální obchodní název |
| `legalForm` | string | Právní forma |
| `establishedAt` / `dissolvedAt` | datum | Vznik / zánik |
| `dic` / `icDph` | string | Daňová identifikace, IČ DPH |
| `address` | objekt | Rozparsované sídlo: `full`, `street`, `zip`, `city` |
| `classification` | objekt | NACE kód + popis, NACE kódy (CZ), kraj, okres, spisová značka |
| `financials` | objekt | Poslední rok: `revenue`, `profit`, `assets`, `equity`, `currency` |
| **`financialHistory`** | objekt | 5letá řada `revenue/profit/assets/liabilities` (jen SK) |
| **`businessActivities`** | objekt | `license` + `activities[]` — předmět podnikání |
| **`directors`** | array | Statutáři: `role`, `name`, `birthDate`, `address`, `sinceDate` (jen CZ) |
| **`partners`** | array | Společníci s `shares[]` (vklad, podíl, druh) — jen CZ |
| **`warnings`** | objekt | `hasInsolvency`, `hasDebts`, `hasTemporaryProtection` |
| **`vatStatus`** | objekt | DPH plátce — `active`, `stateCode` (CZ z ARES) |
| **`registrace`** | objekt | Stavy 6 CZ registrů (ROS/VR/RES/RZP/DPH/IR) |
| **`nameHistory`** | array | Historie obchodních jmen (SK z RPO) |
| **`dataFreshness`** | objekt | `aresUpdatedAt`, `rpoUpdatedAt`, `scrapedAt` |
| `sourceUrl` / `scrapedAt` | string | Odkaz a čas stažení |

> **Poznámka k financím:** finstat.sk publikuje finanční ukazatele jen u firem, které mají povinnost zveřejnit účetní závěrku ve Sbírce listin (typicky **a.s.**, **nadace**, větší **s.r.o.**). Malé s.r.o. a živnostníci budou mít `financials: null`.

## Co dostanete pro jaký typ subjektu

Pokrytí závisí na typu subjektu a registru, ze kterého actor čerpá. Tabulka odráží **empirický test reálných firem** (ne teoretické možnosti):

| Typ subjektu | Identif. + adresa | NACE | Statutáři | Společníci | Finance | 5letá historie | Warnings | Audit |
|---|---|---|---|---|---|---|---|---|
| 🇨🇿 **a.s.** velká (ČEZ) | ✅ | ✅ | ✅ představenstvo | — | kapitál | — | ✅ | ✅ ARES |
| 🇨🇿 **s.r.o.** (Apify) | ✅ | ✅ | ✅ jednatelé | ✅ s podíly | kapitál | — | ✅ | ✅ ARES |
| 🇨🇿 **nadace** | ✅ | ✅ | ✅ správní rada | — | — | — | ✅ | ✅ ARES |
| 🇨🇿 **SVJ** | ✅ | ✅ | ✅ výbor | — | — | — | ✅ | ✅ ARES |
| 🇨🇿 **spolek** | ✅ | ✅ | ✅ předseda/výbor | — | — | — | ✅ | ✅ ARES |
| 🇨🇿 **veřejná VŠ / státní org** | ✅ ARES | částečně | — není v MSP | — | — | — | ✅ ARES | ✅ ARES |
| 🇸🇰 **a.s.** velká (VW, Allianz) | ✅ | ✅ | — finstat ne | — | ✅ kompletní | ✅ 5 let | ✅ flagy | ✅ RPO |
| 🇸🇰 **s.r.o.** (ESET) | ✅ | ✅ | — finstat ne | — | ✅ kompletní | ✅ 5 let | ✅ | ✅ RPO |
| 🇸🇰 **nadácia** | ✅ | ✅ | — | — | rok jen | — | ✅ | ✅ RPO |

**Co je systémově nemožné** (nedáme to ani my, ani konkurence ze zdarma zdrojů):
- Akcionáři velkých CZ a.s. — jsou neveřejní v CDCP
- 5letá finanční historie pro CZ subjekty — finstat.sk je jen pro SK; ČR ekvivalent zdarma neexistuje
- Statutáři pro SK subjekty — finstat skrývá za Premium

**Co naopak dostanete navíc** oproti default expectation:
- **CZ státní organizace, ministerstva, veřejné VŠ, příspěvkové organizace** — actor je dohledá přes ARES API i když nejsou v obchodním rejstříku (od v0.1.3)
- **SVJ a spolky** — statutární orgán z MSP rejstříku se správně rozparsuje na role (Předseda, Členové výboru atd.)

## Use-cases

### 💼 Sales prospecting & lead enrichment
Stahování firmografie (NACE, kraj, právní forma, finance) pro segmentaci a scoring. Kombinace s LinkedIn / web scraperem dává komplexní leads database.

### ✅ KYC & due-diligence
Insolvence flag, DPH plátce status, stav v 6 registrech, společníci s podíly — minimum vendor risk informací pro CRM/ERP.

### 📊 Portfolio monitoring
Schedule s denním/týdenním cronem hlídá změny `dataFreshness` a `warnings.hasInsolvency` u sledovaných IČO. Webhook posílá alert do Slack/Teams.

### 🤖 AI agenti (RAG, function calling)
Strukturovaný JSON je přímo použitelný jako tool output pro LLM. Agent dostane kompletní firemní profil, může uvažovat o vztazích (statutáři, vlastnická struktura).

### 🔄 CRM/ERP synchronizace
Nightly batch obohacuje záznamy v Pipedrive/HubSpot/Salesforce o čerstvá data. Apify Webhook → Make/Zapier scénář → CRM API.

## Jak naskripovat CZ/SK firmy

1. **Otevři záložku Input** v Apify Console.
2. Vlož **seznam IČO** (8místných čísel; nuly se doplní automaticky).
3. Volitelně omez `country` na `cz` nebo `sk`, pokud znáš zdroj všech IČO — ušetříš ~50 % compute units.
4. Doporučujeme **Apify Proxy → RESIDENTIAL** (default).
5. **Spusť** — actor pojede paralelně přes všechny zdroje a uloží 1 záznam = 1 firma do datasetu.

## Kolik to stojí?

- **Lokální vývoj** (`apify run`): zdarma, jen tvůj čas.
- **Apify cloud:** poplatek za **compute units** + **proxy traffic**.
- **Reálný odhad:** 100 IČO ≈ 5–15 minut runtime na 4 GB RAM. CZ subjekty pomalejší (browser render MSP), SK rychlejší (HTTP only).
- **Cenový řád:** typicky **< 1 Kč na IČO** vč. residential proxy.
- Pro **velký batch** (tisíce IČO) snižte concurrency a rozdělte do menších runs s schedule.

## Input

Plné nastavení v záložce **Input**. Klíčová pole:

```json
{
  "icos": ["35757442", "04788290", "31322832"],
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

Dataset stáhneš jako **JSON, JSONL, CSV, XLSX, HTML nebo XML**. Ukázkový SK záznam:

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
    "revenue": [{ "year": 2020, "value": 9754823000 }, "..."],
    "profit": [{ "year": 2020, "value": 206684000 }, "..."]
  },
  "warnings": { "hasInsolvency": false, "hasDebts": false },
  "dataFreshness": { "rpoUpdatedAt": "2026-04-22", "scrapedAt": "2026-04-28T..." },
  "sourceUrl": "https://www.finstat.sk/35757442"
}
```

CZ záznam navíc obsahuje pole `directors` (statutární orgán), `partners` (společníci s podíly), `businessActivities` (živnost + obory), `vatStatus`, `registrace`.

### Dataset views v Console

V záložce **Output** se Apify Console přepneš mezi 4 pohledy:
- **Přehled** — nejdůležitější pole pro identifikaci a sales scoring
- **Finance** — detailní finanční ukazatele + DPH status + čerstvost
- **Statutáři & společníci** — vedení a vlastnická struktura (CZ)
- **Red flags** — insolvence, dluhy, dočasná ochrana, zánik (KYC pohled)

## Integrace

### Apify API (REST)

```bash
curl -X POST "https://api.apify.com/v2/acts/<ACTOR_ID>/runs?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "icos": ["35757442"], "country": "sk" }'
```

### Make / Integromat

1. Modul **Apify → Run an Actor**
2. Vyber `cz-sk-company-info`
3. JSON input s polem `icos` mapovaným z předchozího kroku (např. CRM kontakty)
4. **Apify → Get Dataset Items** — naváže výsledky pro další zpracování

### Zapier

Actor je dostupný přes **Apify** integraci. Triggery: schedule + run finished → Custom Webhook → tvoje aplikace.

### n8n

```yaml
- node: Apify
  operation: runActor
  actorId: cz-sk-company-info
  input: { icos: "{{ $json.companyIds }}", country: "auto" }
```

### Webhooks

Apify Console → Actor → Webhooks → spustí se na `ACTOR.RUN.SUCCEEDED` a pošle URL datasetu do tvého endpointu.

## Tips & best practices

- 🐢 **Pro malou kontrolu** (1–5 IČO) drž `concurrency: 3` — minimalizuje rate-limit RPO.
- 🚀 **Pro velký batch** zapni `RESIDENTIAL` proxy a `concurrency: 5–10` — rotace IP obejde per-IP limity.
- 🇨🇿 **Pro 100 % CZ data** nastav `country: "cz"` — ušetříš ~50 % requestů a vyhneš se IČO collision (níže).
- 📅 **Pro recurring monitoring** vytvoř Apify Schedule (cron) + Webhook → tvoje aplikace.
- 🐛 Pokud `name` vychází `null`, IČO buď neexistuje, nebo cílová stránka změnila strukturu — nahlas v záložce Issues.
- 💾 **Pro AI agenty** mapuj `financialHistory.revenue[]` jako sparkline data, `partners[]` jako graph nodes.

### ⚠️ IČO collision v auto módu

CZ a SK IČO mají stejný formát (8 číslic). Některá CZ IČO **náhodou existují i v SK** registru, ale představují úplně jinou firmu. Příklad: IČO `45274649` = ČEZ a.s. v ČR, ale taky *ABC - servis, s. r. o.* v SK.

V auto módu actor uloží **oba záznamy** (každý s vlastním `country`). To může zkreslit data v CRM, pokud importuješ jen podle IČO bez kontroly země.

**Řešení:** Pokud máš seznam IČO z jedné země, **vždy nastav `country` explicitně** (`cz` nebo `sk`). Auto mód nech jen pro skutečně smíšené dávky, kdy potřebuješ pokrytí obou zemí.

## FAQ

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

**Jaký je rozdíl mezi tímto actorem a finstat Premium API?**
finstat Premium dává plnohodnotný API přístup k SK datům včetně historie statutářů, kreditního scoringu a real-time monitoringu — za 350+ Kč měsíčně. Tento actor pokrývá běžné identifikační + základní finanční use-cases pro CZ i SK za marginální cenu Apify cloudu, ale není to substitut pro plnotučný due-diligence nástroj.

**Mohu volat actor z vlastní aplikace bez Apify Console?**
Ano — viz sekce **Integrace** výše. Apify REST API umožňuje runs, dataset reading i webhooks z čehokoli, co umí HTTP.

## Zdroje a licence

- [finstat.sk](https://www.finstat.sk) — slovenský finančně-právní info portal (veřejná část)
- [verejnerejstriky.msp.gov.cz](https://verejnerejstriky.msp.gov.cz) — veřejný obchodní rejstřík ČR (Ministerstvo spravedlnosti)
- [ares.gov.cz](https://ares.gov.cz) — Administrativní registr ekonomických subjektů ČR
- [data.gov.sk RPO](https://data.gov.sk) — Register právnických osôb SR (CC-BY licence)

Source code dostupný v privátním GitHub repu.

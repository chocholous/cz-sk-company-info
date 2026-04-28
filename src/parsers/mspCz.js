import { log } from "apify";
import { CZ } from "../constants.js";
import { parseAddress, parseFinancialNumber, sanitizeText } from "../utils.js";

const READY_TIMEOUT_MS = 30_000;
// Po Vue/Nuxt hydraci se v DOM objeví .detail-row (jeden řádek = jedno pole).
// Pokud se neobjeví do timeoutu, IČO pravděpodobně neexistuje (zobrazí se 404 SPA).
const READY_SELECTOR = ".detail-row";

const CZ_MONTHS_GENITIVE = {
	ledna: 1,
	února: 2,
	března: 3,
	dubna: 4,
	května: 5,
	června: 6,
	července: 7,
	srpna: 8,
	září: 9,
	října: 10,
	listopadu: 11,
	prosince: 12,
};

const parseCzDate = (str) => {
	if (!str) return null;
	const named = str.match(/(\d{1,2})\.\s+(\p{L}+)\s+(\d{4})/u);
	if (named) {
		const day = Number(named[1]);
		const month = CZ_MONTHS_GENITIVE[named[2].toLowerCase()];
		const year = Number(named[3]);
		if (month)
			return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}
	const numeric = str.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
	if (numeric) {
		return `${numeric[3]}-${String(Number(numeric[2])).padStart(2, "0")}-${String(Number(numeric[1])).padStart(2, "0")}`;
	}
	return null;
};

export const waitForMspContent = async (page) => {
	await page.waitForSelector(READY_SELECTOR, { timeout: READY_TIMEOUT_MS });
};

// Vrací VŠECHNY detail-row v pořadí jak jsou v DOM. Multi-occurrence labelů (Společník, Podíl,
// Jednatel) jsou důležité pro správné seskupení, takže nemůžeme dedupovat.
export const extractMspRows = async (page) => {
	return page.evaluate(() => {
		return Array.from(document.querySelectorAll(".detail-row")).map((row) => {
			const label = (row.querySelector(".label")?.textContent ?? "")
				.replace(/\s+/g, " ")
				.replace(/[:\s]+$/, "")
				.trim();
			const value = (row.querySelector(".value")?.textContent ?? "").trim();
			return { label, value };
		});
	});
};

// "JAN ČURN (nar. 30. dubna 1983)  U Kublova 537/1, ... Den vzniku funkce: 15. února 2016"
const parsePerson = (value) => {
	if (!value) return null;
	const text = value.replace(/\s+/g, " ").trim();
	const named = text.match(/^([^(]+?)\s*\(nar\.\s*([^)]+)\)\s*(.*)$/);
	if (named) {
		const rest = named[3].split(/\s*Den vzniku funkce[:\s]+/);
		const address = sanitizeText(rest[0]);
		const sinceRaw = rest[1] ? sanitizeText(rest[1]) : null;
		return {
			name: sanitizeText(named[1]),
			birthDate: parseCzDate(named[2]),
			address: address || null,
			sinceDate: sinceRaw ? parseCzDate(sinceRaw) : null,
		};
	}
	return { name: text, birthDate: null, address: null, sinceDate: null };
};

// "Run Succeeded s.r.o.  (IČO: 231 53 580)  Vodičkova 704/36, ..."
const parseCorporatePartner = (value) => {
	if (!value) return null;
	const text = value.replace(/\s+/g, " ").trim();
	const m = text.match(/^(.+?)\s*\(IČO:\s*([\d ]+)\)\s*(.*)$/);
	if (m) {
		return {
			name: sanitizeText(m[1]),
			ico: m[2].replace(/\s/g, "") || null,
			address: sanitizeText(m[3]) || null,
			isPerson: false,
		};
	}
	// Fallback: žádné IČO → fyzická osoba
	const person = parsePerson(value);
	return person ? { ...person, isPerson: true } : null;
};

// "Vklad: 8 083,- Kč\nSplaceno: 100 %\nObchodní podíl: 8083;103199\nDruh podílu: základní"
const parseShare = (value) => {
	if (!value) return null;
	const lines = value
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const out = {
		investment: null,
		paidPercent: null,
		fraction: null,
		type: null,
	};
	for (const line of lines) {
		const inv = line.match(/^Vklad:\s*(.+)$/);
		const paid = line.match(/^Splaceno:\s*([\d.,]+)\s*%/);
		const frac = line.match(/^Obchodní podíl:\s*(\d+);(\d+)/);
		const type = line.match(/^Druh podílu:\s*(.+)$/);
		if (inv) out.investment = parseFinancialNumber(inv[1]);
		if (paid) out.paidPercent = Number(paid[1].replace(",", "."));
		if (frac) out.fraction = `${frac[1]}/${frac[2]}`;
		if (type) out.type = sanitizeText(type[1]);
	}
	return out;
};

// "Výroba, obchod a služby ..., obory činnosti:\n- Výroba ...\n- Zprostředkování ..."
const parseBusinessActivities = (value) => {
	if (!value) return null;
	const lines = value
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const items = [];
	let livnostHeading = null;
	for (const line of lines) {
		if (line.startsWith("- ")) {
			items.push(line.slice(2).trim());
		} else if (!livnostHeading) {
			livnostHeading = line;
		}
	}
	return {
		license: livnostHeading,
		activities: items.length > 0 ? items : null,
	};
};

const DIRECTOR_LABELS = new Set([
	"Jednatel",
	"Předseda představenstva",
	"Místopředseda představenstva",
	"Člen představenstva",
	"Předseda dozorčí rady",
	"Místopředseda dozorčí rady",
	"Člen dozorčí rady",
	"Likvidátor",
	"Prokurista",
]);

export const buildMspRecord = (rows, ico, sourceUrl) => {
	const labels = {};
	const directors = [];
	const partners = [];
	let currentPartner = null;

	const finalizePartner = () => {
		if (currentPartner) partners.push(currentPartner);
		currentPartner = null;
	};

	for (const { label, value } of rows) {
		if (!label) continue;
		if (DIRECTOR_LABELS.has(label)) {
			const person = parsePerson(value);
			if (person) directors.push({ role: label, ...person });
			continue;
		}
		if (label === "Společník") {
			finalizePartner();
			const partner = parseCorporatePartner(value);
			currentPartner = partner ? { ...partner, shares: [] } : null;
			continue;
		}
		if (label === "Podíl" && currentPartner) {
			const share = parseShare(value);
			if (share) currentPartner.shares.push(share);
			continue;
		}
		// Pro běžná pole stačí první výskyt (deduplicate).
		// Hodnoty pro businessActivities/směr potřebujeme s newlinami → uložíme raw value
		// a sanitizujeme až při použití.
		if (!labels[label]) labels[label] = value;
	}
	finalizePartner();

	const pickRaw = (...keys) => {
		for (const key of keys) if (labels[key]) return labels[key];
		return null;
	};
	const pick = (...keys) => sanitizeText(pickRaw(...keys));

	const name = pick("Obchodní firma", "Název subjektu", "Název");
	const legalForm = pick("Právní forma");
	const established = pick(
		"Datum vzniku a zápisu",
		"Datum vzniku",
		"Datum zápisu",
	);
	const dissolved = pick("Datum zániku", "Datum výmazu");
	const addressFull = pick("Sídlo", "Adresa");
	const spis = pick("Spisová značka");
	const capital = pick("Základní kapitál", "Vklad");
	// Předmět podnikání musí zachovat newlines pro správné rozdělení činností.
	const businessRaw = pickRaw("Předmět podnikání", "Předmět činnosti");

	if (!name) {
		log.warning(`MSP CZ: parser nenašel obchodní firmu pro IČO ${ico}.`);
		log.debug(
			`MSP CZ raw labels for ${ico}: ${JSON.stringify(rows.map((r) => r.label))}`,
		);
	}

	return {
		ico,
		country: CZ,
		name,
		legalForm,
		establishedAt: parseCzDate(established),
		dissolvedAt: parseCzDate(dissolved),
		dic: null,
		icDph: null,
		address: parseAddress(addressFull),
		classification: {
			nace: null,
			naceDescription: null,
			employeeCategory: null,
			region: null,
			spisovaZnacka: spis,
		},
		financials: capital
			? {
					year: null,
					revenue: null,
					profit: null,
					assets: null,
					equity: null,
					registeredCapital: capital,
					currency: "CZK",
				}
			: null,
		financialHistory: null,
		businessActivities: parseBusinessActivities(businessRaw),
		directors: directors.length > 0 ? directors : null,
		partners: partners.length > 0 ? partners : null,
		warnings: null,
		sourceUrl,
		scrapedAt: new Date().toISOString(),
	};
};

// Zpětně kompatibilní wrapper (pokud by chtěl někdo extracted labely jako objekt).
// Aktuálně používáme buildMspRecord přímo z main.js.

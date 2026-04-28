import { CZ, SK } from "../constants.js";
import { parseAddress, parseFinancialNumber, sanitizeText } from "../utils.js";

// finstat zobrazuje stavové vlajky jako "ÁNO" / "NIE" v <span> (s ikonou fa).
const parseFlag = (str) => {
	if (!str) return null;
	const t = str.toLocaleUpperCase("sk-SK");
	if (t.includes("ÁNO") || /\bANO\b/.test(t)) return true;
	if (/\bNIE\b/.test(t) || /\bNE\b/.test(t)) return false;
	return null;
};

// Z Highcharts inline configů vytáhneme 5letou řadu pro Tržby/Zisk/Aktíva/Vlastný kapitál.
// Struktura: title: 'Zisk', ... categories: ["2020", ...], series: [{...,"data":[{"y":N},...]}]
const FINSTAT_METRIC_MAP = {
	Tržby: "revenue",
	Zisk: "profit",
	Aktíva: "assets",
	Pasíva: "liabilities",
	"Celkové výnosy": "totalRevenue",
};

const extractFinancialHistory = (html) => {
	if (!html) return null;
	const out = {};
	for (const [skLabel, key] of Object.entries(FINSTAT_METRIC_MAP)) {
		const idx = html.indexOf(`title: '${skLabel}'`);
		if (idx === -1) continue;
		const block = html.slice(idx, idx + 4000);
		const cats = block.match(/categories:\s*\[([^\]]+)\]/);
		// Highcharts series JSON: "data":[{"y":N},...]. Klíč data je v uvozovkách.
		const data = block.match(/"data":\s*\[([^\]]+)\]/);
		if (!cats || !data) continue;
		const years = (cats[1].match(/\d{4}/g) ?? []).map(Number);
		const values = [...data[1].matchAll(/"y":\s*(-?\d+(?:\.\d+)?)/g)].map((m) =>
			Number(m[1]),
		);
		if (years.length < 2 || values.length < 2) continue;
		out[key] = years
			.map((year, i) => ({
				year,
				value: Number.isFinite(values[i]) ? values[i] : null,
			}))
			.filter((p) => p.value !== null);
	}
	return Object.keys(out).length > 0 ? out : null;
};

// Z `<span class="truncate" title="...">` (Predmety podnikania) vytáhneme každou činnost zvlášť.
const extractTruncatedList = ($, $li) => {
	const items = [];
	$li.find("span.truncate").each((_, span) => {
		const value = sanitizeText($(span).attr("title") || $(span).text());
		if (value) items.push(value);
	});
	return items.length > 0 ? items : null;
};

const SK_MONTHS = {
	januára: 1,
	februára: 2,
	marca: 3,
	apríla: 4,
	mája: 5,
	júna: 6,
	júla: 7,
	augusta: 8,
	septembra: 9,
	októbra: 10,
	novembra: 11,
	decembra: 12,
};

// "pondelok 7. decembra 1998" → "1998-12-07"
const parseSkDate = (str) => {
	if (!str) return null;
	const m = str.match(/(\d{1,2})\.\s+(\p{L}+)\s+(\d{4})/u);
	if (!m) return null;
	const day = Number(m[1]);
	const month = SK_MONTHS[m[2].toLowerCase()];
	const year = Number(m[3]);
	if (!month) return null;
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseNace = (str) => {
	if (!str) return { nace: null, naceDescription: null };
	// finstat občas slepuje popis NACE s poznámkou "podľa účtovnej závierky..." bez mezery,
	// proto matchujeme i variantu bez whitespace před "podľa".
	const m = str.match(/(\d{4})\s+(.+?)(?:\s*podľa\b|$)/);
	if (!m) return { nace: null, naceDescription: sanitizeText(str) };
	return { nace: m[1], naceDescription: sanitizeText(m[2]) };
};

export const parseFinstatSk = ($, ico, sourceUrl, rawHtml = "") => {
	const labels = {};
	const labelElements = {};
	$("li").each((_, el) => {
		const $el = $(el);
		const label = sanitizeText($el.children("strong").first().text());
		if (!label) return;
		// Vezmeme přímý text spanu (vč. <br/> jako mezera).
		const $span = $el.children("span").first();
		if ($span.length === 0) return;
		$span.find("br").replaceWith(", ");
		const value = sanitizeText($span.text());
		if (!labels[label]) {
			labels[label] = value;
			labelElements[label] = $el;
		}
	});

	// Název firmy: poslední aktivní položka v breadcrumb.
	const nameFromBreadcrumb = sanitizeText(
		$(".breadcrumb li.active").last().text(),
	);
	// Fallback: og:title obsahuje "<name> - ...".
	const ogTitle = sanitizeText($('meta[property="og:title"]').attr("content"));
	const name =
		nameFromBreadcrumb ||
		(ogTitle ? sanitizeText(ogTitle.split(" - ")[0]) : null);

	// Sídlo často obsahuje název firmy na začátku — odstříhneme ho.
	let addressFull = labels["Sídlo"] || null;
	if (addressFull && name && addressFull.startsWith(name)) {
		addressFull = sanitizeText(
			addressFull.slice(name.length).replace(/^,\s*/, ""),
		);
	}

	// Finance: první (=poslední rok) výskyt v table.detail-company-financial.
	const fin = {};
	let finYear = null;
	$("table.detail-company-financial")
		.first()
		.find("tr")
		.each((_, row) => {
			const $row = $(row);
			const k = sanitizeText($row.find("td.financial-name").text());
			const vRaw = $row.find("td.financial-value").first().text();
			if (!k) return;
			if (k === "Rok") {
				const yearNum = Number(sanitizeText(vRaw));
				if (Number.isFinite(yearNum)) finYear = yearNum;
				return;
			}
			const num = parseFinancialNumber(vRaw);
			if (num !== null) fin[k] = num;
		});

	const { nace, naceDescription } = parseNace(labels["SK NACE"]);

	const finstatActivities = labelElements["Predmety podnikania"]
		? extractTruncatedList($, labelElements["Predmety podnikania"])
		: null;
	// Sjednocený formát napříč zeměmi: { license, activities }. Finstat license není (jen seznam).
	const businessActivities = finstatActivities
		? { license: null, activities: finstatActivities }
		: null;

	const warnings = {
		hasDebts: parseFlag(labels["Dlhy a nedoplatky"]),
		hasInsolvency: parseFlag(labels["Konkurzy a reštrukturalizácie"]),
		hasTemporaryProtection: parseFlag(labels["Dočasná ochrana"]),
	};
	const warningsAllNull = Object.values(warnings).every((v) => v === null);

	const history = extractFinancialHistory(rawHtml);

	return {
		ico,
		country: SK,
		name,
		legalForm: labels["Právna forma"] || null,
		establishedAt: parseSkDate(labels["Dátum vzniku"]),
		dissolvedAt: parseSkDate(labels["Dátum zániku"]),
		dic: labels["DIČ"] || null,
		icDph: labels["IČ DPH"] || null,
		address: parseAddress(addressFull),
		classification: {
			nace,
			naceDescription,
			employeeCategory: labels["Počet zamestnancov"] || null,
			region: labels["Kraj"] || null,
		},
		financials:
			Object.keys(fin).length > 0 || finYear
				? {
						year: finYear,
						revenue: fin["Celkové výnosy"] ?? fin["Tržby"] ?? null,
						profit: fin["Zisk"] ?? null,
						assets: fin["Aktíva"] ?? null,
						equity: fin["Vlastný kapitál"] ?? null,
						currency: "EUR",
					}
				: null,
		financialHistory: history,
		businessActivities,
		// Finstat zdarma neukazuje statutáře ani vlastníky (jen Premium).
		directors: null,
		partners: null,
		warnings: warningsAllNull ? null : warnings,
		sourceUrl,
		scrapedAt: new Date().toISOString(),
	};
};

// re-export pro symetrii s mspCz
export { CZ };

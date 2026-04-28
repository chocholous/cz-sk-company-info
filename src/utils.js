import { CZ, SK } from "./constants.js";

export const normalizeIco = (ico) =>
	String(ico).replace(/\s+/g, "").padStart(8, "0");

const CZ_ICO_RE = /^\d{8}$/;
const SK_ICO_RE = /^\d{8}$/;

// CZ a SK IČO mají oba 8 číslic — bez explicitního country argumentu nelze rozlišit.
// Heuristika: pokud actor inputu obsahuje 'country', vyhraje to. Jinak zkusíme oba zdroje.
export const detectCountry = (ico, forced) => {
	if (forced && forced !== "auto") return forced;
	const n = normalizeIco(ico);
	if (!CZ_ICO_RE.test(n) && !SK_ICO_RE.test(n)) return null;
	return null;
};

export const sanitizeText = (str) => {
	if (typeof str !== "string") return null;
	const trimmed = str.replace(/\s+/g, " ").trim();
	return trimmed.length === 0 ? null : trimmed;
};

// Parser pro evropské formáty čísel: "12 543 294 000", "12,5 mil.", "1 234,56 €"
export const parseFinancialNumber = (str) => {
	if (typeof str !== "string") return null;
	const cleaned = str.replace(/[\s ]/g, "").replace(/[^\d,.-]/g, "");
	if (!cleaned) return null;
	const lastComma = cleaned.lastIndexOf(",");
	const lastDot = cleaned.lastIndexOf(".");
	let normalized;
	if (lastComma > lastDot) {
		normalized = cleaned.replace(/\./g, "").replace(",", ".");
	} else {
		normalized = cleaned.replace(/,/g, "");
	}
	const num = Number(normalized);
	return Number.isFinite(num) ? num : null;
};

// Cílem je rozdělit "Vodičkova 704/36, Nové Město, 110 00 Praha 1" (CZ)
// nebo "J. Jonáša 1 843 02 Bratislava" (SK) na ulice / PSČ / město.
// Klíč je PSČ (5 cifer s volitelnou mezerou) — vše před ním = ulice, vše po něm = město.
export const parseAddress = (full) => {
	if (!full) return { full: null, street: null, zip: null, city: null };
	const text = sanitizeText(full);
	if (!text) return { full: null, street: null, zip: null, city: null };
	const m = text.match(/^(.+?)[\s,]+(\d{3})\s?(\d{2})\s+(.+?)$/);
	if (!m) return { full: text, street: null, zip: null, city: null };
	return {
		full: text,
		street: sanitizeText(m[1].replace(/,\s*$/, "")),
		zip: `${m[2]}${m[3]}`,
		city: sanitizeText(m[4]),
	};
};

export const isoDate = (date) => {
	if (!date) return null;
	if (date instanceof Date) return date.toISOString().slice(0, 10);
	const d = new Date(date);
	return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

export { CZ, SK };

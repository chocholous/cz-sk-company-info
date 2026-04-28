import { log } from "apify";

const ARES_BASE =
	"https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

const buildUrl = (ico) => `${ARES_BASE}/${ico}`;

// ARES vrací JSON; volá se HTTP GET bez autentizace.
// Vracíme částečný record k merge do MSP záznamu (priorita dat: MSP → ARES enrich).
export const fetchAres = async (ico, { timeoutMs = 10_000 } = {}) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(buildUrl(ico), {
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
		if (response.status === 404) {
			log.debug(`ARES ${ico}: subjekt nenalezen.`);
			return null;
		}
		if (!response.ok) {
			log.warning(`ARES ${ico}: HTTP ${response.status}`);
			return null;
		}
		const json = await response.json();
		return mapAres(json);
	} catch (err) {
		if (err.name === "AbortError") {
			log.warning(`ARES ${ico}: timeout po ${timeoutMs} ms.`);
		} else {
			log.warning(`ARES ${ico}: ${err.message}`);
		}
		return null;
	} finally {
		clearTimeout(timer);
	}
};

const mapAres = (data) => {
	const sidlo = data?.sidlo ?? {};
	const reg = data?.seznamRegistraci ?? {};
	return {
		dic: data?.dic ?? null,
		naceCodes: Array.isArray(data?.czNace)
			? [
					...new Set(
						data.czNace.filter((c) => typeof c === "string" && c.length > 0),
					),
				]
			: null,
		sidlo: {
			kraj: sidlo.nazevKraje ?? null,
			okres: sidlo.nazevOkresu ?? null,
			obec: sidlo.nazevObce ?? null,
			psc:
				typeof sidlo.psc === "number"
					? String(sidlo.psc).padStart(5, "0")
					: null,
			full: sidlo.textovaAdresa ?? null,
		},
		pravniFormaCode: data?.pravniForma ?? null,
		datumVzniku: data?.datumVzniku ?? null,
		datumZaniku: data?.datumZaniku ?? null,
		datumAktualizace: data?.datumAktualizace ?? null,
		// Boolean flagy z registrů (KEY → AKTIVNI/NEEXISTUJICI/ZRUSENI/...).
		vatActive: reg.stavZdrojeDph === "AKTIVNI",
		hasInsolvency: reg.stavZdrojeIr === "AKTIVNI",
		registrace: {
			ros: reg.stavZdrojeRos ?? null,
			vr: reg.stavZdrojeVr ?? null,
			res: reg.stavZdrojeRes ?? null,
			rzp: reg.stavZdrojeRzp ?? null,
			dph: reg.stavZdrojeDph ?? null,
			ir: reg.stavZdrojeIr ?? null,
		},
	};
};

// Sloučí ARES data do existujícího MSP recordu. ARES pole se použijí jen tehdy,
// pokud MSP nemá svoji hodnotu (priorita: MSP → ARES).
export const enrichWithAres = (record, aresData) => {
	if (!aresData) return record;

	return {
		...record,
		dic: record.dic ?? aresData.dic,
		classification: {
			...record.classification,
			nace: record.classification?.nace ?? aresData.naceCodes?.[0] ?? null,
			naceCodes: aresData.naceCodes,
			region: record.classification?.region ?? aresData.sidlo.kraj,
			district: aresData.sidlo.okres,
		},
		address: {
			...record.address,
			zip: record.address?.zip ?? aresData.sidlo.psc,
			city: record.address?.city ?? aresData.sidlo.obec,
			full: record.address?.full ?? aresData.sidlo.full,
		},
		warnings: {
			...(record.warnings ?? {}),
			hasInsolvency: aresData.hasInsolvency,
		},
		vatStatus: {
			active: aresData.vatActive,
			stateCode: aresData.registrace.dph,
		},
		registrace: aresData.registrace,
		dataFreshness: {
			aresUpdatedAt: aresData.datumAktualizace,
			scrapedAt: record.scrapedAt,
		},
	};
};

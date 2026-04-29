import { gotScraping } from "@crawlee/utils";
import { log } from "apify";

const RPO_BASE = "https://api.statistics.sk/rpo/v1/search";

// Najít aktuálně platnou hodnotu z pole obsahujícího { value, validFrom, validTo? }
const pickCurrent = (records) => {
	if (!Array.isArray(records) || records.length === 0) return null;
	const active = records.find((r) => !r.validTo);
	return (active ?? records[records.length - 1])?.value ?? null;
};

// Volá RPO přes (volitelný) proxy klient (Apify residential rotuje IP per request,
// čímž obchází per-IP rate limit endpointu). Při 429 retry s exponenciální backoff
// (respektuje hlavičku Retry-After). Vrací null při 404/finálním selhání.
export const fetchRpo = async (
	ico,
	{ proxyUrl, timeoutMs = 15_000, maxRetries = 3 } = {},
) => {
	const url = `${RPO_BASE}?identifier=${encodeURIComponent(ico)}`;
	let attempt = 0;
	while (attempt <= maxRetries) {
		try {
			const response = await gotScraping({
				url,
				proxyUrl,
				timeout: { request: timeoutMs },
				responseType: "json",
				throwHttpErrors: false,
				headers: { Accept: "application/json" },
			});
			if (response.statusCode === 429 && attempt < maxRetries) {
				const retryAfter =
					Number(response.headers["retry-after"]) || 2 ** attempt;
				const waitMs = Math.min(retryAfter * 1000 + 500, 30_000);
				log.debug(
					`RPO ${ico}: 429 retry-after ${retryAfter}s (attempt ${attempt + 1}/${maxRetries}).`,
				);
				await new Promise((r) => setTimeout(r, waitMs));
				attempt += 1;
				continue;
			}
			if (response.statusCode === 429) {
				log.warning(
					`RPO ${ico}: HTTP 429 even after ${maxRetries} retries. Subject skipped.`,
				);
				return null;
			}
			if (response.statusCode === 404 || !response.body?.results?.length) {
				log.debug(`RPO ${ico}: subject not found.`);
				return null;
			}
			if (response.statusCode >= 400) {
				log.warning(`RPO ${ico}: HTTP ${response.statusCode}`);
				return null;
			}
			return mapRpo(response.body.results[0]);
		} catch (err) {
			log.warning(`RPO ${ico}: ${err.message}`);
			return null;
		}
	}
	return null;
};

const mapRpo = (subject) => {
	if (!subject) return null;
	const fullName = pickCurrent(subject.fullNames);
	const currentAddress =
		subject.addresses?.find((a) => !a.validTo) ??
		subject.addresses?.[0] ??
		null;

	return {
		rpoId: subject.id ?? null,
		dbModificationDate: subject.dbModificationDate ?? null,
		currentName: fullName,
		// Kompletní historie jmen (může být cenná pro historický audit).
		nameHistory: Array.isArray(subject.fullNames)
			? subject.fullNames.map((n) => ({
					name: n.value,
					validFrom: n.validFrom ?? null,
					validTo: n.validTo ?? null,
				}))
			: null,
		sidlo: currentAddress
			? {
					full:
						currentAddress.formatedAddress ??
						[
							currentAddress.street,
							currentAddress.buildingNumber,
							currentAddress.postalCodes?.[0],
							currentAddress.municipality?.value,
						]
							.filter(Boolean)
							.join(" "),
					street: currentAddress.street ?? null,
					buildingNumber: currentAddress.buildingNumber ?? null,
					zip: currentAddress.postalCodes?.[0] ?? null,
					city: currentAddress.municipality?.value ?? null,
					district: currentAddress.district?.value ?? null,
					country: currentAddress.country?.value ?? null,
				}
			: null,
		establishment: subject.establishment ?? null,
		termination: subject.termination ?? null,
		sourceRegister: subject.sourceRegister?.value?.value ?? null,
		registrationOffice: pickCurrent(
			subject.sourceRegister?.registrationOffices,
		),
		spisovaZnacka: pickCurrent(subject.sourceRegister?.registrationNumbers),
	};
};

// Sloučí RPO data do existujícího finstat recordu. Priorita: finstat → RPO enrich.
export const enrichWithRpo = (record, rpoData) => {
	if (!rpoData) return record;
	return {
		...record,
		// Pokud finstat nedal name (např. blokoval), použij RPO.
		name: record.name ?? rpoData.currentName,
		// Pokud finstat nedal datum vzniku, vezmi z RPO.
		establishedAt: record.establishedAt ?? rpoData.establishment,
		dissolvedAt: record.dissolvedAt ?? rpoData.termination,
		address: {
			...(record.address ?? {}),
			full: record.address?.full ?? rpoData.sidlo?.full,
			street:
				record.address?.street ??
				([rpoData.sidlo?.street, rpoData.sidlo?.buildingNumber]
					.filter(Boolean)
					.join(" ") ||
					null),
			zip: record.address?.zip ?? rpoData.sidlo?.zip,
			city: record.address?.city ?? rpoData.sidlo?.city,
		},
		classification: {
			...(record.classification ?? {}),
			district: record.classification?.district ?? rpoData.sidlo?.district,
			spisovaZnacka:
				record.classification?.spisovaZnacka ?? rpoData.spisovaZnacka,
		},
		nameHistory: rpoData.nameHistory,
		registrationOffice: rpoData.registrationOffice,
		dataFreshness: {
			...(record.dataFreshness ?? {}),
			rpoUpdatedAt: rpoData.dbModificationDate,
			scrapedAt: record.scrapedAt,
		},
	};
};

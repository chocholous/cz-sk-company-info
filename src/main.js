import { setTimeout as wait } from "node:timers/promises";
import { CheerioCrawler } from "@crawlee/cheerio";
import { PlaywrightCrawler } from "@crawlee/playwright";
import { Actor, log } from "apify";

import {
	buildUrlCz,
	buildUrlSk,
	CZ,
	LABEL_CZ,
	LABEL_SK,
	SK,
} from "./constants.js";
import {
	buildAresOnlyRecord,
	enrichWithAres,
	fetchAres,
} from "./parsers/aresCz.js";
import { parseFinstatSk } from "./parsers/finstatSk.js";
import {
	buildMspRecord,
	extractMspRows,
	waitForMspContent,
} from "./parsers/mspCz.js";
import { enrichWithRpo, fetchRpo } from "./parsers/rpoSk.js";
import { normalizeIco } from "./utils.js";

await Actor.init();

Actor.on("aborting", async () => {
	log.warning("Actor aborting — performing quick shutdown.");
	await wait(1000);
	await Actor.exit();
});

const input = (await Actor.getInput()) ?? {};
const {
	icos = [],
	country = "auto",
	maxConcurrency = 10,
	maxRequestRetries = 3,
	requestTimeoutSecs = 30,
	proxyConfiguration: proxyInput,
} = input;

if (!Array.isArray(icos) || icos.length === 0) {
	throw new Error("Input `icos` must be a non-empty array of IČOs.");
}

const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);
log.info(
	`Input: ${icos.length} IČO(s), country=${country}, concurrency=${maxConcurrency}`,
);

const skIcos = [];
const czIcos = [];
for (const raw of icos) {
	const ico = normalizeIco(raw);
	if (country === SK) skIcos.push(ico);
	else if (country === CZ) czIcos.push(ico);
	else {
		skIcos.push(ico);
		czIcos.push(ico);
	}
}

const datasetWriter = async (record) => {
	if (!record?.name) {
		log.softFail(
			`Skipping IČO ${record?.ico} (${record?.country}) — company not found.`,
		);
		return;
	}
	await Actor.pushData(record);
};

// Crawlee `apify run` purguje pouze defaultní storage; named queues přežijí mezi lokálními runy.
// Použijeme unique názvy per-run (s ID běhu na Apify, fallback na timestamp lokálně), aby každý
// run dostal čerstvé queues a crawlery si vzájemně nekradly requesty.
const runTag = process.env.APIFY_ACTOR_RUN_ID ?? `local-${Date.now()}`;
const skQueue =
	skIcos.length > 0 ? await Actor.openRequestQueue(`sk-${runTag}`) : null;
const czQueue =
	czIcos.length > 0 ? await Actor.openRequestQueue(`cz-${runTag}`) : null;

const skCrawler = skQueue
	? new CheerioCrawler({
			requestQueue: skQueue,
			proxyConfiguration,
			maxConcurrency,
			maxRequestRetries,
			requestHandlerTimeoutSecs: requestTimeoutSecs * 2,
			navigationTimeoutSecs: requestTimeoutSecs,
			async requestHandler({ $, body, request, response, proxyInfo }) {
				const { ico } = request.userData;
				// finstat.sk vrací HTTP 404 pro neexistující IČO, ale stránka se pořád vyrenderuje
				// (pretty 404). V auto módu je 404 očekávaný stav — IČO je české → tiše skip.
				if (response.statusCode === 404) {
					log.debug(`SK ${ico}: not found on finstat.sk (HTTP 404).`);
					return;
				}
				if (response.statusCode >= 400) {
					log.warning(`SK ${ico}: HTTP ${response.statusCode}`);
					return;
				}
				const rawHtml =
					typeof body === "string" ? body : (body?.toString("utf8") ?? "");
				const finstatRecord = parseFinstatSk($, ico, request.url, rawHtml);
				// Enrichment z RPO (data.gov.sk) — fresh dbModificationDate, historie jmen, spisová značka.
				// Použijeme stejnou proxy URL, kterou Crawlee dal této session (residential rotuje IP per request).
				const rpoData = await fetchRpo(ico, { proxyUrl: proxyInfo?.url });
				const record = enrichWithRpo(finstatRecord, rpoData);
				await datasetWriter(record);
			},
			failedRequestHandler({ request }) {
				log.error(
					`SK ${request.userData?.ico}: request failed after ${maxRequestRetries} retries.`,
				);
			},
		})
	: null;

const czCrawler = czQueue
	? new PlaywrightCrawler({
			requestQueue: czQueue,
			proxyConfiguration,
			maxConcurrency: Math.min(maxConcurrency, 5),
			maxRequestRetries,
			requestHandlerTimeoutSecs: requestTimeoutSecs * 3,
			navigationTimeoutSecs: requestTimeoutSecs * 2,
			headless: true,
			async requestHandler({ page, request }) {
				const { ico } = request.userData;
				// ARES voláme paralelně s MSP — když MSP nemá subjekt (státní org, VŠ,
				// příspěvkové organizace nejsou v obchodním rejstříku), ARES poslouží jako
				// primární zdroj a záznam se uloží i bez MSP dat.
				const aresPromise = fetchAres(ico);
				let mspRecord = null;
				try {
					await waitForMspContent(page);
					const rows = await extractMspRows(page);
					mspRecord = buildMspRecord(rows, ico, request.url);
				} catch (err) {
					log.debug(
						`CZ ${ico}: MSP rejstřík unavailable (${err.message}). Falling back to ARES.`,
					);
				}
				const aresData = await aresPromise;
				// Pokud MSP nedal jméno (subjekt vymazaný z OR, nebo státní org bez záznamu)
				// a ARES taky nic, IČO je neplatné. Jinak ARES poslouží jako primary.
				if (!mspRecord?.name && !aresData?.name) {
					log.softFail(
						`CZ ${ico}: not found in MSP nor in ARES — IČO probably does not exist.`,
					);
					return;
				}
				const baseRecord = mspRecord?.name
					? mspRecord
					: buildAresOnlyRecord(ico, request.url, aresData);
				const record = enrichWithAres(baseRecord, aresData);
				await datasetWriter(record);
			},
			failedRequestHandler({ request }) {
				log.error(
					`CZ ${request.userData?.ico}: request failed after ${maxRequestRetries} retries.`,
				);
			},
		})
	: null;

const skRequests = skIcos.map((ico) => ({
	url: buildUrlSk(ico),
	label: LABEL_SK,
	userData: { ico, country: SK },
}));

const czRequests = czIcos.map((ico) => ({
	url: buildUrlCz(ico),
	label: LABEL_CZ,
	userData: { ico, country: CZ },
}));

if (skQueue) await skQueue.addRequests(skRequests);
if (czQueue) await czQueue.addRequests(czRequests);

await Promise.all([skCrawler?.run(), czCrawler?.run()].filter(Boolean));

log.info("Done.");

await Actor.exit();

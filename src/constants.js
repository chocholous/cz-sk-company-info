export const SK = "sk";
export const CZ = "cz";

export const BASE_URL_SK = "https://www.finstat.sk";
export const BASE_URL_CZ = "https://verejnerejstriky.msp.gov.cz";

export const buildUrlSk = (ico) => `${BASE_URL_SK}/${ico}`;
// MSP: cs lokalizace path neexistuje (vrací 404), pracuje pouze /en/ico/{ICO} — obsah je
// stejně v češtině, jen routing chce 'en' prefix (verze portálu 2.0).
export const buildUrlCz = (ico) => `${BASE_URL_CZ}/en/ico/${ico}`;

export const LABEL_SK = "sk-finstat";
export const LABEL_CZ = "cz-msp";

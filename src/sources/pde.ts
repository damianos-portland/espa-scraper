import type { RawCall } from "../schema.js";
import type { ScraperSource } from "./types.js";
import {
  decodeEntities,
  extractDeadline,
  extractEuro,
  extractPct,
  stripHtml,
} from "../extract.js";

/**
 * Περιφέρεια Δυτικής Ελλάδας — στατικό HTML subsite `/ependyseis/`.
 * Όχι WordPress: σελίδα-ευρετήριο με κάρτες δράσεων -> επιμέρους σελίδες δράσεων.
 * Όλες ταγκάρονται γεωγραφικά ως DYTIKI_ELLADA (κρίσιμο για το Μεσολόγγι profile).
 */
const BASE = "https://www.pde.gov.gr";
const INDEX = `${BASE}/ependyseis/actions.html`;
const PROGRAM_FAMILY = "ΠΕΠ Δυτική Ελλάδα 2021-2027";

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

/** Μόνο top-level σελίδες δράσεων (όχι .../decisions|documents|faq|ask· όχι index). */
function actionLinks(html: string): string[] {
  const re = /href="([^"]*\/ependyseis\/actions\/[^"\/#]+\.html)"/gi;
  const set = new Set<string>();
  for (const m of html.matchAll(re)) {
    if (/\/actions\/index\.html$/i.test(m[1])) continue;
    set.add(m[1].startsWith("http") ? m[1] : BASE + (m[1].startsWith("/") ? "" : "/") + m[1]);
  }
  return [...set];
}

/** Τίτλος: προτίμηση σε ουσιαστικό <h1>· αλλιώς <title> (το h1 εδώ είναι το logo). */
function titleOf(html: string): string {
  const h1 = stripHtml(decodeEntities(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""));
  if (h1) return h1;
  const t = stripHtml(decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  return t.replace(/\s*[-|»][^-|»]*$/, "").trim(); // κόψε το " - Π.Δ.Ε." suffix
}

export const pde: ScraperSource = {
  key: "pde",
  label: "Περιφέρεια Δυτικής Ελλάδας (ΠΕΠ)",
  async fetch(): Promise<RawCall[]> {
    const links = actionLinks(await getHtml(INDEX));
    const out: RawCall[] = [];

    for (const url of links) {
      let html: string;
      try {
        html = await getHtml(url);
      } catch {
        continue; // σπασμένο link -> skip
      }
      const title = titleOf(html);
      if (!title) continue;
      const body = stripHtml(html);
      const slug = url.split("/").pop()!.replace(/\.html$/, "");

      out.push({
        source: "pde",
        sourceId: slug,
        title,
        programFamily: PROGRAM_FAMILY,
        geography: ["DYTIKI_ELLADA"],
        // status: undefined -> UNKNOWN αν δεν βρεθεί deadline (περιγραφικές σελίδες)
        deadline: extractDeadline(body),
        budgetMin: extractEuro(body, /απο\s*([\d.,]+)\s*(?:€|ευρω)/i),
        budgetMax: extractEuro(body, /(?:εως|μεχρι)\s*([\d.,]+)\s*(?:€|ευρω)/i),
        aidIntensityPct: extractPct(body),
        officialUrl: url,
        docUrls: [],
      });
    }
    return out;
  },
};

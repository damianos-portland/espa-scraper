import type { RawCall } from "../schema.js";
import type { ScraperSource } from "./types.js";
import { extractDeadline, extractEuro, extractPct, stripHtml } from "../extract.js";

/**
 * Ταμείο Ανάκαμψης / Ελλάδα 2.0 — WordPress, custom post type `calls`.
 * Το REST ΔΕΝ εκθέτει `content` — μόνο τίτλους. Άρα: παίρνουμε slugs από REST,
 * μετά τραβάμε το HTML της detail σελίδας (`/calls/<slug>/`) για deadline/budget.
 * Status υπολογίζεται από τη deadline (normalizeCall). Ληγμένες -> CLOSED, τις κόβει το matching.
 */
const BASE = "https://greece20.gov.gr";
const MAX_PAGES = 2;        // ~100 πιο πρόσφατες προσκλήσεις
const CONCURRENCY = 6;
const PROGRAM_FAMILY = "Ταμείο Ανάκαμψης (Ελλάδα 2.0)";

interface WpCall {
  slug: string;
  date: string;
  title: { rendered: string };
}

async function listSlugs(): Promise<WpCall[]> {
  const out: WpCall[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${BASE}/wp-json/wp/v2/calls?per_page=50&page=${page}&orderby=date&order=desc` +
      `&_fields=slug,date,title`;
    const res = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
    if (res.status === 400) break;
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    out.push(...((await res.json()) as WpCall[]));
    if (page >= Number(res.headers.get("x-wp-totalpages") ?? "1")) break;
  }
  return out;
}

/** Απλός concurrency limiter. */
async function pMap<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        res[idx] = await fn(items[idx]);
      }
    }),
  );
  return res;
}

export const greece2_0: ScraperSource = {
  key: "greece2_0",
  label: "Ταμείο Ανάκαμψης (Ελλάδα 2.0)",
  async fetch(): Promise<RawCall[]> {
    const calls = await listSlugs();
    const results = await pMap(calls, CONCURRENCY, async (c): Promise<RawCall> => {
      const url = `${BASE}/calls/${c.slug}/`;
      const title = stripHtml(c.title.rendered);
      let body = "";
      try {
        const r = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
        if (r.ok) body = stripHtml(await r.text());
      } catch {
        /* detail σελίδα απρόσιτη -> μένουμε με τον τίτλο */
      }
      const haystack = `${title}\n${body}`;
      return {
        source: "greece2_0",
        sourceId: c.slug,
        title,
        programFamily: PROGRAM_FAMILY,
        deadline: extractDeadline(haystack),
        budgetMin: extractEuro(haystack, /απο\s*([\d.,]+)\s*(?:€|ευρω)/i),
        budgetMax: extractEuro(haystack, /(?:εως|μεχρι)\s*([\d.,]+)\s*(?:€|ευρω)/i),
        aidIntensityPct: extractPct(haystack),
        officialUrl: url,
        docUrls: [],
      };
    });
    return results;
  },
};

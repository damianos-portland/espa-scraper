import type { RawCall, Status } from "../schema.js";
import type { ScraperSource } from "./types.js";
import { extractDeadline, extractEuro, extractPct, stripHtml } from "../extract.js";

/**
 * ΕΠΑνΕΚ / Ανταγωνιστικότητα 2021-2027 — WordPress.
 * Πηγή αλήθειας: WP REST API (καθαρό JSON, χωρίς browser).
 *
 * Custom taxonomy `actionstatus`:  energi=57 (Ενεργή) · anenergi=58 (Ανενεργή).
 * Τραβάμε ΜΟΝΟ τις ενεργές — αυτές «τρέχουν αυτή τη στιγμή».
 */
const BASE = "https://21-27.antagonistikotita.gr";
const ACTIONSTATUS_ACTIVE = 57;
const PROGRAM_FAMILY = "Ανταγωνιστικότητα 2021-2027";

interface WpPost {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  class_list?: string[];
}

/** status από το class_list (π.χ. "actionstatus-energi"). */
function statusFromClassList(classes: string[] = []): Status {
  if (classes.includes("actionstatus-energi")) return "OPEN";
  if (classes.includes("actionstatus-anenergi")) return "CLOSED";
  return "UNKNOWN";
}

async function fetchActivePosts(): Promise<WpPost[]> {
  const out: WpPost[] = [];
  for (let page = 1; page <= 10; page++) {
    const url =
      `${BASE}/wp-json/wp/v2/posts?actionstatus=${ACTIONSTATUS_ACTIVE}` +
      `&per_page=50&page=${page}` +
      `&_fields=id,slug,link,date,title,excerpt,content,class_list`;
    const res = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
    if (res.status === 400) break; // εκτός ορίου σελίδων
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    out.push(...((await res.json()) as WpPost[]));
    if (page >= Number(res.headers.get("x-wp-totalpages") ?? "1")) break;
  }
  return out;
}

export const antagonistikotita: ScraperSource = {
  key: "antagonistikotita",
  label: "Ανταγωνιστικότητα 2021-2027 (ΕΠΑνΕΚ)",
  async fetch(): Promise<RawCall[]> {
    const posts = await fetchActivePosts();
    return posts.map((p): RawCall => {
      const title = stripHtml(p.title.rendered);
      const summary = stripHtml(p.excerpt.rendered);
      const body = stripHtml(p.content.rendered);
      const haystack = `${title}\n${body}`;

      return {
        source: "antagonistikotita",
        sourceId: p.slug,
        title,
        programFamily: PROGRAM_FAMILY,
        summary: summary || undefined,
        status: statusFromClassList(p.class_list),
        deadline: extractDeadline(haystack),
        budgetMin: extractEuro(haystack, /απο\s*([\d.,]+)\s*(?:€|ευρω)/i),
        budgetMax: extractEuro(haystack, /(?:εως|μεχρι)\s*([\d.,]+)\s*(?:€|ευρω)/i),
        aidIntensityPct: extractPct(haystack),
        officialUrl: p.link,
        docUrls: [],
      };
    });
  },
};

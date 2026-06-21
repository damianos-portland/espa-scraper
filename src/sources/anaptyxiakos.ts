import type { RawCall } from "../schema.js";
import type { ScraperSource } from "./types.js";
import { decodeEntities, extractPct, extractSubmissionWindow, stripHtml } from "../extract.js";
import { fetchPdfText } from "../pdf.js";

/**
 * Αναπτυξιακός Νόμος 4887/2022 — επίσημη σελίδα Προκηρύξεων (ΥΠΑΝ).
 * Στατικό HTML, ομαδοποίηση ανά καθεστώς σε <h4 class="mb-1 mt-5">, με PDF links.
 *
 * Μοντελοποίηση σε επίπεδο ΚΑΘΕΣΤΩΤΟΣ (όχι ανά PDF): κάθε h4 -> ένα FundingCall,
 * τα PDF (προκήρυξη/κωδικοποίηση/τροποποίηση) γίνονται docUrls.
 *
 * Προσοχή: deadline/υποβολές ζουν ΜΕΣΑ στα PDF/ΦΕΚ — δεν υπάρχουν δομημένα εδώ.
 * Τα καθεστώτα αυτής της σελίδας είναι τα ΕΝΕΡΓΑ του 4887/2022 -> status OPEN.
 * Η ακριβής προθεσμία επιβεβαιώνεται από την προκήρυξη (Φάση 3.5: PDF parsing).
 */
const BASE = "https://ependyseis.mindev.gov.gr";
const LIST = `${BASE}/el/idiotikes/prokirikseis`;
const MAX_PAGES = 4;
const PROGRAM_FAMILY = "Αναπτυξιακός Νόμος 4887/2022";

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

interface Regime {
  title: string;
  docUrls: string[];
}

/** Σπάει το HTML στα h4 καθεστώτα και μαζεύει τα PDF κάθε block. */
function parseRegimes(html: string): Regime[] {
  const h4 = /<h4[^>]*class="[^"]*mb-1 mt-5[^"]*"[^>]*>([\s\S]*?)<\/h4>/gi;
  const marks = [...html.matchAll(h4)].map((m) => ({
    title: stripHtml(decodeEntities(m[1])),
    start: (m.index ?? 0) + m[0].length,
  }));

  return marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : html.length;
    const block = html.slice(mark.start, end);
    const docs = new Set<string>();
    for (const m of block.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)) {
      docs.add(m[1].startsWith("http") ? m[1] : BASE + (m[1].startsWith("/") ? "" : "/") + m[1]);
    }
    return { title: mark.title, docUrls: [...docs].slice(0, 15) };
  });
}

/** Το consolidated PDF (κωδικοποίηση) έχει τις τρέχουσες ημερομηνίες· αλλιώς η προκήρυξη. */
function bestPdf(docUrls: string[]): string | undefined {
  return (
    docUrls.find((u) => /kodikopiisi/i.test(u)) ??
    docUrls.find((u) => /prokirixi|prokiryxi/i.test(u)) ??
    docUrls[0]
  );
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

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9α-ω]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);

export const anaptyxiakos: ScraperSource = {
  key: "anaptyxiakos",
  label: "Αναπτυξιακός Νόμος 4887/2022 (ΥΠΑΝ)",
  async fetch(): Promise<RawCall[]> {
    const byTitle = new Map<string, Regime>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? LIST : `${LIST}?page=${page}`;
      let html: string;
      try {
        html = await getHtml(url);
      } catch {
        break;
      }
      for (const r of parseRegimes(html)) {
        if (!r.title) continue;
        const prev = byTitle.get(r.title);
        if (prev) prev.docUrls = [...new Set([...prev.docUrls, ...r.docUrls])].slice(0, 15);
        else byTitle.set(r.title, r);
      }
    }

    return pMap([...byTitle.values()], 3, async (r): Promise<RawCall> => {
      const legacy = /4399\s*\/\s*2016/.test(r.title); // παλιός νόμος -> κλειστά
      const base: RawCall = {
        source: "anaptyxiakos",
        sourceId: slugify(r.title),
        title: r.title,
        programFamily: legacy ? "Αναπτυξιακός Νόμος 4399/2016" : PROGRAM_FAMILY,
        beneficiaryTypes: ["EXISTING_SME", "LARGE_ENTERPRISE", "NEW_BUSINESS"],
        geography: ["NATIONAL"],
        aidTypes: ["GRANT", "TAX_RELIEF", "SUBSIDY_RATE"],
        eligibleKad: ["μεταποίηση", "logistics", "επενδυτικά σχέδια"],
        officialUrl: LIST,
        docUrls: r.docUrls,
      };

      if (legacy) {
        return {
          ...base,
          status: "CLOSED",
          summary: "Καθεστώς παλαιού Αναπτυξιακού Νόμου 4399/2016 (legacy — μη ενεργές υποβολές).",
        };
      }

      // 4887/2022: διαβάζουμε το PDF της προκήρυξης για ακριβές παράθυρο υποβολής
      const pdfUrl = bestPdf(r.docUrls);
      const text = pdfUrl ? await fetchPdfText(pdfUrl) : "";
      const { opensAt, deadline } = extractSubmissionWindow(text);
      const window = deadline ? `Υποβολές ${opensAt ?? "—"} → ${deadline}.` : "Προθεσμία: δες προκήρυξη.";

      return {
        ...base,
        opensAt,
        deadline,
        // status: undefined αν βρέθηκε deadline (το υπολογίζει το normalizeCall),
        // αλλιώς OPEN best-effort (ενεργό καθεστώς τρέχοντος νόμου).
        status: deadline ? undefined : "OPEN",
        aidIntensityPct: extractPct(text) ?? undefined,
        summary:
          `Ενεργό καθεστώς Αναπτυξιακού Νόμου 4887/2022 (επιχορήγηση + φοροαπαλλαγή + ` +
          `επιδότηση leasing/μισθολογικού κόστους). ${window}`,
      };
    });
  },
};

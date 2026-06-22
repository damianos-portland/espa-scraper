/**
 * Διαγωνισμοί Δημοσίων Έργων — πηγή ΔΙΑΥΓΕΙΑ opendata API.
 * Decision type Δ.2.1 = «Περίληψη Διακήρυξης». Φιλτράρουμε σε Έργα + Μελέτες, ≤ 3M€,
 * όλη η Ελλάδα, τελευταίες ~35 μέρες (proxy «ενεργό» — η ακριβής καταληκτική είναι στο PDF).
 */
const BASE = "https://diavgeia.gov.gr/opendata";
const DECISION_TYPE = "Δ.2.1";
const CONTRACT_TYPES = new Set(["Έργα", "Μελέτες"]);
const MAX_AMOUNT = 3_000_000;
const WINDOW_DAYS = 35;
const MAX_PAGES = 12;
const PAGE_SIZE = 500;

export interface Tender {
  id: string; // ΑΔΑ
  source: "diavgeia";
  title: string;
  org: string;
  orgId: string;
  contractType: string; // Έργα | Μελέτες
  cpv: string[];
  amount?: number;
  currency?: string;
  criterion?: string; // κριτήριο ανάθεσης
  procedure?: string; // Ανοιχτός | Κλειστός
  region: string; // Περιφέρεια (heuristic από τον φορέα)
  issueDate: string; // ISO (ημ. ανάρτησης)
  documentUrl: string; // PDF διακήρυξης
  decisionUrl: string; // σελίδα ΔΙΑΥΓΕΙΑ
  // — από ανάγνωση διακήρυξης (enrichment) —
  category?: string; // κατηγορία πτυχίου (ΟΔΟΠΟΙΙΑΣ, ΟΙΚΟΔΟΜΙΚΑ…)
  guarantee?: number; // εγγύηση συμμετοχής (€) ≈ 2% εκτιμώμενης αξίας
  esidisNo?: string; // Α/Α συστήματος ΕΣΗΔΗΣ (αν βρεθεί)
}

interface RawDecision {
  ada: string;
  subject: string;
  issueDate: number;
  organizationId: string;
  documentUrl?: string;
  extraFieldValues?: {
    cpv?: string[];
    manifestContractType?: string;
    manifestSelectionCriterion?: string;
    contestProgressType?: string;
    estimatedAmount?: { amount?: number; currency?: string };
  };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": "espa-radar/0.1" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Resolve ονόματος φορέα με cache. */
const orgCache = new Map<string, string>();
async function orgLabel(id: string): Promise<string> {
  const hit = orgCache.get(id);
  if (hit !== undefined) return hit;
  let label = id;
  try {
    const o = await fetchJson(`${BASE}/organizations/${id}.json`);
    label = o.label ?? id;
  } catch {
    /* άγνωστος φορέας -> κρατάμε το id */
  }
  orgCache.set(id, label);
  return label;
}

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

/**
 * Εμπλουτισμός: διαβάζει τη διακήρυξη (PDF) για κατηγορία πτυχίου & υπολογίζει
 * εγγύηση συμμετοχής (2%). Με disk cache (ΑΔΑ) -> τα επόμενα runs τραβούν μόνο νέα.
 */
export async function enrichTenders(tenders: Tender[], cachePath: string): Promise<Tender[]> {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { fetchPdfText } = await import("./pdf.js");
  const { extractTenderFacts } = await import("./tender-extract.js");
  const { extractSysNo } = await import("./extract-budget.js");

  let cache: Record<string, { category: string | null; esidisNo?: string | null }> = {};
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    /* χωρίς cache ακόμα */
  }

  // re-process & όσα δεν έχουν ακόμα esidisNo (migration από παλιό cache)
  const todo = tenders.filter((t) => !(t.id in cache) || cache[t.id]?.esidisNo === undefined);
  let done = 0;
  await pMap(todo, 6, async (t) => {
    try {
      const text = await fetchPdfText(t.documentUrl, 25000);
      // αρ. συστήματος ΕΣΗΔΗΣ από τη διακήρυξη (σταθερό -> αξιόπιστο one-click)
      cache[t.id] = { category: extractTenderFacts(text, t.amount).category ?? null, esidisNo: extractSysNo(text) };
    } catch {
      cache[t.id] = { category: null, esidisNo: null };
    }
    if (++done % 40 === 0) process.stdout.write(`${done}/${todo.length} `);
  });

  await writeFile(cachePath, JSON.stringify(cache));
  return tenders.map((t) => ({
    ...t,
    category: cache[t.id]?.category ?? undefined,
    esidisNo: cache[t.id]?.esidisNo ?? undefined,
    guarantee: t.amount != null ? Math.round(t.amount * 0.02) : undefined,
  }));
}

export async function fetchTenders(today = new Date()): Promise<Tender[]> {
  const from = ymd(new Date(today.getTime() - WINDOW_DAYS * 86_400_000));
  const to = ymd(today);

  const raw: RawDecision[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${BASE}/search.json?type=${encodeURIComponent(DECISION_TYPE)}` +
      `&from_issue_date=${from}&to_issue_date=${to}` +
      `&sort=recent&page=${page}&size=${PAGE_SIZE}`;
    const data = await fetchJson(url);
    const batch: RawDecision[] = data.decisions ?? [];
    raw.push(...batch);
    const total = data.info?.total ?? 0;
    if ((page + 1) * PAGE_SIZE >= total || batch.length === 0) break;
  }

  // φιλτράρισμα: Έργα/Μελέτες + ≤ 3M (κρατάμε και τα χωρίς ποσό)
  const kept = raw.filter((d) => {
    const ex = d.extraFieldValues ?? {};
    if (!CONTRACT_TYPES.has(ex.manifestContractType ?? "")) return false;
    const amt = ex.estimatedAmount?.amount;
    return amt == null || amt <= MAX_AMOUNT;
  });

  const { regionFromOrg } = await import("./regions.js");
  return pMap(kept, 8, async (d): Promise<Tender> => {
    const ex = d.extraFieldValues ?? {};
    const org = await orgLabel(d.organizationId);
    return {
      id: d.ada,
      source: "diavgeia",
      title: d.subject?.trim() ?? d.ada,
      org,
      orgId: d.organizationId,
      region: regionFromOrg(org),
      contractType: ex.manifestContractType ?? "",
      cpv: ex.cpv ?? [],
      amount: ex.estimatedAmount?.amount,
      currency: ex.estimatedAmount?.currency ?? "EUR",
      criterion: ex.manifestSelectionCriterion,
      procedure: ex.contestProgressType,
      issueDate: new Date(d.issueDate).toISOString().slice(0, 10),
      documentUrl: d.documentUrl ?? `https://diavgeia.gov.gr/doc/${d.ada}`,
      decisionUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
    };
  });
}

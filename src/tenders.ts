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
  issueDate: string; // ISO (ημ. ανάρτησης)
  documentUrl: string; // PDF διακήρυξης
  decisionUrl: string; // σελίδα ΔΙΑΥΓΕΙΑ
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

  return pMap(kept, 8, async (d): Promise<Tender> => {
    const ex = d.extraFieldValues ?? {};
    return {
      id: d.ada,
      source: "diavgeia",
      title: d.subject?.trim() ?? d.ada,
      org: await orgLabel(d.organizationId),
      orgId: d.organizationId,
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

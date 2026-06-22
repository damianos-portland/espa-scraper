import raw from "./anatheorisi.json";

/** Μηχανή αναθεώρησης: κωδικός → συντελεστής, με πρόταση ομοειδούς όταν λείπει. */

interface CodeEntry {
  code: string;
  wbs: string;
  desc: string;
  unit: string;
  coeffs: (number | null)[];
}
interface AnatheorisiData {
  source: string;
  quarters: string[];
  defaultQuarter: string;
  count: number;
  codes: Record<string, CodeEntry>;
}

export const ANATH = raw as AnatheorisiData;

export const normCode = (s: string) =>
  String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s\-]/g, "");

const splitCode = (c: string) => {
  const m = normCode(c).match(/^([Α-Ω]+)([\d.]+)/);
  return m ? { prefix: m[1], num: parseFloat(m[2]) || 0 } : { prefix: "", num: 0 };
};

export type Resolution =
  | { status: "direct"; code: string; coeff: number | null; desc: string }
  | { status: "omoeides"; code: string; via: string; coeff: number | null; desc: string }
  | { status: "missing"; suggestions: Suggestion[] };

export interface Suggestion {
  code: string;
  desc: string;
  coeff: number | null;
}

function coeffFor(entry: CodeEntry, quarter: string): number | null {
  const qi = ANATH.quarters.indexOf(quarter);
  return qi >= 0 ? entry.coeffs[qi] ?? null : null;
}

/**
 * Αναλύει έναν κωδικό αναθεώρησης:
 *  - direct: υπάρχει στο επίσημο αρχείο
 *  - omoeides: δεν υπάρχει, αλλά δόθηκε ρητός ομοειδής (από τιμολόγιο) που υπάρχει
 *  - missing: δεν υπάρχει → προτάσεις πλησιέστερων εκδοθέντων
 */
export function resolve(rawCode: string, quarter = ANATH.defaultQuarter, omoeidesRef?: string): Resolution {
  const key = normCode(rawCode);
  const direct = ANATH.codes[key];
  if (direct) return { status: "direct", code: direct.code, coeff: coeffFor(direct, quarter), desc: direct.desc };

  if (omoeidesRef) {
    const o = ANATH.codes[normCode(omoeidesRef)];
    if (o) return { status: "omoeides", code: rawCode, via: o.code, coeff: coeffFor(o, quarter), desc: o.desc };
  }
  return { status: "missing", suggestions: suggest(rawCode, quarter) };
}

/** Προτάσεις ομοειδούς: ίδιο prefix, ταξινόμηση κατά αριθμητική εγγύτητα + επικάλυψη περιγραφής. */
export function suggest(rawCode: string, quarter = ANATH.defaultQuarter, desc = "", limit = 6): Suggestion[] {
  const { prefix, num } = splitCode(rawCode);
  if (!prefix) return [];
  const dterms = new Set(desc.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  return Object.values(ANATH.codes)
    .filter((e) => splitCode(e.code).prefix === prefix)
    .map((e) => {
      const overlap = [...dterms].filter((t) => e.desc.toLowerCase().includes(t)).length;
      return { e, dist: Math.abs(splitCode(e.code).num - num), overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || a.dist - b.dist)
    .slice(0, limit)
    .map(({ e }) => ({ code: e.code, desc: e.desc, coeff: coeffFor(e, quarter) }));
}

import { type BudgetRow, type BudgetCalc, dapani } from "./budget";

/**
 * Scorecard «αξίζει η προσφορά;» — τροφοδοτείται από τον προϋπολογισμό.
 * Έσοδα = η προσφορά σας· Κόστος = το άμεσο κόστος σας (υλικά+εργατικά)·
 * Ανταγωνιστικότητα = η έκπτωσή σας vs τυπική αγοράς ανά κατηγορία.
 */

// Τυπικά εύρη μέσης έκπτωσης ανά κατηγορία (ρυθμιζόμενα, βλ. recon εκπτώσεων)
export const BENCHMARKS: Record<string, [number, number]> = {
  Οδοποιία: [0.4, 0.55],
  Οικοδομικά: [0.3, 0.45],
  Υδραυλικά: [0.35, 0.5],
  Ηλεκτρομηχανολογικά: [0.25, 0.4],
};

const PREFIX_CAT: Record<string, string> = {
  ΟΔΟ: "Οδοποιία", ΝΟΔΟ: "Οδοποιία",
  ΟΙΚ: "Οικοδομικά", ΠΡΣ: "Οικοδομικά",
  ΥΔΡ: "Υδραυλικά", ΛΙΜ: "Υδραυλικά",
  ΗΛΜ: "Ηλεκτρομηχανολογικά",
};

const prefixOf = (code: string) =>
  (code.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/^[Α-Ω]+/) || [""])[0];

export function dominantCategory(rows: BudgetRow[]): string {
  const byCat = new Map<string, number>();
  for (const r of rows) {
    const cat = PREFIX_CAT[prefixOf(r.revCode)] ?? "Οικοδομικά";
    byCat.set(cat, (byCat.get(cat) ?? 0) + dapani(r));
  }
  return [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Οικοδομικά";
}

export type Verdict = "ΑΞΙΖΕΙ" | "ΟΡΙΑΚΟ" | "ΟΧΙ" | "ΑΝΕΠΑΡΚΗ";

export interface Evaluation {
  verdict: Verdict;
  category: string;
  expectedDiscount: number; // μέση τυπική αγοράς
  yourDiscount: number;     // Εμ
  revenue: number;          // προσφορά (γενικό σύνολο)
  cost: number;             // άμεσο κόστος σας
  margin: number;
  marginPct: number;
  gap: number;              // yourDiscount − expectedDiscount
  reasons: string[];
}

export function evaluate(rows: BudgetRow[], calc: BudgetCalc, minMargin = 0.08): Evaluation {
  const category = dominantCategory(rows);
  const [lo, hi] = BENCHMARKS[category] ?? [0.3, 0.45];
  const expectedDiscount = (lo + hi) / 2;
  const yourDiscount = calc.Em;
  const revenue = calc.grandTotal;
  const cost = calc.costTotal;
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? margin / revenue : 0;
  const gap = yourDiscount - expectedDiscount;
  const reasons: string[] = [];

  if (cost <= 0)
    return { verdict: "ΑΝΕΠΑΡΚΗ", category, expectedDiscount, yourDiscount, revenue, cost, margin: 0, marginPct: 0, gap, reasons: ["Εισάγετε το κόστος σας (υλικά/εργατικά) ανά άρθρο για αξιολόγηση."] };

  // ανταγωνιστικότητα
  if (gap >= 0) reasons.push(`Ανταγωνιστική έκπτωση (≥ τυπική αγοράς ${(expectedDiscount * 100).toFixed(0)}%)`);
  else if (gap >= -0.05) reasons.push(`Έκπτωση λίγο κάτω από αγορά (${(gap * 100).toFixed(1)} μον.)`);
  else reasons.push(`⚠ Πολύ χαμηλή έκπτωση vs αγορά (${(gap * 100).toFixed(0)} μον.) — πιθανή ήττα`);

  // περιθώριο
  if (marginPct < 0) reasons.push(`Ζημία: περιθώριο ${(marginPct * 100).toFixed(1)}%`);
  else reasons.push(`Περιθώριο ${(marginPct * 100).toFixed(1)}% (${margin >= 0 ? "+" : ""}${Math.round(margin).toLocaleString("el-GR")} €)`);

  let verdict: Verdict;
  if (marginPct < 0 || gap < -0.08) verdict = "ΟΧΙ";
  else if (marginPct >= minMargin && gap >= -0.03) verdict = "ΑΞΙΖΕΙ";
  else verdict = "ΟΡΙΑΚΟ";

  return { verdict, category, expectedDiscount, yourDiscount, revenue, cost, margin, marginPct, gap, reasons };
}

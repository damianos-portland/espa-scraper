/** Υπολογισμοί προϋπολογισμού + έλεγχος ομαλότητας (Ν.4412/2016 άρθρο 95 §2α). */

export type Section = "ΟΙΚ" | "ΗΜ"; // ΟΙΚΟΔΟΜΙΚΩΝ ή Η/Μ (για split sheets)

export interface BudgetRow {
  id: string;
  desc: string;       // είδος εργασίας
  articleCode: string; // Κωδ. Άρθρου (ΝΑΟΙΚ…)
  revCode: string;     // Κωδ. Αναθ/σης (ΟΙΚ…)
  omoeides?: string;   // ρητός ομοειδής (όταν ο revCode δεν είναι εκδοθείς)
  unit: string;
  qty: number;
  price: number;       // τιμή μελέτης (ανά μονάδα)
  group: string;       // ομάδα ομοειδών εργασιών
  section: Section;    // ΟΙΚ / ΗΜ
  costMat: number;     // δικό σας κόστος — υλικά (σύνολο €)
  costLab: number;     // δικό σας κόστος — εργατικά (σύνολο €)
}

export const dapani = (r: BudgetRow) => (r.qty || 0) * (r.price || 0);
export const myCost = (r: BudgetRow) => (r.costMat || 0) + (r.costLab || 0);

/** ΟΙΚ/ΗΜ από το prefix του κωδικού αναθεώρησης (ΗΛΜ → ΗΜ, αλλιώς ΟΙΚ). */
export const sectionOf = (revCode: string): Section =>
  /ΗΛΜ/i.test(revCode.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")) ? "ΗΜ" : "ΟΙΚ";

export interface GroupCalc {
  group: string;
  meleti: number;   // δαπάνη μελέτης (ομάδα)
  discount: number; // ποσοστό έκπτωσης (fraction)
  prosfora: number; // μελέτη × (1 − έκπτωση)
  acceptable: boolean;
}

export interface BudgetCalc {
  groups: GroupCalc[];
  meletiTotal: number;
  prosforaTotal: number;
  Em: number;        // μέση έκπτωση
  lower: number;     // 1.10·Εμ − 10%
  upper: number;     // 0.90·Εμ + 10%
  allAcceptable: boolean;
  geoe: number;      // ΓΕ&ΟΕ 18%
  subTotal: number;
  aprovlepta: number; // 15%
  grandTotal: number;
  costTotal: number;  // δικό σας άμεσο κόστος (υλικά+εργατικά)
  matTotal: number;
  labTotal: number;
}

export function calcBudget(rows: BudgetRow[], discounts: Record<string, number>): BudgetCalc {
  const byGroup = new Map<string, number>();
  for (const r of rows) byGroup.set(r.group || "—", (byGroup.get(r.group || "—") ?? 0) + dapani(r));

  const meletiTotal = [...byGroup.values()].reduce((a, b) => a + b, 0);
  let prosforaTotal = 0;
  const pre: { group: string; meleti: number; discount: number; prosfora: number }[] = [];
  for (const [group, meleti] of byGroup) {
    const discount = discounts[group] ?? 0;
    const prosfora = meleti * (1 - discount);
    prosforaTotal += prosfora;
    pre.push({ group, meleti, discount, prosfora });
  }

  const Em = meletiTotal > 0 ? 1 - prosforaTotal / meletiTotal : 0;
  const lower = 1.1 * Em - 0.1;
  const upper = 0.9 * Em + 0.1;

  const groups: GroupCalc[] = pre
    .sort((a, b) => b.meleti - a.meleti)
    .map((g) => ({ ...g, acceptable: g.discount >= lower - 1e-9 && g.discount <= upper + 1e-9 }));

  const geoe = prosforaTotal * 0.18;
  const subTotal = prosforaTotal + geoe;
  const aprovlepta = subTotal * 0.15;
  const grandTotal = subTotal + aprovlepta;

  const matTotal = rows.reduce((a, r) => a + (r.costMat || 0), 0);
  const labTotal = rows.reduce((a, r) => a + (r.costLab || 0), 0);

  return {
    groups, meletiTotal, prosforaTotal, Em, lower, upper,
    allAcceptable: groups.every((g) => g.acceptable),
    geoe, subTotal, aprovlepta, grandTotal,
    costTotal: matTotal + labTotal, matTotal, labTotal,
  };
}

export const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
export const eur = (n: number) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);

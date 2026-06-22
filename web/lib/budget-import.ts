import * as xlsx from "xlsx";
import { type BudgetRow, type Section, sectionOf } from "./budget";

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => String(v ?? "").trim();
const cleanGroup = (s: string) => s.replace(/^\s*\d+[.)]\s*/, "").replace(/[-–].*$/, "").trim() || "ΛΟΙΠΑ";

/**
 * Διαβάζει τον προϋπολογισμό στη μορφή του πατέρα (φύλλα «ΠΡΟΥΠΟΛΟΓΙΣΜΟΣ …»).
 * Στήλες: B=περιγραφή, C=κωδ.άρθρου, D=κωδ.αναθ., F=μονάδα, G=ποσότητα, H=τιμή.
 * Οι γραμμές-τίτλοι ομάδας (χωρίς ποσότητα) ορίζουν την τρέχουσα ομάδα.
 */
export function parseFatherXlsx(wb: xlsx.WorkBook): BudgetRow[] {
  const rows: BudgetRow[] = [];
  for (const name of wb.SheetNames) {
    if (!/ΠΡΟΥΠΟΛΟΓΙΣΜ/i.test(name.normalize("NFC"))) continue; // μόνο τα budget φύλλα
    const section: Section = /ΗΜ\b|Η\.?Μ/i.test(name) ? "ΗΜ" : "ΟΙΚ";
    const aoa = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, blankrows: false });
    let group = "ΛΟΙΠΑ";
    for (const r of aoa.slice(1)) {
      const desc = str(r[1]);
      const revCode = str(r[3]);
      const qty = num(r[6]);
      const price = num(r[7]);
      if (!desc && !revCode) continue;
      // γραμμή-τίτλος ομάδας: έχει κείμενο, χωρίς ποσότητα, δεν είναι ΣΥΝΟΛΟ
      if (desc && qty <= 0 && !/^ΣΥΝΟΛΟ/i.test(desc.normalize("NFC"))) {
        group = cleanGroup(desc);
        continue;
      }
      if (qty > 0 && price > 0) {
        rows.push({
          id: uid(), desc, articleCode: str(r[2]), revCode,
          unit: str(r[5]), qty, price, group,
          section: revCode ? sectionOf(revCode) : section,
          costMat: 0, costLab: 0,
        });
      }
    }
  }
  return rows;
}

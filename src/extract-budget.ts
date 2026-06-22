import { readFileSync, writeFileSync } from "node:fs";

/**
 * Εξαγωγή προϋπολογισμού (ανά ομάδες) από PDF μελέτης ΕΣΗΔΗΣ — coordinate-based
 * (pdfjs με θέσεις x/y, column bucketing). Διατηρεί ΟΜΑΔΑ Α/Β/Γ.
 *   npm run extract-budget -- /path/to/meleti.pdf [out.json]
 */

// όρια στηλών κατά x (από recon σε τυπική μελέτη ΕΣΗΔΗΣ)
const COL = {
  code: [0, 105],
  desc: [105, 310],
  rev: [310, 388],
  unit: [388, 425],
  price: [425, 495],
  qty: [495, 540],
  dapani: [540, 640],
} as const;

const numGR = (s: string) => {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const inBand = (x: number, [a, b]: readonly [number, number]) => x >= a && x < b;

export interface ExtractedRow {
  group: string;
  articleCode: string;
  desc: string;
  revCode: string;
  unit: string;
  qty: number;
  price: number;
  dapani: number;
}

export async function extractBudget(pdfPath: string): Promise<ExtractedRow[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), useSystemFonts: true }).promise;

  const out: ExtractedRow[] = [];
  let group = "";
  let inBudget = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = tc.items
      .map((i: any) => ({ s: String(i.str).trim(), x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
      .filter((i) => i.s);

    // ομαδοποίηση σε γραμμές κατά y
    const rowsMap = new Map<number, typeof items>();
    for (const it of items) {
      const key = [...rowsMap.keys()].find((k) => Math.abs(k - it.y) < 3) ?? it.y;
      rowsMap.set(key, [...(rowsMap.get(key) ?? []), it]);
    }
    const rows = [...rowsMap.entries()].sort((a, b) => b[0] - a[0]).map(([, its]) => its.sort((a, b) => a.x - b.x));

    for (const r of rows) {
      const joined = r.map((i) => i.s).join(" ");
      if (/^\s*Π\s*Ρ\s*Ο\s*[ΫΥ]/.test(joined) || /ΠΡΟ[ΫΥ]ΠΟΛΟΓΙΣΜΟΣ ΜΕΛΕΤΗΣ|Κωδικός Άρθρου/.test(joined)) inBudget = true;
      const gm = joined.match(/ΟΜΑΔΑ\s+([Α-Ω0-9]+)\s*:?\s*(.*)/);
      if (gm) { inBudget = true; group = (gm[2] || gm[1]).replace(/\s+/g, " ").replace(/Σύνολο.*/i, "").replace(/[\s-]+$/, "").replace(/\s*-\s*/g, "-").trim().slice(0, 50) || `ΟΜΑΔΑ ${gm[1]}`; continue; }
      if (!inBudget) continue;
      if (/ΓΕΝΙΚΗ ΣΥΓΓΡΑΦΗ|ΕΙΔΙΚΗ ΣΥΓΓΡΑΦΗ|ΤΙΜΟΛΟΓΙΟ ΜΕΛΕΤΗΣ/.test(joined)) inBudget = false;

      const pick = (band: readonly [number, number]) => r.filter((i) => inBand(i.x, band)).map((i) => i.s);
      const revRaw = pick(COL.rev).join(" ").replace(/\s+/g, " ").trim();
      // κωδικός αναθεώρησης = απαραίτητος δείκτης γραμμής δεδομένων
      if (!/(ΟΙΚ|ΥΔΡ|ΗΛΜ|ΟΔΟ|ΠΡΣ|ΛΙΜ|ΝΟΔΟ)/.test(revRaw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))) continue;

      // αριθμοί κατά x: τα 3 τελευταία = τιμή, ποσότητα, δαπάνη (robust σε μετατόπιση)
      const nums = r.filter((i) => i.x > 400 && /^\d[\d.,]*$/.test(i.s));
      if (nums.length < 2) continue;
      const dapani = numGR(nums[nums.length - 1].s);
      const qty = numGR(nums[nums.length - 2].s);
      const price = nums.length >= 3 ? numGR(nums[nums.length - 3].s) : (qty ? dapani / qty : 0);
      if (dapani <= 0) continue;

      // μονάδα = μη-αριθμητικό token πριν τους αριθμούς (x 385–430)
      const unit = r.filter((i) => inBand(i.x, [385, 430]) && !/^\d/.test(i.s)).map((i) => i.s).join("") || "τεμ";

      out.push({
        group: group || "—",
        articleCode: pick(COL.code).join(" ").replace(/\s+/g, " ").trim(),
        desc: pick(COL.desc).join(" ").replace(/\s+/g, " ").trim(),
        revCode: revRaw.replace(/([Α-Ω]+)[\s-]+(\d)/, "$1 $2"),
        unit, qty, price, dapani,
      });
    }
  }
  return out;
}

/** Κατεβάζει το αρχείο μελέτης/προϋπολογισμού από το ΕΣΗΔΗΣ μέσω αριθμού συστήματος. */
export async function downloadMeleti(sys: string): Promise<string> {
  const { chromium } = await import("playwright");
  const b = await chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ acceptDownloads: true });
    const pg = await ctx.newPage();
    await pg.goto(`http://pwgopendata.eprocurement.gov.gr/actSearchErgwn/resources/search/${sys}`, { waitUntil: "networkidle", timeout: 45000 });
    await pg.waitForTimeout(2500);
    await pg.getByText("Συνημμένα Αρχεία").first().click();
    await pg.waitForTimeout(3500);
    const rows = pg.locator("[role=row], tr").filter({ hasText: /ΜΕΛΕΤΗ|ΠΡΟ[ΫΥ]ΠΟΛΟΓΙΣΜ/i });
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const dl = rows.nth(i).getByText("Λήψη").first();
      if (await dl.count()) {
        const [download] = await Promise.all([pg.waitForEvent("download", { timeout: 30000 }).catch(() => null), dl.click().catch(() => {})]);
        if (download) {
          const path = `/tmp/meleti-${sys}.pdf`;
          await download.saveAs(path);
          return path;
        }
      }
    }
    throw new Error("Δεν βρέθηκε αρχείο μελέτης/προϋπολογισμού στα συνημμένα.");
  } finally {
    await b.close();
  }
}

async function main() {
  let arg = process.argv[2];
  if (!arg) throw new Error("Δώσε path PDF ή --sys <αριθμός συστήματος>.");
  let pdfPath = arg;
  if (arg === "--sys") {
    const sys = process.argv[3];
    console.log(`↓ Κατέβασμα μελέτης από ΕΣΗΔΗΣ (ΑΑ ${sys})…`);
    pdfPath = await downloadMeleti(sys);
    console.log(`  ${pdfPath}`);
  }
  const rows = await extractBudget(pdfPath);
  const byGroup = new Map<string, number>();
  for (const r of rows) byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + r.dapani);
  console.log(`✓ ${rows.length} άρθρα σε ${byGroup.size} ομάδες:`);
  for (const [g, sum] of byGroup) console.log(`  • ${g}: ${sum.toLocaleString("el-GR", { minimumFractionDigits: 2 })} €`);
  const out = (arg === "--sys" ? process.argv[4] : process.argv[3]) ?? "/tmp/budget-extracted.json";
  writeFileSync(out, JSON.stringify({ source: pdfPath.split("/").pop(), total: rows.reduce((a, r) => a + r.dapani, 0), rows }, null, 2));
  console.log(`→ ${out}`);
}

if (process.argv[1]?.includes("extract-budget")) main().catch((e) => { console.error(e); process.exit(1); });

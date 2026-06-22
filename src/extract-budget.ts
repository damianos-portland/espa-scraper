import { readFileSync, writeFileSync } from "node:fs";

/**
 * Εξαγωγή προϋπολογισμού (ανά ομάδες) από PDF μελέτης ΕΣΗΔΗΣ — coordinate-based
 * (pdfjs με θέσεις x/y, column bucketing). Διατηρεί ΟΜΑΔΑ Α/Β/Γ.
 *   npm run extract-budget -- /path/to/meleti.pdf [out.json]
 */

const numGR = (s: string) => {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

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
      // ανίχνευση πίνακα προϋπολογισμού (πολλαπλά σήματα για robustness σε διαφορετικά layouts)
      if (/ΠΡΟ[ΫΥ]ΠΟΛΟΓΙΣΜΟΣ ΜΕΛΕΤΗΣ|Κωδικός Άρθρου|Άρθρο Αναθεώρησης/.test(joined) || (/Ποσότητα/.test(joined) && /Δαπάνη/.test(joined))) inBudget = true;
      const gm = joined.match(/ΟΜΑΔΑ\s+([Α-Ω0-9]+)\s*:?\s*(.*)/);
      if (gm) { inBudget = true; group = (gm[2] || gm[1]).replace(/\s+/g, " ").replace(/Σύνολο.*/i, "").replace(/[\s-]+$/, "").replace(/\s*-\s*/g, "-").trim().slice(0, 50) || `ΟΜΑΔΑ ${gm[1]}`; continue; }
      if (!inBudget) continue;
      if (/ΓΕΝΙΚΗ ΣΥΓΓΡΑΦΗ|ΕΙΔΙΚΗ ΣΥΓΓΡΑΦΗ|ΤΙΜΟΛΟΓΙΟ ΜΕΛΕΤΗΣ/.test(joined)) inBudget = false;

      // ── adaptive parsing: άγκυρα = ΜΟΝΑΔΑ + τελικά νούμερα (ο κωδ. αναθ. προαιρετικός) ──
      // latin-fix: λατινικά lookalikes -> ελληνικά (π.χ. «OIK» -> «ΟΙΚ»)
      const LAT: Record<string, string> = { A: "Α", B: "Β", E: "Ε", H: "Η", I: "Ι", K: "Κ", M: "Μ", N: "Ν", O: "Ο", P: "Ρ", T: "Τ", X: "Χ", Y: "Υ", Z: "Ζ" };
      const grk = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[A-Z]/g, (c) => LAT[c] ?? c);
      const REV = /^(ΟΙΚ|ΥΔΡ|ΗΛΜ|ΟΔΟ|ΠΡΣ|ΛΙΜ|ΝΟΔΟ|ΑΤΗΕ|ΑΤΟΕ|ΑΤΛΕ|ΝΑ)/;
      const isNum = (s: string) => /^\d[\d.,]*$/.test(s);

      // τελικά νούμερα = τιμή, ποσότητα, δαπάνη· η δαπάνη πρέπει να είναι money (,dd)
      const numToks = r.filter((t) => isNum(t.s));
      if (numToks.length < 2 || !/,\d{2}$/.test(numToks[numToks.length - 1].s)) continue;
      const dapani = numGR(numToks[numToks.length - 1].s);
      if (dapani <= 0) continue;
      const qty = numGR(numToks[numToks.length - 2].s);
      const price = numToks.length >= 3 ? numGR(numToks[numToks.length - 3].s) : (qty ? dapani / qty : 0);
      const valStartX = numToks[Math.max(0, numToks.length - 3)].x;

      // μονάδα = μη-αριθμητικό token ακριβώς αριστερά των value columns
      const unit = r.filter((t) => !isNum(t.s) && t.x > 340 && t.x < valStartX).map((t) => t.s).pop() ?? "τεμ";

      // κωδ. αναθεώρησης (προαιρετικός): δεξιότερο token που ταιριάζει σε REV (x>120)
      let revCode = "";
      const revCand = r.map((t) => ({ t, c: grk(t.s) })).filter((o) => o.t.x > 120 && o.t.x < valStartX && REV.test(o.c)).sort((a, b) => b.t.x - a.t.x);
      if (revCand.length) {
        const o = revCand[0]; revCode = o.c.replace(/[\s-]+/g, " ").trim();
        const idx = r.indexOf(o.t);
        if (!/\d/.test(revCode) && r[idx + 1] && /^[Ν\d][\d.]*$/.test(r[idx + 1].s)) revCode = `${revCode} ${r[idx + 1].s}`;
      }

      const articleCode = r.filter((t) => t.x < 105).map((t) => t.s).join(" ").replace(/\s+/g, " ").trim();
      const descMax = revCand.length ? revCand[revCand.length - 1].t.x : valStartX;
      const desc = r.filter((t) => t.x >= 105 && t.x < descMax && !isNum(t.s)).map((t) => t.s).join(" ").replace(/\s+/g, " ").trim();

      out.push({ group: group || "—", articleCode, desc, revCode, unit, qty, price, dapani });
    }
  }
  return out;
}

/**
 * Εξάγει τον αριθμό συστήματος ΕΣΗΔΗΣ από κείμενο διακήρυξης.
 * 1) pwgopendata link (πιο αξιόπιστο)· 2) 6-ψήφιος κοντά σε «α/α/συστημικός αριθμός»·
 * 3) fallback: συχνότερος 6-ψήφιος κοντά σε «συστημ».
 */
export function extractSysNo(text: string): string | null {
  const link = text.match(/pwgopendata[^\s)"']*?search\/(\d{5,7})/i);
  if (link) return link[1];
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cues = [
    /α\/α\s*συστ[ηι]ματος[^\d]{0,20}(\d{6})/,
    /συστημικ[οω][^.]{0,30}?αριθμ[οω][^\d]{0,25}(\d{6})/,
    /αυξ[οω]ν\s*αριθμ[οω][^\d]{0,20}(\d{6})/,
    /α\/α\s*εσηδης[^\d]{0,15}(\d{6})/,
  ];
  for (const re of cues) { const m = t.match(re); if (m) return m[1]; }
  const near = [...t.matchAll(/συστημ[^.]{0,45}?(\d{6})/g)].map((m) => m[1]).filter((n) => +n >= 100000);
  if (near.length) {
    const f: Record<string, number> = {};
    near.forEach((n) => (f[n] = (f[n] ?? 0) + 1));
    return Object.entries(f).sort((a, b) => b[1] - a[1])[0][0];
  }
  return null;
}

/** Κατεβάζει το αρχείο μελέτης/προϋπολογισμού από το ΕΣΗΔΗΣ μέσω αριθμού συστήματος. */
export async function downloadMeleti(sys: string): Promise<string> {
  const { chromium } = await import("playwright");
  const b = await chromium.launch({ headless: true });
  try {
    const ctx = await b.newContext({ acceptDownloads: true });
    const pg = await ctx.newPage();
    const url = `http://pwgopendata.eprocurement.gov.gr/actSearchErgwn/resources/search/${sys}`;
    // άνοιγμα tab «Συνημμένα Αρχεία» με retry (το ADF του ΕΣΗΔΗΣ αργεί ενίοτε)
    const openAttachments = async () => {
      const tab = pg.getByText("Συνημμένα Αρχεία").first();
      await tab.waitFor({ state: "visible", timeout: 18000 });
      await tab.click();
      await pg.waitForTimeout(3500);
    };
    await pg.goto(url, { waitUntil: "networkidle", timeout: 40000 });
    await pg.waitForTimeout(2500);
    // γρήγορος έλεγχος: μη-δημόσιος/κλειστός/ανύπαρκτος διαγωνισμός
    const body = await pg.innerText("body").catch(() => "");
    if (/Δεν υφίσταται|κλειστή.{0,20}διαγωνιστικ/i.test(body))
      throw new Error("Ο διαγωνισμός δεν είναι δημόσια διαθέσιμος στο ΕΣΗΔΗΣ (κλειστή/άλλη διαδικασία).");
    try {
      await openAttachments();
    } catch {
      await pg.goto(url, { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
      await pg.waitForTimeout(3000);
      await openAttachments();
    }
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

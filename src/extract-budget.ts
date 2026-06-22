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

export interface BudgetExtract {
  rows: ExtractedRow[];
  worksTotal: number | null;          // επίσημο «Σύνολο Δαπανών» (works, προ ΓΕ&ΟΕ)
  groupTotals: Record<string, number>; // επίσημα «Άθροισμα Ομάδας»
}

export async function extractBudget(pdfPath: string): Promise<BudgetExtract> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), useSystemFonts: true }).promise;

  const out: ExtractedRow[] = [];
  const groupTotals: Record<string, number> = {}; // επίσημα «Άθροισμα Ομάδας»
  let worksTotal: number | null = null; // επίσημο «Σύνολο Δαπανών»
  let group = "ΟΜΑΔΑ Α"; // default για items πριν εμφανιστεί marker
  let pending = ""; // συσσώρευση περιγραφής από text-only γραμμές (wrap)
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
      if (gm) {
        inBudget = true;
        const nm = (gm[2] || "").replace(/Σύνολο.*/i, "").replace(/\s+/g, " ").replace(/^[\s.:·\-]+|[\s.:·\-]+$/g, "").trim().slice(0, 50);
        group = nm || `ΟΜΑΔΑ ${gm[1]}`;
        pending = "";
        continue;
      }
      if (!inBudget) continue;
      if (/ΓΕΝΙΚΗ ΣΥΓΓΡΑΦΗ|ΕΙΔΙΚΗ ΣΥΓΓΡΑΦΗ|ΤΙΜΟΛΟΓΙΟ ΜΕΛΕΤΗΣ/.test(joined)) inBudget = false;

      // επίσημα σύνολα (για αυτο-επικύρωση)
      const lastMoney = () => {
        const m = r.filter((t) => /^\d{1,3}(\.\d{3})*,\d{2}$/.test(t.s));
        return m.length ? numGR(m[m.length - 1].s) : null;
      };
      if (/[ΆΑ]θροισμα Ομάδας|ΣΥΝΟΛΟ ΟΜΑΔΑΣ/i.test(joined)) { const v = lastMoney(); if (v) groupTotals[group || "—"] = v; continue; }
      if (/Σύνολο Δαπανών|[ΆΑ]θροισμα Εργασιών|ΣΥΝΟΛΟ ΕΡΓΑΣΙΩΝ/i.test(joined)) { const v = lastMoney(); if (v && (!worksTotal || v > worksTotal)) worksTotal = v; continue; }

      // ── adaptive parsing: άγκυρα = ΜΟΝΑΔΑ + τελικά νούμερα (ο κωδ. αναθ. προαιρετικός) ──
      // latin-fix: λατινικά lookalikes -> ελληνικά (π.χ. «OIK» -> «ΟΙΚ»)
      const LAT: Record<string, string> = { A: "Α", B: "Β", E: "Ε", H: "Η", I: "Ι", K: "Κ", M: "Μ", N: "Ν", O: "Ο", P: "Ρ", T: "Τ", X: "Χ", Y: "Υ", Z: "Ζ" };
      const grk = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[A-Z]/g, (c) => LAT[c] ?? c);
      const REV = /^(ΟΙΚ|ΥΔΡ|ΗΛΜ|ΟΔΟ|ΠΡΣ|ΛΙΜ|ΝΟΔΟ|ΑΤΗΕ|ΑΤΟΕ|ΑΤΛΕ|ΝΑ)/;
      const isNum = (s: string) => /^\d[\d.,]*$/.test(s);

      // τελικά νούμερα = τιμή, ποσότητα, δαπάνη· η δαπάνη πρέπει να είναι money (,dd)
      const numToks = r.filter((t) => isNum(t.s));
      if (numToks.length < 2 || !/,\d{2}$/.test(numToks[numToks.length - 1].s)) {
        // text-only γραμμή -> συσσώρευση ως (συνεχιζόμενη) περιγραφή
        if (/[α-ωΑ-Ω]{4,}/.test(joined) && !/ΣΥΝΟΛΟ|ΑΘΡΟΙΣΜΑ|Τιμή|Δαπάνη|Κωδικός|Ποσότητα/i.test(joined) && pending.length < 300)
          pending = (pending + " " + joined).trim();
        continue;
      }
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

      // adaptive code/desc: όλα αριστερά του κωδ. αναθεώρησης (όχι fixed x-bands)
      const cutX = revCand.length ? revCand[revCand.length - 1].t.x : valStartX;
      const leftToks = r.filter((t) => t.x < cutX).sort((a, b) => a.x - b.x);
      const articleCode = leftToks[0]?.s ?? "";
      const ownDesc = leftToks.slice(1).filter((t) => !isNum(t.s)).map((t) => t.s).join(" ");
      const desc = `${pending} ${ownDesc}`.replace(/\s+/g, " ").trim().slice(0, 220);
      pending = "";

      out.push({ group: group || "—", articleCode, desc, revCode, unit, qty, price, dapani });
    }
  }
  return { rows: out, worksTotal, groupTotals };
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
    // χαρτογράφηση κάθε «Λήψη» -> όνομα αρχείου, score, μαρκάρισμα του καλύτερου
    // (inline, χωρίς named const functions -> αποφυγή esbuild «__name» στο browser)
    const picked = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll("a,button,span")].filter((e) => e.textContent && e.textContent.trim() === "Λήψη");
      let best = null;
      let bestScore = 0;
      for (const el of btns) {
        let row = el;
        let text = "";
        for (let k = 0; k < 6 && row; k++) { row = row.parentElement; if (row && row.textContent && /\.(pdf|xls|xlsx|doc|docx)/i.test(row.textContent)) { text = row.textContent; break; } }
        let s = 0;
        if (text) {
          const n = text.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          if (/ΚΑΝΟΝΙΣΜ|ΤΕΧΝΙΚ|ΣΥΓΓΡΑΦ|ΤΙΜΟΛΟΓ|ΔΙΑΚΗΡΥ|ΟΙΚΟΝΟΜΙΚ|ESPD|ΕΕΕΣ|ΧΡΟΝΟΔΙΑΓ|ΑΠΑΙΤΗΣ|ΠΡΟΜΕΤΡΗΣ|ΦΑΥ|ΣΑΥ/.test(n)) s = -1;
          else if (/ΠΡΟ[ΫΥ]ΠΟΛΟΓΙΣΜ/.test(n)) s = 3;
          else if (/ΕΝΙΑΙΑ ΜΕΛΕΤ/.test(n)) s = 2;
          else if (/ΜΕΛΕΤ/.test(n)) s = 1;
        }
        if (s > bestScore) { bestScore = s; best = el; }
      }
      if (!best) return null;
      best.setAttribute("data-budget-pick", "1");
      return bestScore;
    });
    if (!picked) throw new Error("Δεν βρέθηκε αρχείο προϋπολογισμού/μελέτης στα συνημμένα.");

    const [download] = await Promise.all([
      pg.waitForEvent("download", { timeout: 30000 }),
      pg.locator('[data-budget-pick="1"]').click(),
    ]);
    const path = `/tmp/meleti-${sys}.pdf`;
    await download.saveAs(path);
    return path;
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
  const { rows, worksTotal, groupTotals } = await extractBudget(pdfPath);
  const byGroup = new Map<string, number>();
  for (const r of rows) byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + r.dapani);
  const fmt = (n: number) => n.toLocaleString("el-GR", { minimumFractionDigits: 2 });
  console.log(`✓ ${rows.length} άρθρα σε ${byGroup.size} ομάδες:`);
  for (const [g, sum] of byGroup) {
    const off = groupTotals[g];
    const flag = off ? (Math.abs(off - sum) < 1 ? " ✓" : ` ⚠ επίσημο ${fmt(off)}`) : "";
    console.log(`  • ${g}: ${fmt(sum)} €${flag}`);
  }
  const total = rows.reduce((a, r) => a + r.dapani, 0);
  if (worksTotal) {
    const acc = ((total / worksTotal) * 100).toFixed(1);
    console.log(`Σύνολο: ${fmt(total)} € | επίσημο ${fmt(worksTotal)} € → ${acc}%`);
  }
  const out = (arg === "--sys" ? process.argv[4] : process.argv[3]) ?? "/tmp/budget-extracted.json";
  writeFileSync(out, JSON.stringify({ source: pdfPath.split("/").pop(), total, worksTotal, groupTotals, rows }, null, 2));
  console.log(`→ ${out}`);
}

if (process.argv[1]?.includes("extract-budget")) main().catch((e) => { console.error(e); process.exit(1); });

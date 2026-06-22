import * as xlsx from "xlsx";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";

/**
 * Μετατρέπει το κυβερνητικό αρχείο συντελεστών αναθεώρησης (xlsx) σε bundled JSON
 * για το web app. Πηγή: ~/Downloads/ΚωδικοίΑναθεώρησης… (ή path ως arg).
 *   npm run anatheorisi:build
 */
const OUT = new URL("../web/lib/anatheorisi.json", import.meta.url).pathname;

const norm = (s: unknown) =>
  String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s\-]/g, "");

function findSource(): string {
  if (process.argv[2]) return process.argv[2];
  const dir = `${homedir()}/Downloads/`;
  const f = readdirSync(dir).find((x) => /ναθε[ωώ]ρησης/i.test(x.normalize("NFC")) && x.endsWith(".xlsx"));
  if (!f) throw new Error("Δεν βρέθηκε αρχείο αναθεώρησης στο ~/Downloads (δώσε path ως arg).");
  return dir + f;
}

function main() {
  const src = findSource();
  const wb = xlsx.read(readFileSync(src));
  const rows = xlsx.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  const header = rows[0].map((h) => String(h ?? "").trim());

  // στήλες τριμήνων = όσες ταιριάζουν σε πατέρα 20\d\dΑ-Δ
  const quarterCols = header
    .map((h, i) => ({ h, i }))
    .filter((x) => /^20\d\d[ΑΒΓΔαβγδABCD]/.test(x.h.normalize("NFC")));
  const quarters = quarterCols.map((q) => q.h);

  const codes: Record<string, any> = {};
  for (const r of rows.slice(1)) {
    const raw = String(r[2] ?? "").trim();
    if (!raw) continue;
    const coeffs = quarterCols.map((q) => {
      const v = r[q.i];
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    });
    codes[norm(raw)] = { code: raw, wbs: String(r[1] ?? ""), desc: String(r[3] ?? "").trim(), unit: String(r[4] ?? ""), coeffs };
  }

  const data = {
    source: src.split("/").pop(),
    quarters,
    defaultQuarter: quarters[quarters.length - 1],
    count: Object.keys(codes).length,
    codes,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  console.log(`✓ ${OUT}`);
  console.log(`  ${data.count} κωδικοί · τρίμηνα: ${quarters.join(", ")} · default ${data.defaultQuarter}`);
}

main();

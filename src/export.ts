import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { prisma, rowToCall } from "./db.js";
import { PROFILES } from "./profiles.js";
import { rankForProfile } from "./matching.js";
import { fetchTenders, enrichTenders, type Tender } from "./tenders.js";

const TENDER_CACHE = new URL("../web/.tender-cache.json", import.meta.url).pathname;

/**
 * Παράγει στατικό snapshot `web/public/data.json` που τρώει το Next.js app.
 * Έτσι το web δεν χρειάζεται DB (free static deploy). Τρέξε μετά από `scrape`.
 *   npm run export
 */
const OUT = new URL("../web/data.json", import.meta.url).pathname;

async function main() {
  const rows = await prisma.call.findMany({ orderBy: [{ status: "asc" }, { deadline: "asc" }] });
  const calls = rows.map(rowToCall);
  const open = calls.filter((c) => c.status === "OPEN");

  const bySource: Record<string, number> = {};
  for (const c of calls) bySource[c.source] = (bySource[c.source] ?? 0) + 1;

  const matches: Record<string, { id: string; score: number; reasons: string[] }[]> = {};
  for (const p of PROFILES) {
    matches[p.id] = rankForProfile(open, p).map((s) => ({
      id: s.call.id,
      score: s.score,
      reasons: s.reasons,
    }));
  }

  // Διαγωνισμοί δημοσίων έργων (ΔΙΑΥΓΕΙΑ) — ζωντανό fetch, ανεκτικό σε σφάλμα
  let tenders: Tender[] = [];
  try {
    process.stdout.write("  τράβηγμα διαγωνισμών (ΔΙΑΥΓΕΙΑ)… ");
    tenders = await fetchTenders();
    console.log(`${tenders.length}`);
    process.stdout.write("  ανάγνωση διακηρύξεων (κατηγορία/εγγύηση)… ");
    tenders = await enrichTenders(tenders, TENDER_CACHE);
    console.log("✓");
  } catch (e) {
    console.log(`✗ ${(e as Error).message} (συνεχίζω χωρίς διαγωνισμούς)`);
  }

  const data = {
    generatedAt: new Date().toISOString(),
    stats: { total: calls.length, open: open.length, bySource, tenders: tenders.length },
    profiles: PROFILES,
    calls,
    matches,
    tenders,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2), "utf8");
  console.log(`✓ ${OUT}`);
  console.log(`  ${calls.length} προσκλήσεις (${open.length} ανοιχτές) · ${tenders.length} διαγωνισμοί · ${PROFILES.length} profiles`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

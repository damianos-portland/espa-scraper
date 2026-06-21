import type { Browser } from "playwright";
import { SOURCES } from "./sources/index.js";
import { normalizeCall } from "./normalize.js";
import { upsertCall, prisma } from "./db.js";

/**
 * Orchestrator. Τρέχει όλες τις πηγές (ή μία με --source <key>),
 * κανονικοποιεί και κάνει upsert στη βάση.
 *   npm run scrape
 *   npm run scrape -- --source antagonistikotita
 *   npm run scrape -- --dry   (χωρίς εγγραφή στη βάση)
 */
async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--source") ? args[args.indexOf("--source") + 1] : null;
  const dry = args.includes("--dry");

  const sources = only ? SOURCES.filter((s) => s.key === only) : SOURCES;
  if (only && sources.length === 0) {
    console.error(`Άγνωστη πηγή: ${only}. Διαθέσιμες: ${SOURCES.map((s) => s.key).join(", ")}`);
    process.exit(1);
  }

  let browser: Browser | undefined;
  if (sources.some((s) => s.needsBrowser)) {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
  }

  let total = 0;
  for (const src of sources) {
    process.stdout.write(`▸ ${src.label} … `);
    try {
      const raw = await src.fetch(src.needsBrowser ? browser : undefined);
      const calls = raw.map(normalizeCall);
      if (!dry) for (const c of calls) await upsertCall(c);
      total += calls.length;
      console.log(`${calls.length} προσκλήσεις${dry ? " (dry)" : ""}`);
      if (dry) for (const c of calls) console.log(summarize(c));
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  await browser?.close();
  await prisma.$disconnect();
  console.log(`\nΣύνολο: ${total} προσκλήσεις από ${sources.length} πηγές.`);
}

function summarize(c: ReturnType<typeof normalizeCall>): string {
  const bits = [
    `  • ${c.title}`,
    `    status=${c.status}`,
    c.deadline && `λήξη=${c.deadline}`,
    c.aidIntensityPct && `${c.aidIntensityPct}%`,
    c.themes.length && `themes=[${c.themes.join(",")}]`,
    c.geography.length && `geo=[${c.geography.join(",")}]`,
  ].filter(Boolean);
  return bits.join("  ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

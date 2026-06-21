import { prisma, rowToCall } from "./db.js";
import { PROFILES } from "./profiles.js";
import { rankForProfile } from "./matching.js";

/**
 * Matching engine (CLI). Βαθμολογεί κάθε ΑΝΟΙΧΤΗ πρόσκληση ως προς κάθε profile.
 *   npm run match
 *   npm run match -- construction-ae
 */
async function main() {
  const onlyId = process.argv[2];
  const profiles = onlyId ? PROFILES.filter((p) => p.id === onlyId) : PROFILES;

  const open = (await prisma.call.findMany({ where: { status: "OPEN" } })).map(rowToCall);
  console.log(`\n${open.length} ανοιχτές προσκλήσεις στη βάση.\n`);

  for (const p of profiles) {
    const ranked = rankForProfile(open, p);
    console.log(`\n══ ${p.label} ══`);
    if (p.notes) console.log(`   ${p.notes}`);
    if (!ranked.length) { console.log("   (καμία αντιστοίχιση)"); continue; }

    for (const { call, score, reasons } of ranked.slice(0, 8)) {
      const meta = [
        call.deadline && `λήξη ${call.deadline}`,
        call.aidIntensityPct && `${call.aidIntensityPct}%`,
      ].filter(Boolean).join(" · ");
      console.log(`   [${score}] ${call.title}`);
      console.log(`        ${reasons.join(", ")}${meta ? "  — " + meta : ""}`);
      console.log(`        ${call.officialUrl}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

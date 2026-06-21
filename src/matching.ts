import type { Profile } from "./profiles.js";
import type { FundingCall } from "./schema.js";

/** Κοινή λογική scoring (CLI `match`, `export`, web app). */

export interface Scored {
  call: FundingCall;
  score: number;
  reasons: string[];
}

const overlap = <T>(a: T[], b: T[]) => a.filter((x) => b.includes(x)).length;

export function scoreCall(call: FundingCall, p: Profile): Scored {
  const reasons: string[] = [];
  let score = 0;

  const th = overlap(call.themes, p.themes);
  if (th) { score += th * 3; reasons.push(`${th} κοινή θεματική`); }

  const be = overlap(call.beneficiaryTypes, p.beneficiaryTypes);
  if (be) { score += be * 2; reasons.push("ταιριάζει ο τύπος δικαιούχου"); }

  const ge = overlap(call.geography, p.geography);
  if (ge) { score += ge * 2; reasons.push("επιλέξιμη γεωγραφία"); }
  if (call.geography.includes("DYTIKI_ELLADA") && p.geography.includes("DYTIKI_ELLADA")) {
    score += 3; reasons.push("τοπικό Δυτικής Ελλάδας");
  }

  const excluded = (p.kad ?? []).some((k) =>
    call.excludedKad.some((e) => e.toLowerCase().includes(k.toLowerCase())),
  );
  if (excluded) { score -= 5; reasons.push("⚠ πιθανή εξαίρεση ΚΑΔ"); }

  return { call, score, reasons };
}

/** Κατατάσσει τις ανοιχτές προσκλήσεις για ένα profile (score > 0). */
export function rankForProfile(calls: FundingCall[], p: Profile): Scored[] {
  return calls
    .filter((c) => c.status === "OPEN")
    .map((c) => scoreCall(c, p))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

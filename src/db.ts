import { PrismaClient } from "@prisma/client";
import type { FundingCall } from "./schema.js";

export const prisma = new PrismaClient();

const ARRAY_FIELDS = [
  "beneficiaryTypes",
  "themes",
  "geography",
  "aidTypes",
  "eligibleKad",
  "excludedKad",
  "docUrls",
] as const;

/** Upsert μιας κανονικοποιημένης πρόσκλησης (array fields -> JSON string). */
export async function upsertCall(c: FundingCall) {
  const row: Record<string, unknown> = {
    id: c.id,
    source: c.source,
    sourceId: c.sourceId,
    title: c.title,
    programFamily: c.programFamily ?? null,
    summary: c.summary ?? null,
    status: c.status,
    budgetMin: c.budgetMin ?? null,
    budgetMax: c.budgetMax ?? null,
    aidIntensityPct: c.aidIntensityPct ?? null,
    totalFund: c.totalFund ?? null,
    opensAt: c.opensAt ?? null,
    deadline: c.deadline ?? null,
    officialUrl: c.officialUrl,
    rawHash: c.rawHash,
  };
  for (const f of ARRAY_FIELDS) row[f] = JSON.stringify((c as any)[f] ?? []);

  return prisma.call.upsert({
    where: { source_sourceId: { source: c.source, sourceId: c.sourceId } },
    create: row as any,
    update: row as any,
  });
}

/** Διαβάζει ένα row πίσω σε FundingCall (JSON string -> array). */
export function rowToCall(row: any): FundingCall {
  const out: any = { ...row };
  for (const f of ARRAY_FIELDS) out[f] = JSON.parse(row[f] ?? "[]");
  return out as FundingCall;
}

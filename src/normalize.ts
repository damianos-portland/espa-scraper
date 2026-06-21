import { createHash } from "node:crypto";
import type {
  AidType,
  BeneficiaryType,
  FundingCall,
  Geography,
  RawCall,
  Status,
  Theme,
} from "./schema.js";

/**
 * Heuristic tagging: από ελληνικό τίτλο/περίληψη βγάζει themes/δικαιούχους/γεωγραφία
 * όταν η πηγή δεν τα δίνει δομημένα. Συμπληρώνει — δεν αντικαθιστά — ό,τι έχει ήδη ο scraper.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // αφαίρεση τόνων

type Rule<T> = [T, RegExp];

const THEME_RULES: Rule<Theme>[] = [
  ["DIGITAL", /ψηφιακ|digital|τεχνολογι|λογισμικ|ecommerce|ηλεκτρονικο εμποριο/],
  ["GREEN_ENERGY", /πρασιν|ενεργει|φωτοβολτα|εξοικονομ|αναβαθμιση ενεργειακ/],
  ["RENOVATION", /ανακαινι|κτιρι|αναβαθμιση κτιρ|εκσυγχρονισμ/],
  ["NEW_ENTREPRENEURSHIP", /ιδρυση|νεα επιχειρηματικ|ξεκινω|αυτοαπασχολ|start-?up|νεοφυ/],
  ["EXTROVERSION", /εξωστρεφει|εξαγωγ|διεθν/],
  ["SKILLS", /καταρτιση|δεξιοτητ|επιμορφωση/],
  ["RND_INNOVATION", /ερευνα|καινοτομ|innovation|r&d/],
  ["LIQUIDITY", /ρευστοτητα|κεφαλαιο κινησης|δανει|μικροπιστωσ/],
  ["TOURISM", /τουρισ|ξενοδοχ|καταλυμα/],
  ["AGRI", /αγροτικ|leader|γεωργ|μεταποιηση προιοντων/],
];

const BENEFICIARY_RULES: Rule<BeneficiaryType>[] = [
  ["NEW_BUSINESS", /υπο συσταση|νεα επιχειρ|ιδρυση/],
  ["STARTUP", /νεοφυ|start-?up|elevate/],
  ["FREELANCER", /αυτοαπασχολ|ελευθερ(ος|ων) επαγγελμ|επιστημον/],
  ["INDIVIDUAL", /νοικοκυρι|φυσικα προσωπα|ιδιωτ/],
  ["LARGE_ENTERPRISE", /μεγαλ(η|ες) επιχειρ/],
  ["EXISTING_SME", /υφισταμεν|μικρομεσαι|μμε|μικρ(η|ες) επιχειρ|πολυ μικρ/],
];

const AID_RULES: Rule<AidType>[] = [
  ["GRANT", /επιχορηγ|επιδοτηση/],
  ["LOAN", /δανει|μικροπιστωσ/],
  ["GUARANTEE", /εγγυηση/],
  ["TAX_RELIEF", /φοροαπαλλαγ|φορολογικ(η|ες) απαλλαγ|αναπτυξιακ(ος|ου) νομ/],
  ["SUBSIDY_RATE", /επιδοτηση επιτοκ/],
];

const GEO_RULES: Rule<Geography>[] = [
  ["DYTIKI_ELLADA", /δυτικη(ς)? ελλαδ|αιτωλοακαρναν|μεσολογγ|αχαι|πατρα|ηλει/],
  ["RURAL_LEADER", /leader|αγροτικ|υπαιθρ/],
];

function applyRules<T>(text: string, rules: Rule<T>[]): T[] {
  const t = norm(text);
  const hits = rules.filter(([, re]) => re.test(t)).map(([tag]) => tag);
  return [...new Set(hits)];
}

/** ISO σήμερα (Date.now απαγορεύεται σε workflow scripts, εδώ είναι ΟΚ — κανονικό node). */
function statusFromDates(opensAt?: string, deadline?: string): Status {
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) return "CLOSED";
  if (opensAt && opensAt > today) return "UPCOMING";
  if (deadline || opensAt) return "OPEN";
  return "UNKNOWN";
}

export function hashOf(raw: RawCall): string {
  return createHash("sha1")
    .update(JSON.stringify([raw.title, raw.summary, raw.deadline, raw.budgetMax]))
    .digest("hex")
    .slice(0, 12);
}

/** RawCall -> πλήρως κανονικοποιημένο FundingCall (γεμίζει tags με heuristics). */
export function normalizeCall(raw: RawCall): FundingCall {
  const text = [raw.title, raw.summary, raw.programFamily].filter(Boolean).join(" · ");

  const merge = <T>(given: T[] | undefined, derived: T[]) => [
    ...new Set([...(given ?? []), ...derived]),
  ];

  return {
    id: `${raw.source}:${raw.sourceId}`,
    source: raw.source,
    sourceId: raw.sourceId,
    title: raw.title,
    programFamily: raw.programFamily,
    summary: raw.summary,
    status: raw.status ?? statusFromDates(raw.opensAt, raw.deadline),
    beneficiaryTypes: merge(raw.beneficiaryTypes, applyRules(text, BENEFICIARY_RULES)),
    themes: merge(raw.themes, applyRules(text, THEME_RULES)),
    geography: merge(raw.geography, applyRules(text, GEO_RULES)),
    aidTypes: merge(raw.aidTypes, applyRules(text, AID_RULES)),
    eligibleKad: raw.eligibleKad ?? [],
    excludedKad: raw.excludedKad ?? [],
    budgetMin: raw.budgetMin,
    budgetMax: raw.budgetMax,
    aidIntensityPct: raw.aidIntensityPct,
    totalFund: raw.totalFund,
    opensAt: raw.opensAt,
    deadline: raw.deadline,
    officialUrl: raw.officialUrl,
    docUrls: raw.docUrls ?? [],
    rawHash: raw.rawHash ?? hashOf(raw),
  };
}

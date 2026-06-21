/**
 * Κανονικοποιημένο schema: ΕΝΑ record ανά πρόσκληση/δράση, ανεξάρτητα πηγής.
 * Τα controlled vocabularies παρακάτω είναι τα tags πάνω στα οποία χτίζεται
 * το φιλτράρισμα (web app) και το matching (προφίλ -> προγράμματα).
 */

// ── Πηγές ─────────────────────────────────────────────────────────────────
export const SOURCES = [
  "espa.gr",
  "antagonistikotita", // 21-27.antagonistikotita.gr (ΕΠΑνΕΚ / Ανταγωνιστικότητα)
  "greece2_0",         // greece20.gov.gr (Ταμείο Ανάκαμψης / RRF)
  "anaptyxiakos",      // ependyseis.gr / ΠΣΚΕ (Αναπτυξιακός Νόμος)
  "pde",               // pde.gov.gr (Περιφέρεια Δυτικής Ελλάδας)
  "exoikonomo",        // Εξοικονομώ / Εξοικονομώ-Ανακαινίζω
  "aggregator",        // σύμβουλοι (enrichment / cross-check)
] as const;
export type Source = (typeof SOURCES)[number];

// ── Κατάσταση πρόσκλησης ──────────────────────────────────────────────────
export const STATUSES = ["OPEN", "UPCOMING", "CLOSED", "ROLLING", "UNKNOWN"] as const;
export type Status = (typeof STATUSES)[number];

// ── Τύπος δικαιούχου ───────────────────────────────────────────────────────
export const BENEFICIARY_TYPES = [
  "EXISTING_SME",      // υφιστάμενη ΜΜΕ
  "NEW_BUSINESS",      // νέα / υπό σύσταση
  "FREELANCER",        // ελεύθερος επαγγελματίας / αυτοαπασχολούμενος
  "INDIVIDUAL",        // φυσικό πρόσωπο / νοικοκυριό
  "LARGE_ENTERPRISE",  // μεγάλη επιχείρηση
  "STARTUP",           // νεοφυής (Elevate Greece κλπ)
  "PUBLIC_BODY",       // φορέας δημοσίου
] as const;
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number];

// ── Θεματική ───────────────────────────────────────────────────────────────
export const THEMES = [
  "DIGITAL",           // ψηφιακός μετασχηματισμός
  "GREEN_ENERGY",      // πράσινη μετάβαση / εξοικονόμηση ενέργειας
  "RENOVATION",        // ανακαίνιση / αναβάθμιση κτιρίων
  "NEW_ENTREPRENEURSHIP", // ίδρυση / νέα επιχειρηματικότητα
  "EXTROVERSION",      // εξωστρέφεια / εξαγωγές
  "SKILLS",            // κατάρτιση / δεξιότητες
  "RND_INNOVATION",    // έρευνα & καινοτομία
  "LIQUIDITY",         // ρευστότητα / κεφάλαιο κίνησης
  "TOURISM",           // τουριστικές επενδύσεις
  "AGRI",              // αγροτικά / LEADER
] as const;
export type Theme = (typeof THEMES)[number];

// ── Γεωγραφία ─────────────────────────────────────────────────────────────
export const GEOGRAPHIES = [
  "NATIONAL",
  "DYTIKI_ELLADA",     // Δυτική Ελλάδα (Αιτωλοακαρνανία/Μεσολόγγι, Αχαΐα, Ηλεία)
  "OTHER_REGION",
  "RURAL_LEADER",
] as const;
export type Geography = (typeof GEOGRAPHIES)[number];

// ── Τύπος ενίσχυσης ───────────────────────────────────────────────────────
export const AID_TYPES = [
  "GRANT",        // επιχορήγηση
  "LOAN",         // δάνειο
  "GUARANTEE",    // εγγύηση
  "TAX_RELIEF",   // φοροαπαλλαγή (Αναπτυξιακός)
  "SUBSIDY_RATE", // επιδότηση επιτοκίου
  "EQUITY",       // συμμετοχή σε κεφάλαιο
] as const;
export type AidType = (typeof AID_TYPES)[number];

// ── Το record ─────────────────────────────────────────────────────────────
export interface FundingCall {
  /** σταθερό slug: `${source}:${sourceId}` */
  id: string;
  source: Source;
  /** μοναδικό id εντός πηγής (π.χ. κωδικός πρόσκλησης ή slug από URL) */
  sourceId: string;

  title: string;
  programFamily?: string; // π.χ. "Ανταγωνιστικότητα 2021-2027"
  summary?: string;

  status: Status;
  beneficiaryTypes: BeneficiaryType[];
  themes: Theme[];
  geography: Geography[];
  aidTypes: AidType[];

  eligibleKad: string[];   // ΚΑΔ ή κλάδοι (free text αν δεν δίνεται κωδικός)
  excludedKad: string[];

  budgetMin?: number;      // προϋπολογισμός έργου, €
  budgetMax?: number;
  aidIntensityPct?: number; // ένταση ενίσχυσης %
  totalFund?: number;      // συνολικός π/υ δράσης, €

  opensAt?: string;        // ISO date
  deadline?: string;       // ISO date

  officialUrl: string;
  docUrls: string[];

  /** hash του raw περιεχομένου για change-detection */
  rawHash: string;
}

/** Όσα γυρνάει ένας scraper πριν το enrichment/normalize. */
export type RawCall = Partial<FundingCall> &
  Pick<FundingCall, "source" | "sourceId" | "title" | "officialUrl">;

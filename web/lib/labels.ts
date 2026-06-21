/** Ελληνικές ετικέτες + χρώματα (Tailwind classes) για τα enums. */

export const SOURCE: Record<string, { name: string; cls: string }> = {
  antagonistikotita: { name: "Ανταγωνιστικότητα", cls: "bg-sky-100 text-sky-800 ring-sky-200" },
  greece2_0: { name: "Ταμείο Ανάκαμψης", cls: "bg-violet-100 text-violet-800 ring-violet-200" },
  anaptyxiakos: { name: "Αναπτυξιακός Νόμος", cls: "bg-amber-100 text-amber-900 ring-amber-200" },
  pde: { name: "Δυτική Ελλάδα (ΠΕΠ)", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  "espa.gr": { name: "espa.gr", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  aggregator: { name: "Σύμβουλοι", cls: "bg-stone-100 text-stone-700 ring-stone-200" },
};

export const STATUS: Record<string, { name: string; cls: string }> = {
  OPEN: { name: "Ανοιχτή", cls: "bg-emerald-600 text-white" },
  UPCOMING: { name: "Αναμενόμενη", cls: "bg-amber-500 text-white" },
  CLOSED: { name: "Έκλεισε", cls: "bg-slate-300 text-slate-700" },
  ROLLING: { name: "Συνεχής", cls: "bg-teal-600 text-white" },
  UNKNOWN: { name: "—", cls: "bg-slate-200 text-slate-600" },
};

export const THEME: Record<string, string> = {
  DIGITAL: "Ψηφιακός μετασχηματισμός",
  GREEN_ENERGY: "Πράσινη / Ενέργεια",
  RENOVATION: "Ανακαίνιση κτιρίων",
  NEW_ENTREPRENEURSHIP: "Νέα επιχειρηματικότητα",
  EXTROVERSION: "Εξωστρέφεια",
  SKILLS: "Δεξιότητες",
  RND_INNOVATION: "Έρευνα & Καινοτομία",
  LIQUIDITY: "Ρευστότητα / Δάνεια",
  TOURISM: "Τουρισμός",
  AGRI: "Αγροτικά / LEADER",
};

export const GEO: Record<string, string> = {
  NATIONAL: "Πανελλαδικό",
  DYTIKI_ELLADA: "Δυτική Ελλάδα",
  OTHER_REGION: "Άλλη περιφέρεια",
  RURAL_LEADER: "Αγροτικό / LEADER",
};

export const AID: Record<string, string> = {
  GRANT: "Επιχορήγηση",
  LOAN: "Δάνειο",
  GUARANTEE: "Εγγύηση",
  TAX_RELIEF: "Φοροαπαλλαγή",
  SUBSIDY_RATE: "Επιδότηση επιτοκίου",
  EQUITY: "Συμμετοχή κεφαλαίου",
};

export const BENEFICIARY: Record<string, string> = {
  EXISTING_SME: "Υφιστάμενη ΜΜΕ",
  NEW_BUSINESS: "Νέα / υπό σύσταση",
  FREELANCER: "Ελ. επαγγελματίας",
  INDIVIDUAL: "Φυσικό πρόσωπο",
  LARGE_ENTERPRISE: "Μεγάλη επιχείρηση",
  STARTUP: "Νεοφυής",
  PUBLIC_BODY: "Φορέας δημοσίου",
};

export const PROFILE_ICON: Record<string, string> = {
  "construction-ae": "🏗",
  realestate: "🏠",
  "software-greek-newco": "💻",
  "messolongi-individual": "📍",
};

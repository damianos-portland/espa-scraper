import type { BeneficiaryType, Geography, Theme } from "./schema.js";

/**
 * Προφίλ = μια οντότητα/στόχος που ψάχνει χρηματοδότηση.
 * Τα πρώτα 4 είναι οι δικές σας οντότητες· το matching engine βαθμολογεί
 * κάθε ανοιχτή πρόσκληση ως προς αυτά. Νέος πελάτης = νέο profile εδώ.
 */
export interface Profile {
  id: string;
  label: string;
  beneficiaryTypes: BeneficiaryType[];
  themes: Theme[];        // τι μας ενδιαφέρει
  geography: Geography[]; // πού είμαστε επιλέξιμοι
  kad?: string[];         // κλάδος/ΚΑΔ (για excluded-KAD έλεγχο)
  notes?: string;
}

export const PROFILES: Profile[] = [
  {
    id: "construction-ae",
    label: "Κατασκευαστική ΑΕ",
    beneficiaryTypes: ["EXISTING_SME", "LARGE_ENTERPRISE"],
    themes: ["DIGITAL", "GREEN_ENERGY", "RENOVATION", "LIQUIDITY", "EXTROVERSION"],
    geography: ["NATIONAL", "DYTIKI_ELLADA"],
    kad: ["κατασκευές", "τεχνικές εταιρείες"],
    notes: "Υφιστάμενη, ισχυρό προφίλ για ψηφιακό/ενεργειακό εκσυγχρονισμό & Αναπτυξιακό.",
  },
  {
    id: "realestate",
    label: "Real estate",
    beneficiaryTypes: ["EXISTING_SME"],
    themes: ["DIGITAL", "GREEN_ENERGY", "RENOVATION", "TOURISM"],
    geography: ["NATIONAL", "DYTIKI_ELLADA"],
    kad: ["real estate", "διαχείριση ακινήτων", "μεσιτικά"],
    notes: "Προσοχή: αμιγώς real-estate ΚΑΔ συχνά ΕΞΑΙΡΟΥΝΤΑΙ — έλεγχος excludedKad.",
  },
  {
    id: "software-greek-newco",
    label: "Software (νέα ελληνική οντότητα)",
    beneficiaryTypes: ["NEW_BUSINESS", "STARTUP", "FREELANCER"],
    themes: ["DIGITAL", "NEW_ENTREPRENEURSHIP", "RND_INNOVATION", "EXTROVERSION"],
    geography: ["NATIONAL", "DYTIKI_ELLADA"],
    kad: ["λογισμικό", "πληροφορική", "ICT"],
    notes: "Η US εταιρεία δεν είναι άμεσα επιλέξιμη· παιχνίδι = ίδρυση ελληνικής NewCo.",
  },
  {
    id: "messolongi-individual",
    label: "Φυσικό πρόσωπο / κάτοικος Μεσολογγίου",
    beneficiaryTypes: ["INDIVIDUAL", "FREELANCER", "NEW_BUSINESS"],
    themes: ["NEW_ENTREPRENEURSHIP", "RENOVATION", "GREEN_ENERGY", "AGRI"],
    geography: ["DYTIKI_ELLADA", "RURAL_LEADER", "NATIONAL"],
    notes: "Ξεκλειδώνει ΠΕΠ Δυτικής Ελλάδας + LEADER (λιγότερος ανταγωνισμός).",
  },
];

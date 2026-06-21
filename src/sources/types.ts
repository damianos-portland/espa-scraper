import type { Browser } from "playwright";
import type { RawCall, Source } from "../schema.js";

/**
 * Κάθε πηγή υλοποιεί αυτό το interface.
 * `browser` δίνεται μόνο σε πηγές που το χρειάζονται (π.χ. espa.gr/aspx).
 * Οι WordPress πηγές χτυπούν REST API με σκέτο fetch και το αγνοούν.
 */
export interface ScraperSource {
  key: Source;
  label: string;
  /** true αν χρειάζεται headless browser (διαφορετικά τρέχει χωρίς Playwright). */
  needsBrowser?: boolean;
  fetch(browser?: Browser): Promise<RawCall[]>;
}

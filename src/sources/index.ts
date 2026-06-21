import type { ScraperSource } from "./types.js";
import { antagonistikotita } from "./antagonistikotita.js";
import { greece2_0 } from "./greece2_0.js";
import { pde } from "./pde.js";
import { anaptyxiakos } from "./anaptyxiakos.js";

/** Μητρώο πηγών. Νέα πηγή = ένα import + μία εγγραφή εδώ. */
export const SOURCES: ScraperSource[] = [
  antagonistikotita,
  greece2_0,
  pde,
  anaptyxiakos,
  // TODO Φάση 3: espa.gr (Playwright/aspx), Εξοικονομώ, current Δ.Ελλάδας 2021-27, aggregators
];

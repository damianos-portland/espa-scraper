# espa-radar

Ενοποιημένος scraper & βάση για **ενεργά χρηματοδοτικά προγράμματα** στην Ελλάδα
(ΕΣΠΑ, Ταμείο Ανάκαμψης, Αναπτυξιακός, Περιφερειακά) με **matching engine** που
αντιστοιχίζει προσκλήσεις σε προφίλ (δικές μας οντότητες ή πελάτες).

## Γιατί
Διπλή χρήση: (1) εσωτερικά — βρίσκουμε επιδοτήσεις για κατασκευαστική / real estate /
software NewCo / κάτοικο Μεσολογγίου· (2) προϊόν/lead-gen — προωθούμε σχετικές
ευκαιρίες σε ενδιαφερόμενους.

## Αρχιτεκτονική
```
sources/*  →  normalize (tagging)  →  SQLite (Prisma)  →  match (profiles)  →  [web app Φάση 4]
```
- **`src/schema.ts`** — κανονικοποιημένο record + controlled vocabularies (τα tags = τα φίλτρα).
- **`src/sources/*`** — ένας scraper ανά πηγή· επιστρέφει `RawCall[]`.
- **`src/normalize.ts`** — heuristic tagging (themes/δικαιούχοι/γεωγραφία/τύπος ενίσχυσης) από ελληνικό κείμενο.
- **`src/extract.ts`** — εξαγωγή ημερομηνιών/ποσών/% + decode HTML entities.
- **`src/db.ts`** — Prisma upsert (arrays → JSON string στο SQLite).
- **`src/profiles.ts`** — οι 4 οντότητες· νέος πελάτης = νέο profile.
- **`src/match.ts`** — scoring ανοιχτών προσκλήσεων ανά profile.

## Πηγές
| key | Πηγή | Μέθοδος | Status |
|---|---|---|---|
| `antagonistikotita` | Ανταγωνιστικότητα 2021-27 (ΕΠΑνΕΚ) | WP REST API (`actionstatus=57`) | ✅ 9 ενεργές |
| `greece2_0` | Ταμείο Ανάκαμψης (greece20.gov.gr) | WP REST (slugs) + detail-page HTML | ✅ (RRF κλείνει 08/2026 → ελάχιστες ανοιχτές) |
| `pde` | Περιφέρεια Δυτικής Ελλάδας | static HTML `/ependyseis/actions/` | ⚠️ legacy 2014-2020· βλ. σημείωση |
| `anaptyxiakos` | Αναπτυξιακός Νόμος 4887/2022 (ΥΠΑΝ) | static HTML (regime-level) | ✅ 6 ενεργά καθεστώτα |
| `espa.gr` | espa.gr (index) | Playwright (ASP.NET aspx) | ⏳ |
| `exoikonomo` | Εξοικονομώ-Ανακαινίζω | TBD | ⏳ |
| `aggregator` | σύμβουλοι (enrichment/cross-check) | WP REST / HTML | ⏳ |

## Εντολές
```bash
# — scraper / βάση —
npm install                    # + playwright install chromium (postinstall)
npm run db:push                # δημιουργία SQLite schema
npm run scrape                 # όλες οι πηγές → βάση
npm run scrape -- --source antagonistikotita
npm run scrape -- --dry        # χωρίς εγγραφή (preview στο τερματικό)
npm run match                  # ranked προτάσεις ανά profile
npm run match -- construction-ae
npm run export                 # γράφει το snapshot web/data.json
npm run db:studio              # Prisma Studio (επιθεώρηση βάσης)

# — web app (Φάση 4) —
cd web && npm install
npm run dev                    # http://localhost:3000 (dashboard + matching)
npm run build && npm run start # production (static)
```
Ροή ανανέωσης: `npm run scrape && npm run export` (root) → το `web/` διαβάζει το νέο `data.json`.

## Web app (`web/`)
Next.js 15 + Tailwind v4, **πλήρως static** (SSG) — διαβάζει το `web/data.json` snapshot, χωρίς DB/server (free deploy σε Vercel). Tabs ανά profile με matching scores + reasons, αναζήτηση, φίλτρα (πηγή/θεματική/γεωγραφία), badges επείγοντος λήξης.

## Roadmap
- [x] Φάση 1 — recon + schema
- [x] Φάση 2 — MVP scraper (Ανταγωνιστικότητα) + DB + matching
- [ ] Φάση 3 — υπόλοιπες πηγές (greece2.0, ΠΔΕ, espa.gr, Αναπτυξιακός, Εξοικονομώ, aggregators)
- [~] Φάση 3.5 — PDF parsing για ακριβείς προθεσμίες: `src/pdf.ts` (pdf-parse) + `extractSubmissionWindow` (έναρξη/λήξη υποβολής). ✅ ενεργό στον Αναπτυξιακό (λήξη 30/06/2026 από ΦΕΚ). TODO: εφαρμογή σε greece2.0/aggregators, εξαγωγή budget/ΚΑΔ.
- [x] Φάση 4 — Next.js web app (static, `web/`): dashboard + matching ανά profile + φίλτρα. TODO deploy: Vercel + (προαιρετικά) Supabase Postgres· alerts (email/Viber) σε νέες σχετικές προσκλήσεις

## Σημειώσεις ακρίβειας / ευρήματα
- `actionstatus` (WP taxonomy, Ανταγωνιστικότητα) δίνει αξιόπιστο open/closed — δεν μαντεύουμε.
- greece2.0: το REST `calls` ΔΕΝ εκθέτει `content` → τραβάμε detail HTML από `/calls/<slug>/`. Το status βγαίνει από τη `λήξη υποβολής` (επιβεβαιωμένα σωστή εξαγωγή). Το RRF λήγει 08/2026, άρα οι περισσότερες πρόσφατες προσκλήσεις είναι ήδη κλειστές — όχι bug.
- **PDE TODO:** το `/ependyseis/` subsite είναι της περιόδου **2014-2020** (legacy κατάλογος). Οι τρέχουσες προσκλήσεις **ΠΕΠ Δυτ. Ελλάδας 2021-27** (π.χ. «Εκσυγχρονισμός Μικρής Επιχειρηματικότητας», €23M) διακινούνται μέσω εθνικού ΟΠΣ/ΠΣΚΕ → χρειάζεται ξεχωριστή πηγή (Φάση 3).
- **Αναπτυξιακός:** πηγή = `ependyseis.mindev.gov.gr/el/idiotikes/prokirikseis` (το παλιό `ependyseis.gr` είναι legacy 4399/2016). Μοντελοποίηση σε επίπεδο **καθεστώτος** (h4) — τα 4887/2022 = OPEN, τα 4399/2016 = CLOSED. Η **προθεσμία υποβολής ζει στα PDF/ΦΕΚ** (όχι στο HTML) → Φάση 3.5 PDF parsing. Τρέχων κύκλος 2026: υποβολές ~17/04–30/06/2026, €450M.
- Η εξαγωγή `deadline` παίρνει την ημερομηνία με το ισχυρότερο cue («καταληκτικ/προθεσμ/λήξη») και, σε ισοβαθμία, την πιο μελλοντική.

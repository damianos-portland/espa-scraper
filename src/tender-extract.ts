/**
 * Εξαγωγή κρίσιμων στοιχείων συμμετοχής από το κείμενο διακήρυξης δημοσίου έργου.
 * Το pdf-parse βάζει κενά μέσα σε λέξεις/αριθμούς -> δουλεύουμε spacing-tolerant.
 */

export interface TenderFacts {
  deadline?: string; // ISO ημερομηνία λήξης υποβολής προσφορών
  deadlineTime?: string; // π.χ. "10:00"
  category?: string; // κατηγορία έργου (ΟΔΟΠΟΙΙΑ, ΟΙΚΟΔΟΜΙΚΑ…)
  completion?: string; // προθεσμία εκτέλεσης (π.χ. "12 μήνες")
  guarantee?: number; // εγγύηση συμμετοχής (€) — 2% εκτιμώμενης αξίας
}

const noAcc = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Ενώνει κενά μέσα σε αριθμούς/ημερομηνίες/ώρες: «2 026»->«2026», «1 0:0 0»->«10:00». */
function despaceNumbers(t: string): string {
  return t
    .replace(/(\d)[  ]+(?=\d)/g, "$1")
    .replace(/\s*\/\s*/g, "/")
    .replace(/(\d)\s*:\s*(\d)/g, "$1:$2");
}

const ISO = (d: number, m: number, y: number) =>
  `${y < 100 ? 2000 + y : y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Καταληκτική υποβολής προσφορών: ψάχνει ημερομηνία της οποίας το γύρω κείμενο
 * αναφέρει «λήξη/καταληκτική» + «υποβολή/προσφορ», αγνοώντας γραμμές TOC (……).
 */
function extractDeadline(despaced: string): { deadline?: string; deadlineTime?: string } {
  // normalize separators .- σε / ώστε «16-07-2026»/«16.07.2026» -> «16/07/2026»
  const t = noAcc(despaced).replace(
    /(\d{1,2})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{4})/g,
    "$1/$2/$3",
  );
  const dateRe = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const cands: { iso: string; time?: string }[] = [];
  for (const m of t.matchAll(dateRe)) {
    const idx = m.index ?? 0;
    const around = t.slice(Math.max(0, idx - 190), idx + 70);
    if (/\.{4,}|…/.test(around)) continue; // TOC
    if (!/προσφορ/.test(around)) continue; // αφορά προσφορές
    if (!/(ληξ|καταληκτικ|υποβολ)/.test(around)) continue;
    if (/(εγγυη|ισχυος|περαιωσ|εκτελεσ|αποσφραγ)/.test(around)) continue; // άλλη ημερομηνία
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2025 || y > 2028) continue;
    const timeM = t.slice(idx, idx + 90).match(/ωρα[^\d]{0,8}(\d{1,2}:\d{2})/);
    cands.push({ iso: ISO(d, mo, y), time: timeM?.[1] });
  }
  if (!cands.length) return {};
  // η καταληκτική υποβολής προηγείται (αποσφράγιση/εκτέλεση είναι αργότερα)
  cands.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  return { deadline: cands[0].iso, deadlineTime: cands[0].time };
}

const CATEGORIES = [
  "ΟΔΟΠΟΙΙΑΣ", "ΟΙΚΟΔΟΜΙΚΑ", "ΥΔΡΑΥΛΙΚΑ", "ΗΛΕΚΤΡΟΜΗΧΑΝΟΛΟΓΙΚΑ", "ΛΙΜΕΝΙΚΑ",
  "ΠΡΑΣΙΝΟΥ", "ΚΑΘΑΡΙΣΜΟΥ", "ΓΕΩΤΡΗΣΕΩΝ", "ΒΙΟΜΗΧΑΝΙΚΑ ΕΝΕΡΓΕΙΑΚΑ",
];

/** Κατηγορία πτυχίου: ψάχνει «δικαίωμα συμμετοχής … κατηγορία <X>». */
function extractCategory(despaced: string): string | undefined {
  const t = noAcc(despaced);
  const i = t.search(/δικαιωμα συμμετοχης|εγγεγραμμεν[εω]/);
  const scope = i >= 0 ? t.slice(i, i + 600) : t;
  const found = CATEGORIES.filter((c) => scope.includes(noAcc(c)));
  return found.length ? found.join(", ") : undefined;
}

/** Προθεσμία εκτέλεσης: «προθεσμία … X (μήνες|ημέρες)» με πραγματική τιμή. */
function extractCompletion(despaced: string): string | undefined {
  const t = noAcc(despaced);
  for (const m of t.matchAll(/προθεσμια[^.]{0,80}?(\d{1,4})\s*(μην|ημερ)/g)) {
    const around = t.slice(m.index ?? 0, (m.index ?? 0) + 90);
    if (/\.{4,}|…/.test(around)) continue;
    const n = m[1], unit = m[2].startsWith("μην") ? "μήνες" : "ημέρες";
    return `${n} ${unit}`;
  }
  return undefined;
}

export function extractTenderFacts(pdfText: string, amount?: number | null): TenderFacts {
  const despaced = despaceNumbers(pdfText.replace(/[ \t]+/g, " "));
  const { deadline, deadlineTime } = extractDeadline(despaced);
  return {
    deadline,
    deadlineTime,
    category: extractCategory(despaced),
    completion: extractCompletion(despaced),
    guarantee: amount != null ? Math.round(amount * 0.02) : undefined, // 2% κατά Ν.4412/2016
  };
}

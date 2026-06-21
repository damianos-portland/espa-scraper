/** Βοηθητικά για εξαγωγή ποσών/ημερομηνιών/ποσοστών από ελληνικό κείμενο. */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  euro: "€", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

/** Αποκωδικοποιεί numeric (&#8211; &#x2019;) και named (&amp;) HTML entities. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

const GR_MONTHS: Record<string, number> = {
  ιανουαριου: 1, φεβρουαριου: 2, μαρτιου: 3, απριλιου: 4, μαιου: 5, ιουνιου: 6,
  ιουλιου: 7, αυγουστου: 8, σεπτεμβριου: 9, οκτωβριου: 10, νοεμβριου: 11, δεκεμβριου: 12,
};

const noAccents = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Βρίσκει την καταληκτική ημερομηνία. Προτεραιότητα σε φράσεις «έως/λήξη/μέχρι».
 * Υποστηρίζει 30/06/2026, 30-06-2026, 30.06.2026 και «30 Ιουνίου 2026».
 */
export function extractDeadline(text: string): string | undefined {
  const t = noAccents(text);

  // 1) αριθμητικές ημερομηνίες με cue λήξης στο προηγούμενο context.
  //    Ισχυρά cues (καταληκτικη/προθεσμια/ληξη) > αδύναμα (εως/μεχρι/υποβολη).
  //    Επιλέγουμε το ισχυρότερο cue και, σε ισοβαθμία, την ΤΕΛΕΥΤΑΙΑ ημερομηνία
  //    (η καταληκτική είναι σχεδόν πάντα η πιο μελλοντική, όχι κάποια ιστορική αναφορά).
  const numeric = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/g;
  const STRONG = ["καταληκτικ", "προθεσμ", "ληξη", "λημα"];
  const WEAK = ["εως", "μεχρι", "υποβολ", "ημερομηνια"];
  let best: string | undefined;
  let bestScore = 0;
  for (const m of t.matchAll(numeric)) {
    const [, d, mo, y] = m;
    const idx = m.index ?? 0;
    const ctx = t.slice(Math.max(0, idx - 45), idx);
    const score = STRONG.some((c) => ctx.includes(c)) ? 2 : WEAK.some((c) => ctx.includes(c)) ? 1 : 0;
    if (score === 0) continue;
    const date = iso(+y, +mo, +d);
    if (score > bestScore || (score === bestScore && best && date > best)) {
      bestScore = score;
      best = date;
    }
  }
  if (best) return best;

  // 2) λεκτικός μήνας: «30 Ιουνίου 2026»
  const verbal = /(\d{1,2})\s+([α-ωά-ώ]+)\s+(\d{4})/g;
  for (const m of noAccents(text).matchAll(verbal)) {
    const mon = GR_MONTHS[m[2]];
    if (mon) return iso(+m[3], mon, +m[1]);
  }
  return undefined;
}

const MONTH_ALT = Object.keys(GR_MONTHS).join("|");

/** Πρώτη ημερομηνία (αριθμητική ή λεκτική με τακτικό «η») στο segment μετά το idx. */
function firstDateAfter(t: string, idx: number, within = 150): string | undefined {
  const seg = t.slice(idx, idx + within);
  const cands: { pos: number; date: string }[] = [];
  const num = seg.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (num) cands.push({ pos: num.index ?? 0, date: iso(+num[3], +num[2], +num[1]) });
  // λεκτικό: «17η απριλιου 2026», «30 η ιουνιου 2026» (το «η» ορ. τακτικού προαιρετικό)
  const ver = seg.match(new RegExp(`(\\d{1,2})\\s*η?\\s+(${MONTH_ALT})\\s+(\\d{4})`));
  if (ver) cands.push({ pos: ver.index ?? 0, date: iso(+ver[3], GR_MONTHS[ver[2]], +ver[1]) });
  if (!cands.length) return undefined;
  cands.sort((a, b) => a.pos - b.pos);
  return cands[0].date;
}

/**
 * Παράθυρο υποβολής από κείμενο προκήρυξης (κυρίως PDF):
 * «ημερομηνία έναρξης ... υποβολής ...» -> opensAt, «ημερομηνία λήξης ...» -> deadline.
 */
export function extractSubmissionWindow(text: string): { opensAt?: string; deadline?: string } {
  const t = noAccents(text);
  const near = (cues: string[]): string | undefined => {
    for (const cue of cues) {
      let from = 0;
      for (let i = t.indexOf(cue, from); i >= 0; i = t.indexOf(cue, from)) {
        const d = firstDateAfter(t, i, 150);
        if (d) return d;
        from = i + cue.length;
      }
    }
    return undefined;
  };
  return {
    opensAt: near(["εναρξης της υποβολ", "εναρξη της υποβολ", "εναρξης υποβολ", "ημερομηνια εναρξ"]),
    deadline: near([
      "ληξης των υποβολ", "ληξης της υποβολ", "ληξη της υποβολ",
      "καταληκτικη ημερομηνια υποβολ", "καταληκτικη ημερομηνια", "ημερομηνια ληξ", "προθεσμια υποβολ",
    ]),
  };
}

/** Πρώτο ποσό σε € που ταιριάζει στο pattern (π.χ. «έως 40.000 €»). */
export function extractEuro(text: string, pattern: RegExp): number | undefined {
  const m = noAccents(text).match(pattern);
  if (!m) return undefined;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Ένταση ενίσχυσης, π.χ. «επιδότηση 50%». */
export function extractPct(text: string): number | undefined {
  const m = noAccents(text).match(/(\d{1,3})\s*%/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n > 0 && n <= 100 ? n : undefined;
}

/** Ημερομηνία ISO -> ελληνική + υπολογισμός επείγοντος. */

const MONTHS = [
  "Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν",
  "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ",
];

export function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Μέρες μέχρι τη λήξη (αρνητικό = πέρασε). null αν δεν υπάρχει deadline. */
export function daysLeft(iso?: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const due = new Date(iso + "T23:59:59");
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

export function urgency(days: number | null): { text: string; cls: string } | null {
  if (days === null) return null;
  if (days < 0) return { text: "έληξε", cls: "text-slate-400" };
  if (days === 0) return { text: "λήγει σήμερα", cls: "text-red-600 font-semibold" };
  if (days <= 14) return { text: `λήγει σε ${days} ${days === 1 ? "μέρα" : "μέρες"}`, cls: "text-red-600 font-semibold" };
  if (days <= 45) return { text: `λήγει σε ${days} μέρες`, cls: "text-amber-600 font-medium" };
  return { text: `λήγει σε ${days} μέρες`, cls: "text-slate-500" };
}

export function fmtEuro(n?: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

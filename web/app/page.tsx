"use client";

import { useMemo, useState } from "react";
import rawData from "@/data.json";
import type { Dataset, FundingCall } from "@/lib/types";
import { GEO, PROFILE_ICON, SOURCE, THEME } from "@/lib/labels";
import { daysLeft, fmtDate } from "@/lib/format";
import CallCard from "@/components/CallCard";
import TenderCard from "@/components/TenderCard";
import TenderModal from "@/components/TenderModal";
import type { Tender } from "@/lib/types";

const data = rawData as unknown as Dataset;
const TENDERS = "__tenders__";

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 transition ${
        active ? "bg-navy text-white ring-navy" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [tab, setTab] = useState<string>("all");
  const tendersMode = tab === TENDERS;
  const activeProfile = data.profiles.find((p) => p.id === tab);
  const updated = fmtDate(data.generatedAt.slice(0, 10));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-white">◎</span>
            ΕΣΠΑ <span className="text-azure">Radar</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ενεργές χρηματοδοτήσεις & δημόσιοι διαγωνισμοί, ενοποιημένα
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <Stat n={data.stats.open} label="ανοιχτές" highlight />
          <Stat n={data.stats.tenders} label="διαγωνισμοί" />
          <Stat n={data.stats.total} label="σύνολο" />
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap items-center gap-2 border-y border-slate-200 py-3">
        <ProfileTab active={tab === "all"} onClick={() => setTab("all")} icon="◎" label="Όλες οι ανοιχτές" />
        {data.profiles.map((p) => (
          <ProfileTab
            key={p.id}
            active={tab === p.id}
            onClick={() => setTab(p.id)}
            icon={PROFILE_ICON[p.id] ?? "•"}
            label={p.label}
            count={data.matches[p.id]?.length}
          />
        ))}
        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <button
          onClick={() => setTab(TENDERS)}
          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
            tendersMode ? "bg-orange-600 text-white" : "text-orange-700 ring-1 ring-orange-200 hover:bg-orange-50"
          }`}
        >
          🏗 Δημόσια Έργα
          <span className={`rounded-full px-1.5 text-[11px] ${tendersMode ? "bg-white/20" : "bg-orange-100 text-orange-700"}`}>
            {data.stats.tenders}
          </span>
        </button>
      </nav>

      {tendersMode ? (
        <TendersView />
      ) : (
        <CallsView tab={tab} activeProfile={activeProfile} updated={updated} />
      )}

      <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-[12px] text-slate-400">
        ΕΣΠΑ Radar · στατικό snapshot ({updated}) — επιβεβαίωσε προθεσμίες/επιλεξιμότητα από την επίσημη προκήρυξη/διακήρυξη.
      </footer>
    </div>
  );
}

/* ───────────────────────── Χρηματοδοτήσεις ───────────────────────── */

function CallsView({
  tab,
  activeProfile,
  updated,
}: {
  tab: string;
  activeProfile?: Dataset["profiles"][number];
  updated: string | null;
}) {
  const [q, setQ] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [themes, setThemes] = useState<Set<string>>(new Set());
  const [geos, setGeos] = useState<Set<string>>(new Set());
  const [openOnly, setOpenOnly] = useState(true);

  const byId = useMemo(() => new Map(data.calls.map((c) => [c.id, c])), []);
  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    fn(next);
  };

  const results = useMemo(() => {
    let list: { call: FundingCall; score?: number; reasons?: string[] }[];
    if (activeProfile) {
      list = data.matches[activeProfile.id].map((m) => ({ call: byId.get(m.id)!, score: m.score, reasons: m.reasons })).filter((x) => x.call);
    } else {
      list = data.calls.filter((c) => (openOnly ? c.status === "OPEN" : true)).map((call) => ({ call }));
    }
    const text = q.trim().toLowerCase();
    list = list.filter(({ call }) => {
      if (sources.size && !sources.has(call.source)) return false;
      if (themes.size && !call.themes.some((t) => themes.has(t))) return false;
      if (geos.size && !call.geography.some((g) => geos.has(g))) return false;
      if (text && !`${call.title} ${call.summary ?? ""} ${call.programFamily ?? ""}`.toLowerCase().includes(text)) return false;
      return true;
    });
    if (!activeProfile) list.sort((a, b) => (daysLeft(a.call.deadline) ?? 99999) - (daysLeft(b.call.deadline) ?? 99999));
    return list;
  }, [activeProfile, q, sources, themes, geos, openOnly, byId, tab]);

  return (
    <>
      {activeProfile?.notes ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
          <span className="font-semibold">{activeProfile.label}:</span> {activeProfile.notes}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση σε τίτλο / περίληψη / πρόγραμμα…"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none focus:border-azure focus:ring-2 focus:ring-azure/20"
          />
          {!activeProfile ? (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-navy" />
              μόνο ανοιχτές
            </label>
          ) : null}
        </div>

        <FilterRow label="Πηγή">
          {Object.keys(data.stats.bySource).map((s) => (
            <Toggle key={s} active={sources.has(s)} onClick={() => toggle(sources, s, setSources)}>{SOURCE[s]?.name ?? s}</Toggle>
          ))}
        </FilterRow>
        <FilterRow label="Θεματική">
          {Object.keys(THEME).map((t) => (
            <Toggle key={t} active={themes.has(t)} onClick={() => toggle(themes, t, setThemes)}>{THEME[t]}</Toggle>
          ))}
        </FilterRow>
        <FilterRow label="Γεωγραφία">
          {Object.keys(GEO).map((g) => (
            <Toggle key={g} active={geos.has(g)} onClick={() => toggle(geos, g, setGeos)}>{GEO[g]}</Toggle>
          ))}
        </FilterRow>
      </div>

      <ResultsHeader count={results.length} suffix={activeProfile ? ` για «${activeProfile.label}»` : ""} updated={updated} noun="πρόσκληση" nounPl="προσκλήσεις" />
      {results.length === 0 ? (
        <Empty />
      ) : (
        <Grid>
          {results.map(({ call, score, reasons }) => (
            <CallCard key={call.id} call={call} match={score != null ? { id: call.id, score, reasons: reasons ?? [] } : undefined} />
          ))}
        </Grid>
      )}
    </>
  );
}

/* ───────────────────────── Δημόσια Έργα ───────────────────────── */

const RECENCY = [
  { id: 0, label: "Όλες" },
  { id: 7, label: "7 μέρες" },
  { id: 14, label: "14 μέρες" },
  { id: 30, label: "30 μέρες" },
];

const SORTS = [
  { id: "recent", label: "Νεότερα πρώτα" },
  { id: "budget-desc", label: "Μεγαλύτερος Π/Υ" },
  { id: "budget-asc", label: "Μικρότερος Π/Υ" },
];

const parseNum = (s: string) => {
  const n = Number(s.replace(/[^\d]/g, ""));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

function TendersView() {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState("all");
  const [minB, setMinB] = useState("");
  const [maxB, setMaxB] = useState("");
  const [recency, setRecency] = useState(0);
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<Tender | null>(null);

  // διαθέσιμες κατηγορίες & περιφέρειες από τα δεδομένα
  const { allCats, allRegions } = useMemo(() => {
    const c = new Set<string>(), r = new Set<string>();
    for (const t of data.tenders) {
      t.category?.split(",").forEach((x) => c.add(x.trim()));
      if (t.region) r.add(t.region);
    }
    return { allCats: [...c].sort(), allRegions: [...r].sort() };
  }, []);

  const gen = useMemo(() => new Date(data.generatedAt).getTime(), []);
  const daysSince = (iso: string) => Math.floor((gen - new Date(iso).getTime()) / 86_400_000);

  const results = useMemo(() => {
    const text = q.trim().toLowerCase();
    const lo = parseNum(minB), hi = parseNum(maxB);
    const list = data.tenders.filter((t) => {
      if (types.size && !types.has(t.contractType)) return false;
      if (region !== "all" && t.region !== region) return false;
      if (cats.size && !(t.category ?? "").split(",").some((c) => cats.has(c.trim()))) return false;
      if (lo != null && (t.amount ?? 0) < lo) return false;
      if (hi != null && (t.amount ?? Infinity) > hi) return false;
      if (recency && daysSince(t.issueDate) > recency) return false;
      if (text && !`${t.title} ${t.org}`.toLowerCase().includes(text)) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "budget-desc") return (b.amount ?? 0) - (a.amount ?? 0);
      if (sort === "budget-asc") return (a.amount ?? Infinity) - (b.amount ?? Infinity);
      return a.issueDate < b.issueDate ? 1 : -1;
    });
    return list;
  }, [q, types, cats, region, minB, maxB, recency, sort]);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    fn(next);
  };
  const clearAll = () => {
    setQ(""); setTypes(new Set()); setCats(new Set()); setRegion("all");
    setMinB(""); setMaxB(""); setRecency(0);
  };
  const active = q || types.size || cats.size || region !== "all" || minB || maxB || recency;

  return (
    <>
      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-[13px] text-orange-900">
        <span className="font-semibold">Διαγωνισμοί δημοσίων έργων</span> — πηγή ΔΙΑΥΓΕΙΑ (Περιλήψεις Διακήρυξης), Έργα + Μελέτες έως 3M€,
        όλη η Ελλάδα, τελευταίες ~35 μέρες. Καταληκτική προσφορών: μέσα στη διακήρυξη (κλικ → λεπτομέρειες).
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση σε αντικείμενο ή φορέα (π.χ. «Αγρίνιο», «οδικό»)…"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-orange-400">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {active ? <button onClick={clearAll} className="text-[12px] font-medium text-orange-700 hover:underline">καθαρισμός</button> : null}
        </div>

        <FilterRow label="Τύπος">
          <Toggle active={types.has("Έργα")} onClick={() => toggle(types, "Έργα", setTypes)}>🏗 Έργα</Toggle>
          <Toggle active={types.has("Μελέτες")} onClick={() => toggle(types, "Μελέτες", setTypes)}>📐 Μελέτες</Toggle>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Περιφέρεια</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] text-slate-700 outline-none focus:border-orange-400">
            <option value="all">Όλες</option>
            {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </FilterRow>

        <FilterRow label="Κατηγορία">
          {allCats.map((c) => (
            <Toggle key={c} active={cats.has(c)} onClick={() => toggle(cats, c, setCats)}>{c}</Toggle>
          ))}
        </FilterRow>

        <FilterRow label="Π/Υ (€)">
          <input value={minB} onChange={(e) => setMinB(e.target.value)} placeholder="από" inputMode="numeric"
            className="w-24 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] outline-none focus:border-orange-400" />
          <span className="text-slate-400">–</span>
          <input value={maxB} onChange={(e) => setMaxB(e.target.value)} placeholder="έως" inputMode="numeric"
            className="w-24 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] outline-none focus:border-orange-400" />
        </FilterRow>

        <FilterRow label="Ανάρτηση">
          {RECENCY.map((r) => (
            <Toggle key={r.id} active={recency === r.id} onClick={() => setRecency(r.id)}>{r.label}</Toggle>
          ))}
        </FilterRow>
      </div>

      <ResultsHeader count={results.length} suffix="" updated={null} noun="διαγωνισμός" nounPl="διαγωνισμοί" />
      {results.length === 0 ? (
        <Empty />
      ) : (
        <Grid>
          {results.map((t) => (
            <TenderCard key={t.id} t={t} onOpen={() => setSelected(t)} />
          ))}
        </Grid>
      )}

      {selected ? <TenderModal tender={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

/* ───────────────────────── shared UI ───────────────────────── */

function Stat({ n, label, highlight }: { n: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-1.5 ${highlight ? "bg-navy text-white" : "bg-white ring-1 ring-slate-200"}`}>
      <div className="text-lg font-bold leading-none tabular-nums">{n}</div>
      <div className={`text-[11px] ${highlight ? "text-white/70" : "text-slate-400"}`}>{label}</div>
    </div>
  );
}

function ProfileTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: string; label: string; count?: number }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${active ? "bg-ink text-white" : "text-slate-600 hover:bg-white"}`}>
      <span>{icon}</span>
      {label}
      {count != null ? <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>{count}</span> : null}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function ResultsHeader({ count, suffix, updated, noun, nounPl }: { count: number; suffix: string; updated: string | null; noun: string; nounPl: string }) {
  return (
    <div className="mt-6 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-slate-500">{count} {count === 1 ? noun : nounPl}{suffix}</h2>
      {updated ? <span className="text-[12px] text-slate-400">ενημερώθηκε {updated}</span> : null}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Empty() {
  return <div className="mt-10 rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-400">Κανένα αποτέλεσμα με αυτά τα φίλτρα.</div>;
}

"use client";

import { useMemo, useState } from "react";
import rawData from "@/data.json";
import type { Dataset, FundingCall } from "@/lib/types";
import { GEO, PROFILE_ICON, SOURCE, THEME } from "@/lib/labels";
import { daysLeft, fmtDate } from "@/lib/format";
import CallCard from "@/components/CallCard";

const data = rawData as unknown as Dataset;

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 transition ${
        active
          ? "bg-navy text-white ring-navy"
          : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [profileId, setProfileId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [themes, setThemes] = useState<Set<string>>(new Set());
  const [geos, setGeos] = useState<Set<string>>(new Set());
  const [openOnly, setOpenOnly] = useState(true);

  const byId = useMemo(() => new Map(data.calls.map((c) => [c.id, c])), []);
  const activeProfile = data.profiles.find((p) => p.id === profileId);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    fn(next);
  };

  const results = useMemo(() => {
    let list: { call: FundingCall; score?: number; reasons?: string[] }[];

    if (activeProfile) {
      list = data.matches[activeProfile.id]
        .map((m) => ({ call: byId.get(m.id)!, score: m.score, reasons: m.reasons }))
        .filter((x) => x.call);
    } else {
      list = data.calls
        .filter((c) => (openOnly ? c.status === "OPEN" : true))
        .map((call) => ({ call }));
    }

    const text = q.trim().toLowerCase();
    list = list.filter(({ call }) => {
      if (sources.size && !sources.has(call.source)) return false;
      if (themes.size && !call.themes.some((t) => themes.has(t))) return false;
      if (geos.size && !call.geography.some((g) => geos.has(g))) return false;
      if (text) {
        const hay = `${call.title} ${call.summary ?? ""} ${call.programFamily ?? ""}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });

    if (!activeProfile) {
      list.sort((a, b) => {
        const da = daysLeft(a.call.deadline) ?? 99999;
        const db = daysLeft(b.call.deadline) ?? 99999;
        return da - db;
      });
    }
    return list;
  }, [activeProfile, q, sources, themes, geos, openOnly, byId]);

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
            Ενεργές χρηματοδοτήσεις, ενοποιημένες — ΕΣΠΑ · Ταμείο Ανάκαμψης · Αναπτυξιακός · Περιφερειακά
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <Stat n={data.stats.open} label="ανοιχτές" highlight />
          <Stat n={data.stats.total} label="σύνολο" />
          <Stat n={Object.keys(data.stats.bySource).length} label="πηγές" />
        </div>
      </header>

      {/* Profile tabs */}
      <nav className="flex flex-wrap gap-2 border-y border-slate-200 py-3">
        <ProfileTab active={profileId === "all"} onClick={() => setProfileId("all")} icon="◎" label="Όλες οι ανοιχτές" />
        {data.profiles.map((p) => (
          <ProfileTab
            key={p.id}
            active={profileId === p.id}
            onClick={() => setProfileId(p.id)}
            icon={PROFILE_ICON[p.id] ?? "•"}
            label={p.label}
            count={data.matches[p.id]?.length}
          />
        ))}
      </nav>

      {activeProfile?.notes ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
          <span className="font-semibold">{activeProfile.label}:</span> {activeProfile.notes}
        </div>
      ) : null}

      {/* Controls */}
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
          {(sources.size || themes.size || geos.size || q) ? (
            <button
              onClick={() => { setSources(new Set()); setThemes(new Set()); setGeos(new Set()); setQ(""); }}
              className="text-[12px] font-medium text-azure hover:underline"
            >
              καθαρισμός φίλτρων
            </button>
          ) : null}
        </div>

        <FilterRow label="Πηγή">
          {Object.keys(data.stats.bySource).map((s) => (
            <Toggle key={s} active={sources.has(s)} onClick={() => toggle(sources, s, setSources)}>
              {SOURCE[s]?.name ?? s}
            </Toggle>
          ))}
        </FilterRow>
        <FilterRow label="Θεματική">
          {Object.keys(THEME).map((t) => (
            <Toggle key={t} active={themes.has(t)} onClick={() => toggle(themes, t, setThemes)}>
              {THEME[t]}
            </Toggle>
          ))}
        </FilterRow>
        <FilterRow label="Γεωγραφία">
          {Object.keys(GEO).map((g) => (
            <Toggle key={g} active={geos.has(g)} onClick={() => toggle(geos, g, setGeos)}>
              {GEO[g]}
            </Toggle>
          ))}
        </FilterRow>
      </div>

      {/* Results */}
      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-500">
          {results.length} {results.length === 1 ? "πρόσκληση" : "προσκλήσεις"}
          {activeProfile ? ` για «${activeProfile.label}»` : ""}
        </h2>
        <span className="text-[12px] text-slate-400">ενημερώθηκε {updated}</span>
      </div>

      {results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-400">
          Καμία πρόσκληση με αυτά τα φίλτρα.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ call, score, reasons }) => (
            <CallCard key={call.id} call={call} match={score != null ? { id: call.id, score, reasons: reasons ?? [] } : undefined} />
          ))}
        </div>
      )}

      <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-[12px] text-slate-400">
        ΕΣΠΑ Radar · στατικό snapshot — επιβεβαίωσε προθεσμίες/επιλεξιμότητα από την επίσημη προκήρυξη.
      </footer>
    </div>
  );
}

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
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-ink text-white" : "text-slate-600 hover:bg-white"
      }`}
    >
      <span>{icon}</span>
      {label}
      {count != null ? (
        <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>{count}</span>
      ) : null}
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

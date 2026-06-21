import type { FundingCall, Match } from "@/lib/types";
import { AID, GEO, SOURCE, STATUS, THEME } from "@/lib/labels";
import { daysLeft, fmtDate, fmtEuro, urgency } from "@/lib/format";

function Chip({ children, cls = "" }: { children: React.ReactNode; cls?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default function CallCard({ call, match }: { call: FundingCall; match?: Match }) {
  const src = SOURCE[call.source] ?? { name: call.source, cls: "bg-slate-100 text-slate-700 ring-slate-200" };
  const st = STATUS[call.status] ?? STATUS.UNKNOWN;
  const u = urgency(daysLeft(call.deadline));
  const budget =
    fmtEuro(call.budgetMin) && fmtEuro(call.budgetMax)
      ? `${fmtEuro(call.budgetMin)} – ${fmtEuro(call.budgetMax)}`
      : fmtEuro(call.budgetMax) ?? fmtEuro(call.budgetMin);

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Chip cls={`${src.cls} ring-1`}>{src.name}</Chip>
        <Chip cls={st.cls}>{st.name}</Chip>
        {call.aidIntensityPct ? (
          <Chip cls="bg-gold/15 text-amber-800 ring-1 ring-amber-200">{call.aidIntensityPct}% ένταση</Chip>
        ) : null}
        {match ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
            ★ {match.score}
          </span>
        ) : null}
      </div>

      <a
        href={call.officialUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[15px] font-semibold leading-snug text-ink decoration-azure/40 underline-offset-2 group-hover:underline line-clamp-3"
      >
        {call.title}
      </a>

      {call.summary ? <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 line-clamp-2">{call.summary}</p> : null}

      {match?.reasons?.length ? (
        <p className="mt-2 text-[12px] font-medium text-azure">→ {match.reasons.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {call.themes.map((t) => (
          <Chip key={t} cls="bg-sky-50 text-sky-700 ring-1 ring-sky-100">{THEME[t] ?? t}</Chip>
        ))}
        {call.aidTypes.map((a) => (
          <Chip key={a} cls="bg-stone-100 text-stone-600">{AID[a] ?? a}</Chip>
        ))}
        {call.geography.map((g) => (
          <Chip key={g} cls="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{GEO[g] ?? g}</Chip>
        ))}
      </div>

      <div className="mt-auto flex items-end justify-between pt-3 text-[12px] text-slate-500">
        <div className="min-w-0">
          {call.programFamily ? <div className="truncate">{call.programFamily}</div> : null}
          {budget ? <div className="font-medium text-slate-700">{budget}</div> : null}
        </div>
        <div className="shrink-0 text-right">
          {fmtDate(call.deadline) ? (
            <>
              <div className="tabular-nums">λήξη {fmtDate(call.deadline)}</div>
              {u ? <div className={u.cls}>{u.text}</div> : null}
            </>
          ) : (
            <span className="italic text-slate-400">δες προκήρυξη</span>
          )}
        </div>
      </div>
    </article>
  );
}

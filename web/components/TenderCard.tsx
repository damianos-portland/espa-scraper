import type { Tender } from "@/lib/types";
import { fmtDate, fmtEuro } from "@/lib/format";

export default function TenderCard({ t }: { t: Tender }) {
  const isWork = t.contractType === "Έργα";
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isWork ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200" : "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200"
          }`}
        >
          {isWork ? "🏗 Έργο" : "📐 Μελέτη"}
        </span>
        {t.procedure ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {t.procedure} διαγωνισμός
          </span>
        ) : null}
        {t.amount != null ? (
          <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
            {fmtEuro(t.amount)}
          </span>
        ) : null}
      </div>

      <a
        href={t.documentUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[14px] font-semibold leading-snug text-ink underline-offset-2 hover:underline line-clamp-3"
      >
        {t.title}
      </a>

      <div className="mt-2 text-[12px] font-medium text-slate-600 line-clamp-1">{t.org}</div>

      {t.cpv.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {t.cpv.slice(0, 3).map((c) => (
            <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 tabular-nums">
              CPV {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-end justify-between pt-3 text-[12px] text-slate-500">
        <div>
          {t.criterion ? <div className="text-slate-500">{t.criterion}</div> : null}
          <div className="tabular-nums">αναρτήθηκε {fmtDate(t.issueDate)}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <a href={t.documentUrl} target="_blank" rel="noreferrer" className="font-medium text-azure hover:underline">
            διακήρυξη →
          </a>
          <a href={t.decisionUrl} target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:underline">
            ΑΔΑ {t.id}
          </a>
        </div>
      </div>
    </article>
  );
}

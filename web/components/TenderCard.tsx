import type { Tender } from "@/lib/types";
import { fmtDate, fmtEuro } from "@/lib/format";

export default function TenderCard({ t, onOpen }: { t: Tender; onOpen: () => void }) {
  const isWork = t.contractType === "Έργα";
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="mb-2 flex w-full flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isWork ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200" : "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200"}`}>
          {isWork ? "🏗 Έργο" : "📐 Μελέτη"}
        </span>
        {t.category ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{t.category}</span>
        ) : null}
        {t.amount != null ? (
          <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">{fmtEuro(t.amount)}</span>
        ) : null}
      </div>

      <div className="text-[14px] font-semibold leading-snug text-ink group-hover:text-azure line-clamp-3">{t.title}</div>
      <div className="mt-2 text-[12px] font-medium text-slate-600 line-clamp-1">{t.org}</div>
      {t.region && t.region !== "Πανελλαδικό" ? (
        <div className="mt-1 text-[11px] text-slate-400">📍 {t.region}</div>
      ) : null}

      <div className="mt-auto flex w-full items-end justify-between pt-3 text-[12px] text-slate-500">
        <div>
          {t.guarantee != null ? <div className="tabular-nums">εγγύηση ≈ {fmtEuro(t.guarantee)}</div> : null}
          <div className="tabular-nums">αναρτήθηκε {fmtDate(t.issueDate)}</div>
        </div>
        <span className="shrink-0 font-medium text-azure group-hover:underline">λεπτομέρειες →</span>
      </div>
    </button>
  );
}

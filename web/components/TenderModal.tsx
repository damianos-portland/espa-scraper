"use client";

import { useEffect } from "react";
import type { Tender } from "@/lib/types";
import { fmtDate, fmtEuro } from "@/lib/format";

function Fact({ label, value, strong }: { label: string; value?: React.ReactNode; strong?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 ${strong ? "text-base font-bold text-ink" : "text-[13px] text-slate-700"} tabular-nums`}>{value}</div>
    </div>
  );
}

export default function TenderModal({ tender: t, onClose }: { tender: Tender; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isWork = t.contractType === "Έργα";
  const promitheus = `https://nepps-search.eprocurement.gov.gr/actSearch/faces/active_search_main.jspx`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 flex items-start gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isWork ? "bg-orange-100 text-orange-800" : "bg-indigo-100 text-indigo-800"}`}>
            {isWork ? "🏗 Έργο" : "📐 Μελέτη"}
          </span>
          <h2 className="flex-1 text-[15px] font-bold leading-snug text-ink">{t.title}</h2>
          <button onClick={onClose} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Κλείσιμο">
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="text-[13px] font-semibold text-slate-700">{t.org}</div>

          {/* κρίσιμα στοιχεία συμμετοχής */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Προϋπολογισμός" value={fmtEuro(t.amount)} strong />
            <Fact label="Εγγύηση συμμ. (2%)" value={t.guarantee != null ? `≈ ${fmtEuro(t.guarantee)}` : undefined} strong />
            <Fact label="Κατηγορία πτυχίου" value={t.category} strong />
            <Fact label="Κριτήριο ανάθεσης" value={t.criterion} />
            <Fact label="Διαδικασία" value={t.procedure ? `${t.procedure} διαγωνισμός` : undefined} />
            <Fact label="Αναρτήθηκε" value={fmtDate(t.issueDate)} />
            <Fact label="CPV" value={t.cpv.length ? t.cpv.join(", ") : undefined} />
            <Fact label="Τύπος" value={t.contractType} />
            <Fact label="ΑΔΑ" value={t.id} />
          </div>

          {/* καταληκτική — δεν είναι στα δομημένα δεδομένα */}
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            ⏱ <span className="font-semibold">Καταληκτική υποβολής προσφορών</span> & πλήρεις όροι (δικαιολογητικά, ΕΣΗΔΗΣ Α/Α,
            προθεσμία εκτέλεσης): αναγράφονται στη διακήρυξη — άνοιξέ την παρακάτω.
          </div>

          {/* actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={t.documentUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-navy px-4 py-2 text-[13px] font-semibold text-white hover:bg-ink">
              📄 Άνοιγμα διακήρυξης
            </a>
            <a href={t.decisionUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300">
              ΔΙΑΥΓΕΙΑ ↗
            </a>
            <a href={promitheus} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300">
              Αναζήτηση ΕΣΗΔΗΣ ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

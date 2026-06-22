"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as xlsx from "xlsx";
import { ANATH, resolve } from "@/lib/anatheorisi";
import { type BudgetRow, calcBudget, dapani, eur, myCost, pct, sectionOf } from "@/lib/budget";
import { parseExtractedJson, parseFatherXlsx } from "@/lib/budget-import";
import { BENCHMARKS, dominantCategory, evaluate } from "@/lib/evaluator";

const KEY = "espa-radar-budget-v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const mk = (o: Partial<BudgetRow>): BudgetRow => ({
  id: uid(), desc: "", articleCode: "", revCode: "", unit: "", qty: 0, price: 0,
  group: "ΛΟΙΠΑ", section: "ΟΙΚ", costMat: 0, costLab: 0, ...o,
});

const SAMPLE: BudgetRow[] = [
  mk({ desc: "Γενικές εκσκαφές σε έδαφος γαιώδες", articleCode: "ΝΑΟΙΚ 20.02", revCode: "ΟΙΚ 2112", unit: "m3", qty: 4500, price: 5.65, group: "ΧΩΜΑΤΟΥΡΓΙΚΑ", costMat: 8000, costLab: 14000 }),
  mk({ desc: "Ικριώματα ειδικά", articleCode: "ΝΑΟΙΚ 23.01", revCode: "ΟΙΚ 2301", unit: "m3", qty: 100, price: 5, group: "ΙΚΡΙΩΜΑΤΑ", costMat: 200, costLab: 220 }),
  mk({ desc: "Ξυλότυποι συνήθων χυτών κατασκευών", articleCode: "ΝΑΟΙΚ 38.03", revCode: "ΟΙΚ 3816", unit: "m2", qty: 950, price: 14, group: "ΣΚΥΡΟΔΕΜΑΤΑ", costMat: 5500, costLab: 6500 }),
  mk({ desc: "Σκυρόδεμα κατηγορίας C12/15", articleCode: "ΝΑΟΙΚ 32.01.03", revCode: "ΟΙΚ 3213", unit: "m3", qty: 140, price: 75, group: "ΣΚΥΡΟΔΕΜΑΤΑ", costMat: 7000, costLab: 2500 }),
];

export default function BudgetBuilder() {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [quarter, setQuarter] = useState(ANATH.defaultQuarter);
  const [costFactor, setCostFactor] = useState(0.7); // εκτιμώμενο κόστος ως % μελέτης
  const [official, setOfficial] = useState<{ extractedTotal: number; worksTotal: number | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.rows) { setRows(s.rows); setDiscounts(s.discounts ?? {}); setQuarter(s.quarter ?? ANATH.defaultQuarter); if (s.costFactor != null) setCostFactor(s.costFactor); setOfficial(s.official ?? null); }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ rows, discounts, quarter, costFactor, official }));
  }, [rows, discounts, quarter, costFactor, official, loaded]);

  const calc = useMemo(() => calcBudget(rows, discounts, costFactor), [rows, discounts, costFactor]);
  const evalResult = useMemo(() => evaluate(rows, calc), [rows, calc]);

  // γρήγορη εφαρμογή τυπικής έκπτωσης αγοράς ανά ομάδα (κυρίαρχη κατηγορία)
  const applyMarketDiscount = () => {
    const cat = dominantCategory(rows);
    const [lo, hi] = BENCHMARKS[cat] ?? [0.3, 0.45];
    const mid = (lo + hi) / 2;
    const next: Record<string, number> = {};
    for (const g of calc.groups) next[g.group] = mid;
    setDiscounts(next);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const update = (id: string, patch: Partial<BudgetRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, mk({ group: rs.at(-1)?.group ?? "ΝΕΑ ΟΜΑΔΑ" })]);
  const del = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  async function importFile(file: File) {
    try {
      const imported = file.name.toLowerCase().endsWith(".json")
        ? parseExtractedJson(await file.text())
        : parseFatherXlsx(xlsx.read(await file.arrayBuffer()));
      if (!imported.length) return alert("Δεν βρέθηκαν άρθρα στο αρχείο.");
      setRows(imported);
      setDiscounts({});
    } catch (e) {
      alert("Σφάλμα ανάγνωσης αρχείου: " + (e as Error).message);
    }
  }

  function itemsSheet(secRows: BudgetRow[]) {
    const head = ["Α/Α", "Είδος εργασίας", "Κωδ. Άρθρου", "Κωδ. Αναθ/σης", "Ομοειδές", `Συντ. ${quarter}`, "Μονάδα", "Ποσότητα", "Τιμή", "Δαπάνη", "Υλικά", "Εργατικά", "Κόστος", "Ομάδα"];
    const body = secRows.map((r, i) => {
      const res = resolve(r.revCode, quarter, r.omoeides);
      const coeff = res.status === "missing" ? "" : res.coeff ?? "";
      const via = res.status === "omoeides" ? res.via : "";
      return [i + 1, r.desc, r.articleCode, r.revCode, via, coeff, r.unit, r.qty, r.price, dapani(r), r.costMat, r.costLab, myCost(r), r.group];
    });
    return xlsx.utils.aoa_to_sheet([head, ...body]);
  }

  function exportXlsx() {
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, itemsSheet(rows.filter((r) => r.section === "ΟΙΚ")), "ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΟΙΚΟΔΟΜΙΚΩΝ");
    xlsx.utils.book_append_sheet(wb, itemsSheet(rows.filter((r) => r.section === "ΗΜ")), "ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΗΜ");

    const sg = [["Α/Α", "Ομάδα", "Μελέτη", "Έκπτωση", "Προσφορά"]];
    calc.groups.forEach((g, i) => sg.push([String(i + 1), g.group, g.meleti.toFixed(2), pct(g.discount), g.prosfora.toFixed(2)]));
    sg.push([], ["", "ΣΥΝΟΛΟ ΕΡΓΑΣΙΩΝ", calc.meletiTotal.toFixed(2), "", calc.prosforaTotal.toFixed(2)]);
    sg.push(["", "Γ.Ε. & Ο.Ε. 18%", "", "", calc.geoe.toFixed(2)]);
    sg.push(["", "ΑΠΡΟΒΛΕΠΤΑ 15%", "", "", calc.aprovlepta.toFixed(2)]);
    sg.push(["", "ΓΕΝΙΚΟ ΣΥΝΟΛΟ", "", "", calc.grandTotal.toFixed(2)]);
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sg), "ΣΥΓΚΕΝΤΡΩΤΙΚΑ");

    const om = [["Ομάδα", "Έκπτωση", "Αποδεκτή;"]];
    calc.groups.forEach((g) => om.push([g.group, pct(g.discount), g.acceptable ? "ΑΠΟΔΕΚΤΗ" : "ΜΗ ΑΠΟΔΕΚΤΗ"]));
    om.push([], ["Μέση έκπτωση Εμ", pct(calc.Em), ""], ["Κάτω όριο (1,10·Εμ−10%)", pct(calc.lower), ""], ["Άνω όριο (0,90·Εμ+10%)", pct(calc.upper), ""]);
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(om), "ΟΜΑΛΟΤΗΤΑ");

    xlsx.writeFile(wb, "Προϋπολογισμός_Προσφοράς.xlsx");
  }

  if (!loaded) return null;

  return (
    <div className="mt-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-[13px] text-sky-900">
        <span className="font-semibold">Προϋπολογισμός προσφοράς</span> — γράψε τα άρθρα· ο <b>συντελεστής αναθεώρησης</b> συμπληρώνεται
        αυτόματα από τον κωδικό (επίσημο αρχείο {ANATH.count} κωδικών). Τα δεδομένα αποθηκεύονται τοπικά στον browser.
      </div>

      {official?.worksTotal ? (() => {
        const pct = (calc.meletiTotal / official.worksTotal!) * 100;
        const ok = pct >= 98 && pct <= 102, partial = pct >= 80;
        const cls = ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : partial ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-900";
        return (
          <div className={`mt-3 rounded-xl border px-4 py-2.5 text-[13px] ${cls}`}>
            {ok ? "✓" : "⚠"} <b>Επικύρωση εξαγωγής:</b> εξήχθη {eur(calc.meletiTotal)} · επίσημο σύνολο δαπανών {eur(official.worksTotal!)} → <b>{pct.toFixed(1)}%</b>
            {ok ? " — πλήρης ✓" : partial ? " — μερική, επιβεβαίωσε τα ελλιπή άρθρα" : " — ελλιπής εξαγωγή, χρησιμοποίησε Import xls / επαλήθευσε"}
          </div>
        );
      })() : null}

      {/* toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={addRow} className="rounded-xl bg-navy px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-ink">+ Άρθρο</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300" title="xls του πατέρα ή JSON από npm run extract-budget">⬆ Import (xls / ΕΣΗΔΗΣ)</button>
        <button onClick={() => { setRows(SAMPLE.map((r) => ({ ...r, id: uid() }))); setDiscounts({}); }} className="rounded-xl bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300">Φόρτωση παραδείγματος</button>
        <button onClick={exportXlsx} disabled={!rows.length} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">⬇ Export Excel</button>
        {rows.length ? <button onClick={() => { setRows([]); setDiscounts({}); }} className="text-[12px] font-medium text-rose-600 hover:underline">καθαρισμός</button> : null}
        <label className="ml-auto flex items-center gap-2 text-[12px] text-slate-600">
          Τρίμηνο αναθεώρησης
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px]">
            {ANATH.quarters.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </label>
      </div>

      {/* items table */}
      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 py-14 text-center text-slate-400">
          Κανένα άρθρο. Πάτησε «+ Άρθρο» ή «Φόρτωση παραδείγματος».
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1240px] text-[12px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {["Είδος εργασίας", "Κωδ. Άρθρου", "Κωδ. Αναθ.", "Αναθεώρηση", "Μον.", "Ποσότ.", "Τιμή", "Δαπάνη", "Υλικά €", "Εργατικά €", "Ομάδα", ""].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => <Row key={r.id} r={r} quarter={quarter} onChange={(p) => update(r.id, p)} onDelete={() => del(r.id)} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* summary + ομαλότητα */}
      {calc.groups.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">Ομάδες & Εκπτώσεις</h3>
            <table className="w-full text-[12px]">
              <thead className="text-[11px] uppercase text-slate-400">
                <tr><th className="text-left">Ομάδα</th><th className="text-right">Μελέτη</th><th className="text-right">Έκπτωση %</th><th className="text-right">Προσφορά</th><th className="text-center">Ομαλ.</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calc.groups.map((g) => (
                  <tr key={g.group}>
                    <td className="py-1 font-medium">{g.group}</td>
                    <td className="text-right tabular-nums">{eur(g.meleti)}</td>
                    <td className="text-right">
                      <input type="number" step="1" value={Math.round((discounts[g.group] ?? 0) * 1000) / 10}
                        onChange={(e) => setDiscounts((d) => ({ ...d, [g.group]: (parseFloat(e.target.value) || 0) / 100 }))}
                        className="w-16 rounded border border-slate-200 px-1 py-0.5 text-right tabular-nums" />
                    </td>
                    <td className="text-right tabular-nums">{eur(g.prosfora)}</td>
                    <td className="text-center">{g.acceptable ? <span className="text-emerald-600">✓</span> : <span className="text-rose-600 font-bold">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${calc.allAcceptable ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              <b>Έλεγχος ομαλότητας:</b> Μέση έκπτωση Εμ = {pct(calc.Em)} · αποδεκτό εύρος ανά ομάδα [{pct(calc.lower)} … {pct(calc.upper)}]
              {calc.allAcceptable ? " — όλες ΑΠΟΔΕΚΤΕΣ ✓" : " — υπάρχει ΜΗ ΑΠΟΔΕΚΤΗ ομάδα ✗"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">Σύνολα προσφοράς</h3>
            <dl className="space-y-1.5 text-[13px]">
              <Line label="Σύνολο εργασιών (μελέτη)" value={eur(calc.meletiTotal)} muted />
              <Line label="Σύνολο εργασιών (προσφορά)" value={eur(calc.prosforaTotal)} strong />
              <Line label="Γ.Ε. & Ο.Ε. 18%" value={eur(calc.geoe)} />
              <Line label="Μερικό σύνολο" value={eur(calc.subTotal)} />
              <Line label="Απρόβλεπτα 15%" value={eur(calc.aprovlepta)} />
              <div className="my-1 border-t border-slate-200" />
              <Line label="ΓΕΝΙΚΟ ΣΥΝΟΛΟ" value={eur(calc.grandTotal)} strong big />
            </dl>
          </div>
        </div>
      )}

      {/* evaluator scorecard */}
      {calc.groups.length > 0 && (
        <Evaluator e={evalResult} costFactor={costFactor} setCostFactor={setCostFactor} onApplyMarket={applyMarketDiscount} manualCost={calc.matTotal + calc.labTotal > 0} />
      )}
    </div>
  );
}

const VERDICT_STYLE: Record<string, { cls: string; icon: string }> = {
  ΑΞΙΖΕΙ: { cls: "bg-emerald-600", icon: "🟢" },
  ΟΡΙΑΚΟ: { cls: "bg-amber-500", icon: "🟡" },
  ΟΧΙ: { cls: "bg-rose-600", icon: "🔴" },
  ΑΝΕΠΑΡΚΗ: { cls: "bg-slate-400", icon: "⚪" },
};

function Evaluator({ e, costFactor, setCostFactor, onApplyMarket, manualCost }: { e: ReturnType<typeof evaluate>; costFactor: number; setCostFactor: (n: number) => void; onApplyMarket: () => void; manualCost: boolean }) {
  const v = VERDICT_STYLE[e.verdict];
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white ${v.cls}`}>
          {v.icon} {e.verdict}
        </span>
        <h3 className="text-sm font-bold text-ink">Αξιολόγηση προσφοράς</h3>
        <span className="text-[12px] text-slate-500">κυρίαρχη κατηγορία: <b>{e.category}</b></span>
      </div>

      {/* auto-fill controls: κόστος ως % μελέτης + τυπική έκπτωση αγοράς */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-[12px] ring-1 ring-slate-100">
        <label className="flex items-center gap-2">
          <span className="text-slate-500">Εκτιμώμενο κόστος εκτέλεσης:</span>
          <input type="range" min={40} max={95} value={Math.round(costFactor * 100)} onChange={(ev) => setCostFactor(Number(ev.target.value) / 100)} className="accent-sky-700" />
          <b className="tabular-nums text-ink">{Math.round(costFactor * 100)}%</b>
          <span className="text-slate-400">της μελέτης</span>
        </label>
        {manualCost ? <span className="text-emerald-600">✓ χρησιμοποιεί χειροκίνητο κόστος όπου δόθηκε</span> : null}
        <button onClick={onApplyMarket} className="ml-auto rounded-lg bg-white px-2.5 py-1 font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50">
          Εφαρμογή τυπικής έκπτωσης αγοράς
        </button>
      </div>

      {e.verdict === "ΑΝΕΠΑΡΚΗ" ? (
        <p className="mt-3 text-[13px] text-slate-500">{e.reasons[0]}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
            <Metric label="Η έκπτωσή σας (Εμ)" value={pct(e.yourDiscount)} />
            <Metric label="Τυπική αγοράς" value={pct(e.expectedDiscount)} sub={e.gap >= 0 ? "ανταγωνιστικό ✓" : `${(e.gap * 100).toFixed(0)} μον.`} subCls={e.gap >= -0.03 ? "text-emerald-600" : "text-rose-600"} />
            <Metric label="Έσοδα / Κόστος" value={`${eur(e.revenue)}`} sub={`κόστος ${eur(e.cost)}`} />
            <Metric label="Περιθώριο" value={pct(e.marginPct)} sub={`${e.margin >= 0 ? "+" : ""}${eur(e.margin)}`} subCls={e.marginPct >= 0.08 ? "text-emerald-600" : e.marginPct >= 0 ? "text-amber-600" : "text-rose-600"} />
          </div>
          <ul className="mt-3 space-y-1 text-[12px] text-slate-600">
            {e.reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub, subCls = "text-slate-400" }: { label: string; value: string; sub?: string; subCls?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink tabular-nums">{value}</div>
      {sub ? <div className={`text-[11px] tabular-nums ${subCls}`}>{sub}</div> : null}
    </div>
  );
}

function Row({ r, quarter, onChange, onDelete }: { r: BudgetRow; quarter: string; onChange: (p: Partial<BudgetRow>) => void; onDelete: () => void }) {
  const res = resolve(r.revCode, quarter, r.omoeides);
  const inp = "w-full bg-transparent px-1 py-1 outline-none focus:bg-sky-50";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="w-[380px] min-w-[380px] align-top"><textarea rows={2} className={`${inp} resize-y leading-snug`} value={r.desc} onChange={(e) => onChange({ desc: e.target.value })} placeholder="περιγραφή" title={r.desc} /></td>
      <td><input className={`${inp} font-mono`} value={r.articleCode} onChange={(e) => onChange({ articleCode: e.target.value })} placeholder="ΝΑΟΙΚ…" /></td>
      <td><input className={`${inp} font-mono w-24`} value={r.revCode} onChange={(e) => onChange({ revCode: e.target.value })} placeholder="ΟΙΚ…" /></td>
      <td className="min-w-[150px]"><AnathBadge res={res} onPick={(c) => onChange({ omoeides: c })} /></td>
      <td><input className={`${inp} w-12`} value={r.unit} onChange={(e) => onChange({ unit: e.target.value })} /></td>
      <td><input type="number" className={`${inp} w-20 text-right tabular-nums`} value={r.qty || ""} onChange={(e) => onChange({ qty: parseFloat(e.target.value) || 0 })} /></td>
      <td><input type="number" className={`${inp} w-20 text-right tabular-nums`} value={r.price || ""} onChange={(e) => onChange({ price: parseFloat(e.target.value) || 0 })} /></td>
      <td className="px-2 text-right tabular-nums font-medium">{eur(dapani(r))}</td>
      <td><input type="number" className={`${inp} w-20 text-right tabular-nums`} value={r.costMat || ""} onChange={(e) => onChange({ costMat: parseFloat(e.target.value) || 0 })} placeholder="0" /></td>
      <td><input type="number" className={`${inp} w-20 text-right tabular-nums`} value={r.costLab || ""} onChange={(e) => onChange({ costLab: parseFloat(e.target.value) || 0 })} placeholder="0" /></td>
      <td><input className={`${inp} w-32`} value={r.group} onChange={(e) => onChange({ group: e.target.value })} /></td>
      <td><button onClick={onDelete} className="px-1 text-slate-300 hover:text-rose-500">✕</button></td>
    </tr>
  );
}

function AnathBadge({ res, onPick }: { res: ReturnType<typeof resolve>; onPick: (code: string) => void }) {
  if (res.status === "direct")
    return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 tabular-nums" title={res.desc}>✓ {res.coeff?.toFixed(4) ?? "—"}</span>;
  if (res.status === "omoeides")
    return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 tabular-nums" title={`ομοειδές: ${res.via} — ${res.desc}`}>~ {res.coeff?.toFixed(4) ?? "—"} <span className="font-normal">({res.via})</span></span>;
  // missing → suggester
  return (
    <select defaultValue="" onChange={(e) => e.target.value && onPick(e.target.value)} className="w-full rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[11px] text-rose-700">
      <option value="">⚠ επίλεξε ομοειδές…</option>
      {res.suggestions.map((s) => <option key={s.code} value={s.code}>{s.code} ({s.coeff?.toFixed(3) ?? "—"}) — {s.desc.slice(0, 30)}</option>)}
    </select>
  );
}

function Line({ label, value, strong, big, muted }: { label: string; value: string; strong?: boolean; big?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={muted ? "text-slate-400" : "text-slate-600"}>{label}</dt>
      <dd className={`tabular-nums ${big ? "text-lg" : ""} ${strong ? "font-bold text-ink" : muted ? "text-slate-400" : "text-slate-700"}`}>{value}</dd>
    </div>
  );
}

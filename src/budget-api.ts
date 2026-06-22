import { createServer } from "node:http";
import { fetchPdfText } from "./pdf.js";
import { downloadMeleti, extractBudget } from "./extract-budget.js";

/**
 * Τοπικός companion server για one-click εξαγωγή προϋπολογισμού από το web app
 * (το static site δεν τρέχει Playwright). GET /extract?ada=<ΑΔΑ> ή ?sys=<ΑΑ>:
 *   ΑΔΑ → διακήρυξη → εντοπισμός αρ. συστήματος ΕΣΗΔΗΣ → μελέτη → εξαγωγή ανά ομάδες.
 *   npm run budget-api
 */
const PORT = 8787;

const withTimeout = <T>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

async function sysFromAda(ada: string): Promise<string> {
  const text = await fetchPdfText(`https://diavgeia.gov.gr/doc/${ada}`, 25000);
  const m = text.match(/pwgopendata[^\s)"']*?search\/(\d{5,7})/i) || text.match(/συστ[ηή]μ[^.]{0,30}?(\d{6})/i);
  if (!m) throw new Error("Δεν βρέθηκε αριθμός συστήματος ΕΣΗΔΗΣ στη διακήρυξη.");
  return m[1];
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/extract") return res.writeHead(404).end("not found");

  try {
    let sys = url.searchParams.get("sys") ?? "";
    const ada = url.searchParams.get("ada");
    if (!sys && ada) { process.stdout.write(`[${ada}] εύρεση συστήματος… `); sys = await withTimeout(sysFromAda(ada), 30000, "Δεν βρέθηκε αρ. συστήματος στη διακήρυξη (timeout)."); console.log(sys); }
    if (!sys) throw new Error("Δώσε ?sys=<ΑΑ> ή ?ada=<ΑΔΑ>.");

    console.log(`[${sys}] κατέβασμα + εξαγωγή…`);
    const pdfPath = await withTimeout(downloadMeleti(sys), 60000, "Το κατέβασμα από ΕΣΗΔΗΣ άργησε — άτυπο/μη διαθέσιμο αρχείο (timeout).");
    const rows = await withTimeout(extractBudget(pdfPath), 45000, "Η εξαγωγή του PDF άργησε (timeout).");
    const total = rows.reduce((a, r) => a + r.dapani, 0);
    console.log(`[${sys}] ✓ ${rows.length} άρθρα · ${total.toLocaleString("el-GR")} €`);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ sys, total, rows }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
});

server.listen(PORT, () => console.log(`📐 budget-api → http://localhost:${PORT}/extract?ada=<ΑΔΑ>`));

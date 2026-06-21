import { createRequire } from "node:module";

// pdf-parse είναι CommonJS· το φορτώνουμε μέσω createRequire και στοχευμένα
// το lib entry (το index.js τρέχει demo κώδικα στο import).
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

const cache = new Map<string, string>();

/** Κατεβάζει & εξάγει καθαρό κείμενο από PDF URL (με in-memory cache & timeout). */
export async function fetchPdfText(url: string, timeoutMs = 20000): Promise<string> {
  const cached = cache.get(url);
  if (cached !== undefined) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "espa-radar/0.1" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const { text } = await pdfParse(buf);
    const clean = text.replace(/\s+/g, " ").trim();
    cache.set(url, clean);
    return clean;
  } catch (err) {
    cache.set(url, ""); // μην ξαναπροσπαθήσεις το ίδιο broken PDF
    return "";
  } finally {
    clearTimeout(timer);
  }
}

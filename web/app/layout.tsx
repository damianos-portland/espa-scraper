import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ΕΣΠΑ Radar — Ενεργές χρηματοδοτήσεις",
  description:
    "Ενοποιημένος κατάλογος ενεργών χρηματοδοτικών προγραμμάτων (ΕΣΠΑ, Ταμείο Ανάκαμψης, Αναπτυξιακός Νόμος, Περιφερειακά) με έξυπνη αντιστοίχιση σε προφίλ.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

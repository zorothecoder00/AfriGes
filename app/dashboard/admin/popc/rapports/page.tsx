"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { exportRowsToXlsx, type XlsxColumnType } from "@/lib/exportXlsx";
import PopcTabs from "../PopcTabs";

interface RapportData {
  titre: string; periode: string;
  colonnes: { label: string; type?: string }[];
  lignes: (string | number)[][];
  totaux?: (string | number)[];
}

const TYPES: { code: string; label: string; dateBased?: boolean; anneeOnly?: boolean }[] = [
  { code: "journalier", label: "Rapport journalier", dateBased: true },
  { code: "hebdomadaire", label: "Rapport hebdomadaire", dateBased: true },
  { code: "quinzaine", label: "Rapport quinzaine (15 j)", dateBased: true },
  { code: "trentaine", label: "Rapport trentaine (30 j)", dateBased: true },
  { code: "mensuel", label: "Rapport mensuel" },
  { code: "annuel", label: "Rapport annuel", anneeOnly: true },
  { code: "comparatif", label: "Comparatif Objectif / Réalisé" },
  { code: "rentabilite-agence", label: "Rentabilité par agence" },
  { code: "rentabilite-commercial", label: "Rentabilité par commercial" },
  { code: "rentabilite-superviseur", label: "Rentabilité par superviseur" },
  { code: "prevision-collectes", label: "Prévision collectes 16es / 31es" },
  { code: "prevision-clients", label: "Prévision besoins nouveaux clients" },
];

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function RapportsPage() {
  const now = new Date();
  const [type, setType] = useState("mensuel");
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);

  const def = TYPES.find((t) => t.code === type)!;
  const params = () => {
    const p = new URLSearchParams({ type, annee: String(annee), mois: String(mois) });
    if (def.dateBased) p.set("date", date);
    return p.toString();
  };

  const telechargerPdf = async () => {
    setBusy("pdf");
    try {
      const res = await fetch(`/api/popc/rapports?${params()}&format=pdf`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `POPC-${type}-${annee}${String(mois).padStart(2, "0")}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export PDF");
    } finally { setBusy(null); }
  };

  const exporterExcel = async () => {
    setBusy("excel");
    try {
      const res = await fetch(`/api/popc/rapports?${params()}&format=json`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur données");
      const { data } = (await res.json()) as { data: RapportData };
      const header = data.colonnes.map((c) => c.label);
      const columnTypes = data.colonnes.map((c) => (c.type as XlsxColumnType | undefined));
      const rows: (string | number)[][] = [header, ...data.lignes];
      if (data.totaux) rows.push(data.totaux);
      if (rows.length <= 1) { toast.info("Aucune donnée à exporter"); return; }
      await exportRowsToXlsx(rows, `POPC-${type}-${annee}${String(mois).padStart(2, "0")}.xlsx`, {
        sheetName: def.label.slice(0, 28), columnTypes, currency: "FCFA",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'export Excel");
    } finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PopcTabs />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" /> Rapports
        </h1>
        <p className="text-sm text-gray-500 mt-1">Génération automatique, export PDF et Excel (§13)</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        {/* Type de rapport */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de rapport</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button key={t.code} onClick={() => setType(t.code)}
                className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-colors ${
                  type === t.code ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Période */}
        <div className="flex flex-wrap items-end gap-3">
          {def.dateBased ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date de fin</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
          ) : (
            <>
              {!def.anneeOnly && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mois</label>
                  <select value={mois} onChange={(e) => setMois(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
                    {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Année</label>
                <input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          <button onClick={telechargerPdf} disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
            {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </button>
          <button onClick={exporterExcel} disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
            {busy === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Les rapports sont générés en temps réel à partir des données des modules Crédit, Collecte, Comptabilité et RH — sans ressaisie.
      </p>
    </div>
  );
}

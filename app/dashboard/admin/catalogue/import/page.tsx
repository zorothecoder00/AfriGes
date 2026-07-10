"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import {
  ArrowLeft, Loader2, Upload, FileDown, CheckCircle2, XCircle, Play, Save, FileSpreadsheet,
} from "lucide-react";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import { matriceVersLignes, modeleImportRows, COLONNES_IMPORT } from "@/lib/catalogueImport";

interface Rapport { ligne: number; action: "create" | "update" | "error"; nom: string; codeProduit: string | null; message: string; }
interface Resultat { mode: string; cle: string; resume: { total: number; crees: number; maj: number; erreurs: number }; rapports: Rapport[]; }

// Parse un CSV simple (délimiteur ; ou , ; guillemets doublés).
function parseCsv(text: string): string[][] {
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) >= (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { cur.push(field); field = ""; }
    else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => { cells.push(cell.value == null ? "" : String(cell.text ?? cell.value)); });
    rows.push(cells);
  });
  return rows;
}

export default function ImportCataloguePage() {
  const [fileName, setFileName] = useState("");
  const [lignes, setLignes] = useState<Record<string, string>[]>([]);
  const [cle, setCle] = useState<"codeProduit" | "reference">("codeProduit");
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [applied, setApplied] = useState(false);

  const telechargerModele = () => {
    exportRowsToXlsx(modeleImportRows(), "modele-import-catalogue.xlsx", { sheetName: "Modèle" });
  };

  const onFile = useCallback(async (file: File) => {
    setResultat(null); setApplied(false); setFileName(file.name);
    try {
      let matrice: string[][];
      if (file.name.toLowerCase().endsWith(".csv")) matrice = parseCsv(await file.text());
      else matrice = await parseXlsx(await file.arrayBuffer());
      const rows = matriceVersLignes(matrice);
      if (rows.length === 0) { toast.error("Aucune ligne exploitable (vérifiez les en-têtes)"); setLignes([]); return; }
      setLignes(rows);
      toast.success(`${rows.length} ligne(s) chargée(s)`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fichier illisible"); setLignes([]); }
  }, []);

  const lancer = async (mode: "dry-run" | "apply") => {
    if (lignes.length === 0) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/catalogue/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, cle, rows: lignes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setResultat(j.data);
      if (mode === "apply") { setApplied(true); toast.success(`Import terminé : ${j.data.resume.crees} créé(s), ${j.data.resume.maj} mis à jour`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const ACTION_STYLE: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700", update: "bg-blue-100 text-blue-700", error: "bg-rose-100 text-rose-700",
  };
  const ACTION_LABEL: Record<string, string> = { create: "Création", update: "Mise à jour", error: "Erreur" };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Upload className="w-6 h-6 text-blue-600" /> Import de produits</h2>
            <p className="text-sm text-gray-400">Importez un fichier Excel (.xlsx) ou CSV. Rapprochement par code produit ou référence.</p>
          </div>
          <button onClick={telechargerModele} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
            <FileDown className="w-4 h-4" /> Télécharger le modèle
          </button>
        </div>

        {/* Zone de dépôt + options */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
            <FileSpreadsheet className="w-8 h-8 text-gray-300" />
            <span className="text-sm text-gray-600">{fileName || "Cliquez pour choisir un fichier .xlsx ou .csv"}</span>
            {lignes.length > 0 && <span className="text-xs text-emerald-600 font-medium">{lignes.length} ligne(s) prête(s)</span>}
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Rapprochement par
              <select value={cle} onChange={(e) => setCle(e.target.value as "codeProduit" | "reference")} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
                <option value="codeProduit">Code produit</option>
                <option value="reference">Référence</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={() => lancer("dry-run")} disabled={lignes.length === 0 || busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                {busy && !applied ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Simuler
              </button>
              <button onClick={() => lancer("apply")} disabled={lignes.length === 0 || busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Importer
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            Colonnes reconnues : {COLONNES_IMPORT.map((c) => c.label).join(", ")}. Les familles / catégories / marques / unités inconnues sont créées automatiquement à l&apos;import.
          </p>
        </div>

        {/* Rapport */}
        {resultat && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                {applied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Play className="w-4 h-4 text-gray-500" />}
                {applied ? "Import réalisé" : "Simulation"}
              </h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-600">{resultat.resume.crees} création(s)</span>
                <span className="text-blue-600">{resultat.resume.maj} mise(s) à jour</span>
                <span className={resultat.resume.erreurs ? "text-rose-600" : "text-gray-400"}>{resultat.resume.erreurs} erreur(s)</span>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Action</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Code</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resultat.rapports.map((r) => (
                    <tr key={r.ligne} className={r.action === "error" ? "bg-rose-50/40" : ""}>
                      <td className="px-4 py-2 text-gray-400">{r.ligne}</td>
                      <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${ACTION_STYLE[r.action]}`}>{r.action === "error" ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}{ACTION_LABEL[r.action]}</span></td>
                      <td className="px-4 py-2 text-gray-800">{r.nom || "—"}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-gray-500">{r.codeProduit ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

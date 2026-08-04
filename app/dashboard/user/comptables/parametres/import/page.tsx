"use client";

// Paramètres — Import comptable (CSV/Excel).
// Extrait du bloc activeTab === "importEcritures" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 4940), consommant /api/comptable/import-ecritures/apercu puis /api/comptable/import-ecritures.
import { useState } from "react";
import { useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { Upload, ChevronsUpDown, Save, AlertTriangle } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface GroupeImportEntry {
  reference: string; nbLignes: number; totalDebit: number; totalCredit: number;
  equilibre: boolean; journal: string; journalValide: boolean; comptesInconnus: string[];
  dateInvalide: boolean; sectionsInconnues: string[]; erreurs: string[];
}
interface ApercuImportEntry {
  totalLignes: number; totalGroupes: number; groupesValides: number; groupesEnErreur: number; groupes: GroupeImportEntry[];
}

async function fichierEnBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binaire = "";
  new Uint8Array(buffer).forEach((b) => { binaire += String.fromCharCode(b); });
  return btoa(binaire);
}

export default function ImportComptablePage() {
  const [importFile, setImportFile]         = useState<File | null>(null);
  const [importFormat, setImportFormat]     = useState<"CSV" | "XLSX">("CSV");
  const [importContenu, setImportContenu]   = useState<string | null>(null);
  const [apercuImport, setApercuImport]     = useState<ApercuImportEntry | null>(null);
  const [forcerImportPartiel, setForcerImportPartiel] = useState(false);

  const { mutate: apercuImportApi, loading: apercuImportLoading } = useMutation<{ data: ApercuImportEntry }, object>(
    "/api/comptable/import-ecritures/apercu", "POST"
  );
  const { mutate: confirmerImportEcrituresApi, loading: confirmantImportEcritures } = useMutation<{ message: string }, object>(
    "/api/comptable/import-ecritures", "POST", { successMessage: "Import comptable terminé" }
  );

  async function handleApercuImport() {
    if (!importFile) return;
    const nomFichier = importFile.name.toLowerCase();
    const format = nomFichier.endsWith(".xlsx") || nomFichier.endsWith(".xls") ? "XLSX" : "CSV";
    setImportFormat(format);
    const contenu = format === "XLSX" ? await fichierEnBase64(importFile) : await importFile.text();
    setImportContenu(contenu);
    setForcerImportPartiel(false);
    const res = await apercuImportApi({ format, contenu });
    if (res) setApercuImport(res.data);
  }
  async function handleConfirmerImportEcritures() {
    if (!importContenu) return;
    const res = await confirmerImportEcrituresApi({ format: importFormat, contenu: importContenu, forcerImportPartiel });
    if (res) { setApercuImport(null); setImportFile(null); setImportContenu(null); setForcerImportPartiel(false); }
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Upload className="text-emerald-600" size={22} /> Import comptable
        </h2>
        {AIDE_COMPTABLE.importEcritures && <AideComptable contenu={AIDE_COMPTABLE.importEcritures} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
          <Upload className="text-emerald-600" size={20} /> Import comptable (CSV / Excel)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Colonnes attendues : Date, Journal, Compte, Libelle, Debit, Credit, Reference, Tiers, Analytique — les lignes partageant la même
          Référence forment une seule écriture. Un aperçu de validation est obligatoire avant tout import réel ; l&apos;import est bloqué tant
          qu&apos;il reste un groupe en erreur, sauf dérogation explicite (CDC §47).
        </p>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setApercuImport(null); }}
            className="text-sm text-slate-600" />
          <button onClick={handleApercuImport} disabled={apercuImportLoading || !importFile}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {apercuImportLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ChevronsUpDown size={15} />}
            Aperçu
          </button>
          {apercuImport && (
            <button onClick={handleConfirmerImportEcritures}
              disabled={confirmantImportEcritures || apercuImport.groupesValides === 0 || (apercuImport.groupesEnErreur > 0 && !forcerImportPartiel)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {confirmantImportEcritures ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              Importer les {apercuImport.groupesValides} groupe(s) valide(s)
            </button>
          )}
        </div>

        {apercuImport && apercuImport.groupesEnErreur > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle size={13} /> Import bloqué : {apercuImport.groupesEnErreur} groupe(s) en erreur — corrigez le fichier et relancez l&apos;aperçu.
            </p>
            <label className="flex items-center gap-2 text-xs text-amber-700">
              <input type="checkbox" checked={forcerImportPartiel} onChange={(e) => setForcerImportPartiel(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded" />
              Importer quand même les {apercuImport.groupesValides} groupe(s) valide(s), en ignorant les groupes en erreur
            </label>
          </div>
        )}

        {apercuImport && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400">Lignes détectées</p><p className="font-bold text-slate-800">{apercuImport.totalLignes}</p></div>
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-xs text-slate-400">Écritures détectées</p><p className="font-bold text-slate-800">{apercuImport.totalGroupes}</p></div>
              <div className="p-3 bg-emerald-50 rounded-xl"><p className="text-xs text-emerald-600">Valides</p><p className="font-bold text-emerald-700">{apercuImport.groupesValides}</p></div>
              <div className="p-3 bg-red-50 rounded-xl"><p className="text-xs text-red-600">En erreur</p><p className="font-bold text-red-600">{apercuImport.groupesEnErreur}</p></div>
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Référence</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Journal</th>
                  <th className="text-center px-3 py-1.5 font-semibold text-slate-500">Lignes</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-blue-600">Débit</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-emerald-600">Crédit</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {apercuImport.groupes.map((g) => (
                  <tr key={g.reference} className={g.erreurs.length > 0 ? "bg-red-50/40" : ""}>
                    <td className="px-3 py-1.5 font-mono text-emerald-700">{g.reference}</td>
                    <td className="px-3 py-1.5 text-slate-600">{g.journal}</td>
                    <td className="px-3 py-1.5 text-center text-slate-600">{g.nbLignes}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700">{formatCurrency(g.totalDebit)}</td>
                    <td className="px-3 py-1.5 text-right text-emerald-700">{formatCurrency(g.totalCredit)}</td>
                    <td className="px-3 py-1.5">
                      {g.erreurs.length === 0 ? (
                        <span className="text-emerald-600 font-semibold">OK</span>
                      ) : (
                        <span className="text-red-600">{g.erreurs.join(" · ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}

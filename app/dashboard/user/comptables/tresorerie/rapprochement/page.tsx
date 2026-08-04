"use client";

import { useState } from "react";
import { Building2, Upload, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface RapprochementBancaire {
  id: number; periode: string; soldeBancaireReel: number;
  soldeComptable: number; ecart: number; statut: string; notes: string | null;
  user?: { id: number; nom: string; prenom: string };
}
interface RapprochementResponse {
  data: RapprochementBancaire[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LigneReleveEntry {
  id: number; date: string; libelle: string; reference: string | null;
  debit: number; credit: number; statut: string; ligneEcritureId: number | null;
}
interface PropositionRapprochementEntry { ligneReleveId: number; ligneEcritureId: number; montant: number; ecartJours: number }

export default function RapprochementPage() {
  // ── État Rapprochement ───────────────────────────────────────────────
  const [rapproPage, setRapproPage]         = useState(1);
  const [rapproPeriode, setRapproPeriode]   = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [soldeBancaireInput, setSoldeBancaireInput] = useState("");
  const [rapproNotes, setRapproNotes]       = useState("");

  // ── État Rapprochement ligne à ligne (import CSV) ─────────────────────
  const [releveCompteNumero, setReleveCompteNumero] = useState("521");
  const [releveCsvFile, setReleveCsvFile]           = useState<File | null>(null);

  // ── Rapprochement API ─────────────────────────────────────────────────
  const { data: rapproData, loading: rapproLoading, refetch: refetchRappro } =
    useApi<RapprochementResponse>(`/api/comptable/rapprochement?page=${rapproPage}&limit=24`);

  const { mutate: enregistrerRappro, loading: enregistrantRappro } = useMutation<unknown, object>(
    "/api/comptable/rapprochement", "POST",
    { successMessage: "Rapprochement enregistré" }
  );

  async function handleEnregistrerRappro() {
    const res = await enregistrerRappro({ periode: rapproPeriode, soldeBancaireReel: Number(soldeBancaireInput), notes: rapproNotes || null });
    if (res) { refetchRappro(); setSoldeBancaireInput(""); setRapproNotes(""); }
  }

  // ── Rapprochement ligne à ligne (import CSV) API ──────────────────────
  const { data: releveData, loading: releveLoading, refetch: refetchReleve } = useApi<{
    data: { lignes: LigneReleveEntry[]; propositions: PropositionRapprochementEntry[] };
  }>(releveCompteNumero ? `/api/comptable/rapprochement/lignes?compteNumero=${releveCompteNumero}` : null);

  const { mutate: importerReleveApi, loading: importingReleve } = useMutation<{ data: { nbImportees: number; erreurs: string[] } }, object>(
    "/api/comptable/rapprochement/import", "POST", { successMessage: "Relevé importé" }
  );
  const { mutate: confirmerRapprochementApi } = useMutation<unknown, object>(
    "/api/comptable/rapprochement/confirmer", "POST", { successMessage: "Rapprochement confirmé" }
  );

  async function handleImporterReleve() {
    if (!releveCsvFile) return;
    const nomFichier = releveCsvFile.name.toLowerCase();
    let format: "CSV" | "XLSX" | "OFX" = "CSV";
    if (nomFichier.endsWith(".xlsx") || nomFichier.endsWith(".xls")) format = "XLSX";
    else if (nomFichier.endsWith(".ofx")) format = "OFX";

    let contenu: string;
    if (format === "XLSX") {
      const buffer = await releveCsvFile.arrayBuffer();
      let binaire = "";
      new Uint8Array(buffer).forEach((b) => { binaire += String.fromCharCode(b); });
      contenu = btoa(binaire);
    } else {
      contenu = await releveCsvFile.text();
    }

    const res = await importerReleveApi({ compteNumero: releveCompteNumero, format, contenu });
    if (res) { setReleveCsvFile(null); refetchReleve(); }
  }
  async function handleConfirmerRapprochement(ligneReleveId: number, ligneEcritureId: number) {
    const res = await confirmerRapprochementApi({ ligneReleveId, ligneEcritureId });
    if (res) refetchReleve();
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-violet-600" size={22} /> Rapprochement bancaire
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["rapprochement"] && <AideComptable contenu={AIDE_COMPTABLE["rapprochement"]} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Building2 className="text-violet-600" size={20} /> Rapprochement Bancaire
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Formulaire */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-700 text-sm">Nouveau rapprochement</h4>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Période (mois)</label>
                <input type="month" value={rapproPeriode} onChange={(e) => setRapproPeriode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Solde bancaire réel (relevé de compte)</label>
                <input type="number" value={soldeBancaireInput} onChange={(e) => setSoldeBancaireInput(e.target.value)}
                  placeholder="ex: 1500000" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                <p className="text-xs text-slate-400 mt-1">Le solde comptable sera calculé automatiquement depuis les écritures validées du compte 521 (Banque).</p>
              </div>
              <textarea value={rapproNotes} onChange={(e) => setRapproNotes(e.target.value)}
                placeholder="Notes ou observations…" rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              <button onClick={handleEnregistrerRappro}
                disabled={enregistrantRappro || !rapproPeriode || soldeBancaireInput === ""}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {enregistrantRappro ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ChevronsUpDown size={15} />} Calculer & Enregistrer
              </button>
            </div>

            {/* Historique rapprochements */}
            <div>
              <h4 className="font-semibold text-slate-700 text-sm mb-3">Historique des rapprochements</h4>
              {rapproLoading ? (
                <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
              ) : (rapproData?.data ?? []).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Aucun rapprochement enregistré.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {(rapproData?.data ?? []).map((r) => {
                    const rapproche = Math.abs(Number(r.ecart)) < 0.01;
                    return (
                      <div key={r.id} className={`border rounded-xl p-3 hover:border-slate-200 ${rapproche ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-800">{r.periode}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rapproche ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {rapproche ? "Rapproché" : `Écart : ${formatCurrency(Math.abs(Number(r.ecart)))}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-slate-400">Solde bancaire</span><br /><strong className="text-slate-800">{formatCurrency(Number(r.soldeBancaireReel))}</strong></div>
                          <div><span className="text-slate-400">Solde comptable</span><br /><strong className="text-slate-800">{formatCurrency(Number(r.soldeComptable))}</strong></div>
                          <div><span className="text-slate-400">Écart</span><br /><strong className={rapproche ? "text-emerald-600" : "text-red-600"}>{formatCurrency(Number(r.ecart))}</strong></div>
                        </div>
                        {r.notes && <p className="text-xs text-slate-400 italic mt-1.5">{r.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {rapproData && rapproData.meta.totalPages > 1 && (
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setRapproPage(p => Math.max(1, p - 1))} disabled={rapproPage === 1}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronLeft size={13} /></button>
                  <button onClick={() => setRapproPage(p => Math.min(rapproData.meta.totalPages, p + 1))} disabled={rapproPage === rapproData.meta.totalPages}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronRight size={13} /></button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rapprochement ligne à ligne (import CSV) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
            <Upload className="text-violet-600" size={20} /> Rapprochement ligne à ligne
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Importez le relevé bancaire — CSV/Excel (Date, Libelle, Debit, Credit, Reference) ou OFX — le système propose des
            correspondances exactes (montant + date ±10 j) avec les écritures déjà passées sur le compte ; vous confirmez chaque rapprochement.
          </p>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <input value={releveCompteNumero} onChange={(e) => setReleveCompteNumero(e.target.value)}
              placeholder="N° compte (ex: 521)" className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.ofx"
              onChange={(e) => setReleveCsvFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600" />
            <button onClick={handleImporterReleve} disabled={importingReleve || !releveCsvFile}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              {importingReleve ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={15} />}
              Importer
            </button>
          </div>

          {releveLoading ? (
            <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
          ) : (
            <>
              {(releveData?.data.propositions ?? []).length > 0 && (
                <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">Correspondances proposées</p>
                  <div className="space-y-1.5">
                    {releveData!.data.propositions.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{formatCurrency(p.montant)} — écart {p.ecartJours} j</span>
                        <button onClick={() => handleConfirmerRapprochement(p.ligneReleveId, p.ligneEcritureId)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">
                          Confirmer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Date</th>
                    <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Libellé</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-blue-600">Débit</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-emerald-600">Crédit</th>
                    <th className="text-center px-3 py-1.5 font-semibold text-slate-400">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(releveData?.data.lignes ?? []).map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5 text-slate-600">{formatDateShort(l.date)}</td>
                      <td className="px-3 py-1.5 text-slate-700">{l.libelle}</td>
                      <td className="px-3 py-1.5 text-right text-blue-700">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : ""}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-700">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : ""}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.statut === "RAPPROCHE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {l.statut === "RAPPROCHE" ? "Rapproché" : "Non rapproché"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(releveData?.data.lignes ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Aucune ligne importée pour ce compte.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

// Rubrique "Saisie comptable" → sous-page "Nouvelle écriture" (clé d'accès "saisie").
// Formulaire de création extrait du bloc activeTab === "saisie" du monolithe,
// séparé de la liste (/saisie) pour correspondre au sous-item CDC dédié.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, Save, X, CheckCircle, AlertCircle } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/contexts/AppSettingsContext";

interface LigneEcritureForm {
  compteId: number | ""; libelle: string; debit: string; credit: string;
  isTva: boolean; tauxTva: string; montantTva: string; pointDeVenteId: number | "";
}
interface JournalComptableEntry {
  id: number | null; code: string; libelle: string; prefixe: string | null; actif: boolean; builtin: boolean;
}
interface DeviseEntry { code: string; nom: string; symbole: string; tauxVersFonctionnelle: number }
interface PointDeVenteEntry { id: number; nom: string; code: string }

const LIGNE_VIDE: LigneEcritureForm = { compteId: "", libelle: "", debit: "", credit: "", isTva: false, tauxTva: "18", montantTva: "", pointDeVenteId: "" };

export default function NouvelleEcriturePage() {
  const t = useT();
  const router = useRouter();

  const { data: journauxData } = useApi<{ data: JournalComptableEntry[] }>("/api/comptable/journaux");
  // CDC §49 — devise de transaction (fonctionnelle = XOF, taux=1 par défaut) ;
  // CDC §48 — point de vente par ligne, pour un futur "résultat par PDV".
  const { data: devisesData } = useApi<{ data: DeviseEntry[] }>("/api/comptable/devises");
  const { data: pdvData } = useApi<{ data: PointDeVenteEntry[] }>("/api/comptable/points-de-vente");

  const [saisieForm, setSaisieForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    libelle: "", journal: "CAISSE", notes: "", devise: "XOF", tauxChange: "1",
  });
  const [saisieLignes, setSaisieLignes] = useState<LigneEcritureForm[]>([{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }]);
  const [derogationJustification, setDerogationJustification] = useState("");

  function handleChangeDevise(code: string) {
    const d = (devisesData?.data ?? []).find((x) => x.code === code);
    setSaisieForm((p) => ({ ...p, devise: code, tauxChange: d ? String(d.tauxVersFonctionnelle) : "1" }));
  }

  const { mutate: createEcriture, loading: creatingEcriture, error: creationError } = useMutation<unknown, object>(
    "/api/comptable/ecritures", "POST",
    { successMessage: "Écriture enregistrée" }
  );
  // CDC §29/§31 — "période fermée" ne bloque pas silencieusement : un champ de
  // justification apparaît pour retenter avec l'autorisation spéciale (réservée
  // ADMIN/SUPER_ADMIN côté serveur, qui revalide de toute façon le rôle).
  const periodeFermee = !!creationError?.includes("Période fermée");
  // CDC §42 — doublon potentiel détecté côté serveur (journal+date+montant+
  // référence/libellé) : l'utilisateur doit confirmer explicitement pour
  // créer quand même, plutôt que d'être bloqué silencieusement.
  const doublonDetecte = !!creationError?.toLowerCase().includes("similaire existe déjà");

  async function handleSaisieSubmit(forcerDoublon = false) {
    const lignes = saisieLignes
      .filter((l) => l.compteId !== "" && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        compteId: Number(l.compteId), libelle: l.libelle || saisieForm.libelle,
        debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        isTva: l.isTva, tauxTva: l.isTva ? Number(l.tauxTva) : null,
        montantTva: l.isTva && l.montantTva ? Number(l.montantTva) : null,
        pointDeVenteId: l.pointDeVenteId !== "" ? Number(l.pointDeVenteId) : undefined,
      }));
    const res = await createEcriture({
      ...saisieForm, lignes,
      ...(periodeFermee && derogationJustification.trim() && { derogationJustification: derogationJustification.trim() }),
      ...((forcerDoublon || doublonDetecte) && { confirmerDoublon: true }),
    });
    if (res) {
      router.push("/dashboard/user/comptables/saisie");
    }
  }

  const totalDebit  = saisieLignes.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = saisieLignes.reduce((s, l) => s + Number(l.credit || 0), 0);
  const equilibre   = Math.abs(totalDebit - totalCredit) < 0.01 && saisieLignes.some(l => Number(l.debit) > 0 || Number(l.credit) > 0);

  return (
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Nouvelle écriture</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Edit2 size={16} className="text-violet-600" /> Saisie d&apos;écriture</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
            <input type="date" value={saisieForm.date} onChange={(e) => setSaisieForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
            <input value={saisieForm.libelle} onChange={(e) => setSaisieForm(p => ({ ...p, libelle: e.target.value }))}
              placeholder="ex: Règlement fournisseur DUPONT…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Journal *</label>
            <select value={saisieForm.journal} onChange={(e) => setSaisieForm(p => ({ ...p, journal: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {(journauxData?.data ?? []).filter(j => j.actif).map(j => <option key={j.code} value={j.code}>{j.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Devise (CDC §49)</label>
            <select value={saisieForm.devise} onChange={(e) => handleChangeDevise(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {(devisesData?.data ?? []).map(d => <option key={d.code} value={d.code}>{d.code} — {d.nom}</option>)}
            </select>
          </div>
          {saisieForm.devise !== "XOF" && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Taux vers XOF</label>
              <input type="number" step="0.0001" value={saisieForm.tauxChange}
                onChange={(e) => setSaisieForm(p => ({ ...p, tauxChange: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
              <p className="text-[10px] text-slate-400 mt-0.5">Montants des lignes toujours saisis en XOF (devise fonctionnelle).</p>
            </div>
          )}
        </div>

        {/* Lignes d'écriture */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">N° Compte</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Libellé ligne</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Débit</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Crédit</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600">TVA</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">PDV</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {saisieLignes.map((ligne, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input value={String(ligne.compteId)} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, compteId: e.target.value as unknown as number | "" } : l))}
                      placeholder="411" className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={ligne.libelle} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, libelle: e.target.value } : l))}
                      placeholder="Libellé…" className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" value={ligne.debit} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, debit: e.target.value, credit: e.target.value ? "" : l.credit } : l))}
                      placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 [appearance:textfield]" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" value={ligne.credit} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, credit: e.target.value, debit: e.target.value ? "" : l.debit } : l))}
                      placeholder="0" className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-400 [appearance:textfield]" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={ligne.isTva} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, isTva: e.target.checked } : l))}
                      className="w-4 h-4 accent-violet-600 rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={String(ligne.pointDeVenteId)} onChange={(e) => setSaisieLignes(ls => ls.map((l, j) => j === i ? { ...l, pointDeVenteId: e.target.value === "" ? "" : Number(e.target.value) } : l))}
                      className="w-32 px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-400">
                      <option value="">—</option>
                      {(pdvData?.data ?? []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {saisieLignes.length > 2 && (
                      <button onClick={() => setSaisieLignes(ls => ls.filter((_, j) => j !== i))}
                        className="p-1 text-red-400 hover:bg-red-50 rounded-lg"><X size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-600">TOTAUX</td>
                <td className="px-3 py-2 text-right font-bold text-blue-700">{formatCurrency(totalDebit)}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(totalCredit)}</td>
                <td colSpan={3} className="px-3 py-2 text-center">
                  {equilibre ? (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1"><CheckCircle size={12} /> Équilibré</span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold flex items-center justify-center gap-1"><AlertCircle size={12} /> Non équilibré</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {periodeFermee && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-amber-800 mb-1.5">
              Période fermée — autorisation spéciale requise (CDC §29). Réservé aux administrateurs, avec justification obligatoire.
            </p>
            <input value={derogationJustification} onChange={(e) => setDerogationJustification(e.target.value)}
              placeholder="Motif de la dérogation…"
              className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        )}

        {doublonDetecte && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <AlertCircle size={13} /> {creationError} (CDC §42)
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setSaisieLignes(ls => [...ls, { ...LIGNE_VIDE }])}
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium">
            <Plus size={14} /> Ajouter une ligne
          </button>
          <div className="flex gap-2">
            <button onClick={() => router.push("/dashboard/user/comptables/saisie")} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
            <button onClick={() => handleSaisieSubmit()}
              disabled={creatingEcriture || !saisieForm.libelle || !saisieForm.date || (periodeFermee && !derogationJustification.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              {creatingEcriture ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              {periodeFermee ? "Forcer avec justification" : doublonDetecte ? "Confirmer et enregistrer quand même" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

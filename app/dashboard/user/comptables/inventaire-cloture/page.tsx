"use client";

// Inventaire & clôture — Écritures d'inventaire (page NEUVE).
// Liste les inventaires physiques VALIDE en attente de comptabilisation
// (InventaireSite dont ecritureRegularisationId est encore null) et permet de
// comptabiliser l'écart valorisé (Σ ecart × prixAchat) via le moteur central
// (lib/comptabilite/ecrituresInventaire.ts, règle INVENTAIRE_ECART_VALIDE).
import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { ClipboardCheck, CheckCircle, RefreshCw } from "lucide-react";

interface LigneInventaireEntry {
  id: number;
  quantiteSysteme: number;
  quantiteConstatee: number;
  ecart: number;
  produit: { nom: string; prixAchat: number | string | null };
}
interface InventaireEntry {
  id: number;
  reference: string;
  dateInventaire: string;
  pointDeVente: { nom: string };
  realisePar: { nom: string; prenom: string };
  lignes: LigneInventaireEntry[];
}

function ecartValorise(inv: InventaireEntry): number {
  return inv.lignes.reduce((somme, l) => {
    const prixAchat = l.produit.prixAchat != null ? Number(l.produit.prixAchat) : 0;
    return somme + l.ecart * prixAchat;
  }, 0);
}

export default function InventaireEcrituresPage() {
  const { data, loading, refetch } = useApi<{ data: InventaireEntry[] }>("/api/comptable/inventaire");
  const actionIdRef = useRef<number | null>(null);
  const [comptabilisantId, setComptabilisantId] = useState<number | null>(null);
  const { mutate: comptabiliserApi } = useMutation<unknown, object>(
    () => `/api/comptable/inventaire/${actionIdRef.current}/comptabiliser`, "POST",
    { successMessage: "Écart d'inventaire comptabilisé" }
  );

  async function handleComptabiliser(id: number) {
    actionIdRef.current = id;
    setComptabilisantId(id);
    const res = await comptabiliserApi({});
    setComptabilisantId(null);
    if (res) refetch();
  }

  const inventaires = data?.data ?? [];

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="text-emerald-600" size={22} /> Écritures d&apos;inventaire
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Inventaires physiques validés en attente de comptabilisation de leur écart.
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Référence</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Point de vente</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Réalisé par</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Écart valorisé</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventaires.map((inv) => {
                const ecart = ecartValorise(inv);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">{inv.reference}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.pointDeVente.nom}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateShort(inv.dateInventaire)}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{inv.realisePar.prenom} {inv.realisePar.nom}</td>
                    <td className={`px-4 py-3 text-right font-bold ${ecart >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {ecart >= 0 ? "+" : ""}{formatCurrency(ecart)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleComptabiliser(inv.id)}
                        disabled={comptabilisantId === inv.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 ml-auto"
                      >
                        {comptabilisantId === inv.id
                          ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <CheckCircle size={13} />}
                        Comptabiliser
                      </button>
                    </td>
                  </tr>
                );
              })}
              {inventaires.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <ClipboardCheck size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Aucun inventaire en attente de comptabilisation.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

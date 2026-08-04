"use client";

// États financiers — Compte de résultat.
// Une des 4 pages consommant /api/comptable/etats-financiers-reels?annee= (voir bilan/page.tsx).
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import type { EtatsFinanciersReelsResponse } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

export default function CompteResultatPage() {
  const [annee, setAnnee] = useState(() => String(new Date().getFullYear()));
  const { data, loading } = useApi<EtatsFinanciersReelsResponse>(`/api/comptable/etats-financiers-reels?annee=${annee}`);
  const cr = data?.data.compteResultat;

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-emerald-600" size={22} /> Compte de résultat
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Produits et charges de l&apos;exercice, dérivés des écritures validées (CDC §37).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
          {AIDE_COMPTABLE.etatsReels && <AideComptable contenu={AIDE_COMPTABLE.etatsReels} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : cr && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-2xl">
          <h4 className="font-semibold text-slate-800 mb-3">Compte de résultat {annee}</h4>
          <div className="space-y-1 text-sm mb-2">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Produits</p>
            {cr.produits.map((l) => (
              <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} {l.libelle}</span><span className="text-emerald-700">{formatCurrency(l.montant)}</span></div>
            ))}
            {cr.produits.length === 0 && <p className="text-slate-400 text-xs italic">Aucun produit</p>}
            <p className="text-xs font-semibold text-red-600 uppercase mt-2">Charges</p>
            {cr.charges.map((l) => (
              <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} {l.libelle}</span><span className="text-red-600">{formatCurrency(l.montant)}</span></div>
            ))}
            {cr.charges.length === 0 && <p className="text-slate-400 text-xs italic">Aucune charge</p>}
          </div>
          <div className={`flex justify-between mt-3 pt-3 border-t border-slate-200 font-bold ${cr.resultatNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            <span>Résultat net</span><span>{formatCurrency(cr.resultatNet)}</span>
          </div>
        </div>
      )}
    </main>
  );
}

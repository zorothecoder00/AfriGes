"use client";

// Paramètres — Rapports de gestion.
// Extrait du bloc activeTab === "rapportsGestion" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 5014), consommant /api/comptable/rapports-gestion (~ligne 1387).
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface RapportsGestionData {
  caParPdv: { pdvId: number; pdvNom: string; caTotal: number }[];
  margeParProduit: { produitId: number; nom: string; quantiteVendue: number; ca: number; marge: number | null; margePct: number | null; coutConnu: boolean }[];
  margeParFamille: { familleId: number | null; nom: string; ca: number; marge: number | null; margePct: number | null }[];
  rentabiliteParAgence: { pdvId: number; pdvNom: string; ca: number; marge: number | null; margePct: number | null }[];
  rotationStock: { produitId: number; nom: string; quantiteVendue: number; stockActuel: number; rotation: number | null; valeurStock: number }[];
  dso: { encoursMoyen: number; caCreditPeriode: number; joursPeriode: number; dsoJours: number | null };
  dpoFournisseursProxy: { fournisseurId: number; nom: string; resteAPayer: number }[];
}

export default function RapportsGestionPage() {
  const [rapportsDateFin, setRapportsDateFin] = useState(() => new Date().toISOString().slice(0, 10));
  const [rapportsDateDebut, setRapportsDateDebut] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
  });

  const { data: rapportsGestionData, loading: rapportsGestionLoading } = useApi<{ data: RapportsGestionData }>(
    `/api/comptable/rapports-gestion?dateDebut=${rapportsDateDebut}&dateFin=${rapportsDateFin}`
  );

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="text-emerald-600" size={22} /> Rapports de gestion
        </h2>
        {AIDE_COMPTABLE.rapportsGestion && <AideComptable contenu={AIDE_COMPTABLE.rapportsGestion} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-slate-500 mt-0.5">CA et marge par point de vente/produit/famille, rotation de stock, DSO clients (CDC §71-72).</p>
        <div className="flex items-center gap-2">
          <input type="date" value={rapportsDateDebut} onChange={(e) => setRapportsDateDebut(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" value={rapportsDateFin} onChange={(e) => setRapportsDateFin(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {rapportsGestionLoading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : rapportsGestionData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60">
              <p className="text-xs text-slate-400">CA période</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(rapportsGestionData.data.caParPdv.reduce((s, p) => s + p.caTotal, 0))}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60">
              <p className="text-xs text-slate-400">DSO clients (délai moyen de recouvrement)</p>
              <p className="text-xl font-bold text-slate-800">{rapportsGestionData.data.dso.dsoJours != null ? `${rapportsGestionData.data.dso.dsoJours} j` : "—"}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60">
              <p className="text-xs text-slate-400">Encours clients</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(rapportsGestionData.data.dso.encoursMoyen)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200/60">
              <p className="text-xs text-slate-400">Reste à payer fournisseurs</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(rapportsGestionData.data.dpoFournisseursProxy.reduce((s, f) => s + f.resteAPayer, 0))}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Rentabilité par agence (point de vente)</h4>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100"><tr>
                  <th className="text-left py-1.5 text-slate-500">PDV</th>
                  <th className="text-right py-1.5 text-slate-500">CA</th>
                  <th className="text-right py-1.5 text-slate-500">Marge</th>
                  <th className="text-right py-1.5 text-slate-500">Marge %</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rapportsGestionData.data.rentabiliteParAgence.map((r) => (
                    <tr key={r.pdvId}>
                      <td className="py-1.5 text-slate-700">{r.pdvNom}</td>
                      <td className="py-1.5 text-right text-slate-700">{formatCurrency(r.ca)}</td>
                      <td className="py-1.5 text-right text-emerald-700">{r.marge != null ? formatCurrency(r.marge) : "—"}</td>
                      <td className="py-1.5 text-right text-emerald-700">{r.margePct != null ? `${r.margePct}%` : "—"}</td>
                    </tr>
                  ))}
                  {rapportsGestionData.data.rentabiliteParAgence.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucune vente sur la période.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Marge par famille de produits</h4>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100"><tr>
                  <th className="text-left py-1.5 text-slate-500">Famille</th>
                  <th className="text-right py-1.5 text-slate-500">CA</th>
                  <th className="text-right py-1.5 text-slate-500">Marge</th>
                  <th className="text-right py-1.5 text-slate-500">Marge %</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rapportsGestionData.data.margeParFamille.map((f) => (
                    <tr key={f.familleId ?? "sans"}>
                      <td className="py-1.5 text-slate-700">{f.nom}</td>
                      <td className="py-1.5 text-right text-slate-700">{formatCurrency(f.ca)}</td>
                      <td className="py-1.5 text-right text-emerald-700">{f.marge != null ? formatCurrency(f.marge) : "coût inconnu"}</td>
                      <td className="py-1.5 text-right text-emerald-700">{f.margePct != null ? `${f.margePct}%` : "—"}</td>
                    </tr>
                  ))}
                  {rapportsGestionData.data.margeParFamille.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucune vente sur la période.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Marge par produit (triée par CA)</h4>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 sticky top-0 bg-white"><tr>
                  <th className="text-left py-1.5 text-slate-500">Produit</th>
                  <th className="text-right py-1.5 text-slate-500">Qté vendue</th>
                  <th className="text-right py-1.5 text-slate-500">CA</th>
                  <th className="text-right py-1.5 text-slate-500">Marge</th>
                  <th className="text-right py-1.5 text-slate-500">Marge %</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rapportsGestionData.data.margeParProduit.map((p) => (
                    <tr key={p.produitId}>
                      <td className="py-1.5 text-slate-700">{p.nom}</td>
                      <td className="py-1.5 text-right text-slate-600">{p.quantiteVendue}</td>
                      <td className="py-1.5 text-right text-slate-700">{formatCurrency(p.ca)}</td>
                      <td className="py-1.5 text-right text-emerald-700">{p.coutConnu ? formatCurrency(p.marge!) : <span className="text-slate-400 italic">coût inconnu</span>}</td>
                      <td className="py-1.5 text-right text-emerald-700">{p.margePct != null ? `${p.margePct}%` : "—"}</td>
                    </tr>
                  ))}
                  {rapportsGestionData.data.margeParProduit.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune vente sur la période.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">« Coût inconnu » = prix d&apos;achat non renseigné sur la fiche produit (Catalogue).</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Rotation de stock &amp; stock immobilisé</h4>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 sticky top-0 bg-white"><tr>
                    <th className="text-left py-1.5 text-slate-500">Produit</th>
                    <th className="text-right py-1.5 text-slate-500">Stock</th>
                    <th className="text-right py-1.5 text-slate-500">Rotation</th>
                    <th className="text-right py-1.5 text-slate-500">Valeur immobilisée</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {rapportsGestionData.data.rotationStock.map((r) => (
                      <tr key={r.produitId}>
                        <td className="py-1.5 text-slate-700">{r.nom}</td>
                        <td className="py-1.5 text-right text-slate-600">{r.stockActuel}</td>
                        <td className="py-1.5 text-right text-slate-600">{r.rotation != null ? r.rotation : "—"}</td>
                        <td className="py-1.5 text-right text-amber-700">{formatCurrency(r.valeurStock)}</td>
                      </tr>
                    ))}
                    {rapportsGestionData.data.rotationStock.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucun stock.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-1">Dettes fournisseurs (proxy DPO)</h4>
              <p className="text-xs text-amber-600 mb-3 italic">
                Pas un vrai DPO : le système n&apos;a ni date de facture fournisseur ni date de paiement effectif — seulement un reste à payer par bon de commande.
              </p>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100 sticky top-0 bg-white"><tr>
                    <th className="text-left py-1.5 text-slate-500">Fournisseur</th>
                    <th className="text-right py-1.5 text-slate-500">Reste à payer</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {rapportsGestionData.data.dpoFournisseursProxy.map((f) => (
                      <tr key={f.fournisseurId}>
                        <td className="py-1.5 text-slate-700">{f.nom}</td>
                        <td className="py-1.5 text-right text-red-600">{formatCurrency(f.resteAPayer)}</td>
                      </tr>
                    ))}
                    {rapportsGestionData.data.dpoFournisseursProxy.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-slate-400">Aucune dette fournisseur en cours.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

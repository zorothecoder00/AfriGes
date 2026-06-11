"use client";

import { useState } from "react";
import { FileText, RefreshCw, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

interface RapportItem {
  id: number;
  portefeuilleId: number;
  mois: number;
  annee: number;
  createdAt: string;
  portefeuille: {
    reference: string;
    nom: string | null;
    profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } | null;
  };
}

interface ReportingData { rapports: RapportItem[]; total: number }

export default function ReportingPage() {
  const now = new Date();
  const [mois,  setMois]  = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const { data, loading, refetch } = useApi<ReportingData>(`/api/admin/ria/reporting/mensuel?mois=${mois}&annee=${annee}`);
  const { mutate: generer, loading: genLoading } = useMutation<{ success: boolean; message: string; resultats: unknown[] }, { mois: number; annee: number }>("/api/admin/ria/reporting/mensuel", "POST");

  async function handleGenerer() {
    const res = await generer({ mois, annee });
    if (res?.success) { toast.success(res.message); refetch(); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rapports Mensuels RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Snapshots financiers par portefeuille, imprimables</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Sélecteur + génération */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Mois</label>
          <select value={mois} onChange={(e) => setMois(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("fr-FR", { month: "long" })}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Année</label>
          <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={handleGenerer} disabled={genLoading}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
          <Plus className={`w-4 h-4 ${genLoading ? "animate-spin" : ""}`} />
          Générer / Mettre à jour
        </button>
      </div>

      {/* Liste des rapports */}
      {loading ? (
        <div className="p-8 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-center">Période</th>
                  <th className="px-4 py-3 text-center">Généré le</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.rapports || data.rapports.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucun rapport pour cette période. Cliquez sur &quot;Générer&quot; pour créer les rapports.
                  </td></tr>
                )}
                {data?.rapports.map((r) => {
                  const investisseur = r.portefeuille.profilRIA?.gestionnaire?.member
                    ? `${r.portefeuille.profilRIA.gestionnaire.member.prenom} ${r.portefeuille.profilRIA.gestionnaire.member.nom}`
                    : "—";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          {r.portefeuille.reference}{r.portefeuille.nom ? ` — ${r.portefeuille.nom}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{investisseur}</td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {new Date(2000, r.mois - 1).toLocaleString("fr-FR", { month: "long" })} {r.annee}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400 text-xs">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/dashboard/admin/ria/reporting/${r.id}/bulletin`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
                          <ExternalLink className="w-3 h-3" /> Voir bulletin
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Award, RefreshCw, Calculator } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

interface Commission {
  agentId: number; nom: string; role: "AGENT_TERRAIN" | "CHEF_AGENCE";
  totalRembourse: number; nbOps: number; taux: number; commission: number;
}

interface CommissionsData {
  mois: number; annee: number; tauxAgent: number; tauxChef: number;
  commissions: Commission[];
  totaux: { totalCommissions: number; nbBeneficiaires: number };
}

function fmt(n: number) { return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA"; }

export default function CommissionsPage() {
  const now = new Date();
  const [mois,      setMois]      = useState(now.getMonth() + 1);
  const [annee,     setAnnee]     = useState(now.getFullYear());
  const [tauxAgent, setTauxAgent] = useState(1.0);
  const [tauxChef,  setTauxChef]  = useState(0.5);

  const { data, loading, refetch } = useApi<CommissionsData>(
    `/api/admin/ria/commissions?mois=${mois}&annee=${annee}`
  );
  const { mutate: recalculer, loading: calcLoading } = useMutation<CommissionsData, { mois: number; annee: number; tauxAgent: number; tauxChef: number }>(
    "/api/admin/ria/commissions", "POST"
  );

  async function handleRecalculer() {
    const res = await recalculer({ mois, annee, tauxAgent, tauxChef });
    if (res?.commissions) { toast.success(`${res.commissions.length} commission(s) calculée(s)`); refetch(); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Commissions RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Commissions agents et chefs agence sur remboursements collectés</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Taux agent (%)</label>
          <input type="number" step="0.1" min="0" max="10" value={tauxAgent}
            onChange={(e) => setTauxAgent(parseFloat(e.target.value))}
            className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Taux chef (%)</label>
          <input type="number" step="0.1" min="0" max="10" value={tauxChef}
            onChange={(e) => setTauxChef(parseFloat(e.target.value))}
            className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <button onClick={handleRecalculer} disabled={calcLoading}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
          <Calculator className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
          Calculer
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Total commissions</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(data.totaux.totalCommissions)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Bénéficiaires</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{data.totaux.nbBeneficiaires}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Période</p>
            <p className="text-lg font-bold text-slate-700 mt-1">
              {new Date(data.annee, data.mois - 1).toLocaleString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700 text-sm">Détail par bénéficiaire</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-center">Rôle</th>
                  <th className="px-4 py-3 text-right">Total collecté (RIA)</th>
                  <th className="px-4 py-3 text-center">Nb opérations</th>
                  <th className="px-4 py-3 text-center">Taux</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.commissions || data.commissions.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune commission pour cette période. Cliquez sur &quot;Calculer&quot;.
                  </td></tr>
                )}
                {data?.commissions.map((c) => (
                  <tr key={`${c.role}-${c.agentId}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nom}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${c.role === "AGENT_TERRAIN" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {c.role === "AGENT_TERRAIN" ? "Agent terrain" : "Chef agence"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(c.totalRembourse)}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{c.nbOps}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{c.taux}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(c.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

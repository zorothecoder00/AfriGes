"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, TrendingUp, Award, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashData {
  capitalInvesti: number; nbClientsFinances: number; tauxRemboursement: number;
  rendementMoyen: number; beneficesGeneres: number; scoreGlobalSante: number;
  nbInvestisseurs?: number; nbPortefeuilles?: number;
}
interface PortefeuilleRank {
  reference: string; nom: string; clients: number; montant: number; recouvre: number; taux: number;
}
interface TerrainStats { portefeuilles: PortefeuilleRank[] }

export default function PerformancePage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: dashRes } = useApi<{ data: DashData }>(`/api/admin/ria/dashboard?kpis=1&_r=${refresh}`);
  const dash = dashRes?.data;
  const { data: statsRes } = useApi<{ data: TerrainStats }>(`/api/admin/ria/gouvernance/terrain-stats?_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);

  // Classement par portefeuille — calculé côté serveur sur l'ensemble des
  // affectations actives (déjà trié par taux de recouvrement décroissant).
  const ranking = statsRes?.data.portefeuilles ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Performance Commerciale</h1>
          <p className="text-sm text-slate-500">Indicateurs de performance réseau & terrain</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-emerald-700">{toNum(dash.rendementMoyen).toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Rendement moyen</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <BarChart2 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-700">{toNum(dash.tauxRemboursement).toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Taux remboursement</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <Award className="w-5 h-5 text-violet-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-violet-700">{toNum(dash.nbClientsFinances)}</p>
            <p className="text-xs text-slate-500">Clients financés actifs</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-amber-700">{formatCurrency(toNum(dash.beneficesGeneres))}</p>
            <p className="text-xs text-slate-500">Bénéfices générés</p>
          </div>
        </div>
      )}

      {/* Classement par portefeuille */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Classement des portefeuilles (taux recouvrement)</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {ranking.map((r, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"
              }`}>{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{r.nom}</p>
                <p className="text-xs text-slate-400">{r.clients} client(s) · {formatCurrency(r.montant)} financé</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${r.taux >= 80 ? "text-emerald-600" : r.taux >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                  {r.taux.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400">{formatCurrency(r.recouvre)} récupéré</p>
              </div>
            </div>
          ))}
          {ranking.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-10">Aucune donnée disponible</p>
          )}
        </div>
      </div>

      {/* Score santé */}
      {dash && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Score de santé global du réseau</h2>
          <div className="flex items-center gap-4">
            <p className={`text-5xl font-black ${toNum(dash.scoreGlobalSante) >= 75 ? "text-emerald-600" : toNum(dash.scoreGlobalSante) >= 50 ? "text-amber-600" : "text-rose-600"}`}>
              {toNum(dash.scoreGlobalSante)}
            </p>
            <div className="flex-1">
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${toNum(dash.scoreGlobalSante) >= 75 ? "bg-emerald-400" : "bg-amber-400"}`}
                  style={{ width: `${toNum(dash.scoreGlobalSante)}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">/100 — Score composite (remboursement, rendement, défaut)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

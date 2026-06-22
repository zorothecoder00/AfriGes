"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Calendar, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashData {
  capitalInvesti: number; capitalDisponible: number;
  tauxRemboursement: number; rendementMoyen: number;
  beneficesGeneres: number; montantRecouvreDuMois: number;
}

function prevMonth(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString("fr", { month: "long", year: "numeric" });
}

export default function PreviisionsPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: res, loading } = useApi<{ data: DashData }>(`/api/admin/ria/dashboard?kpis=1&_r=${refresh}`);

  if (type !== "finance") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Finance.</div>
  );

  const data = res?.data;
  if (loading || !data) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const encours   = toNum(data.capitalInvesti) - toNum(data.capitalDisponible);
  const rendement = toNum(data.rendementMoyen);
  const projections = [1, 2, 3, 6, 12].map(m => ({
    label: prevMonth(m),
    remb: toNum(data.montantRecouvreDuMois) * m,
    benefice: encours * (rendement / 100 / 12) * m,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Prévisions Financières</h1>
          <p className="text-sm text-slate-500">Projections basées sur les indicateurs actuels</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Ces projections sont basées sur le taux de remboursement mensuel actuel ({formatCurrency(toNum(data.montantRecouvreDuMois))}/mois)
        et le rendement moyen ({rendement.toFixed(1)}%). Elles ont une valeur indicative.
      </div>

      {/* Indicateurs de base */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-blue-700">{formatCurrency(encours)}</p>
          <p className="text-xs text-slate-500">Encours actif (base calcul)</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-emerald-700">{rendement.toFixed(1)}%/an</p>
          <p className="text-xs text-slate-500">Rendement moyen</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Calendar className="w-5 h-5 text-violet-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-violet-700">{formatCurrency(toNum(data.montantRecouvreDuMois))}</p>
          <p className="text-xs text-slate-500">Recouvrement mensuel actuel</p>
        </div>
      </div>

      {/* Tableau de projections */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Projections cumulées</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Horizon</th>
              <th className="px-4 py-3 text-right">Recouvrement cumulé projeté</th>
              <th className="px-4 py-3 text-right">Bénéfices projetés</th>
              <th className="px-4 py-3 text-right">Flux total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projections.map(p => (
              <tr key={p.label} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800 capitalize">{p.label}</td>
                <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(p.remb)}</td>
                <td className="px-4 py-3 text-right text-blue-700 font-medium">{formatCurrency(p.benefice)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(p.remb + p.benefice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capital disponible projection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Évolution du capital disponible</h2>
        <div className="space-y-3">
          {projections.map((p, i) => {
            const disp = toNum(data.capitalDisponible) + p.remb;
            const max  = toNum(data.capitalInvesti);
            const pct  = max > 0 ? Math.min(100, disp / max * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-4">
                <p className="text-sm text-slate-600 w-40 capitalize truncate">{p.label}</p>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm font-medium text-slate-800 w-32 text-right">{formatCurrency(disp)}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">Hypothèse : recouvrement mensuel constant, pas de nouveaux financements</p>
      </div>
    </div>
  );
}

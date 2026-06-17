"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Financement {
  id: number; reference: string; montantFinance: number; taux?: number;
  statut: string; dateDebut?: string | null; dateEcheance: string | null;
  montantRembourse: number; nombreEcheances?: number; echeancesPayees?: number;
  client: { nom: string; prenom: string };
  portefeuille: { reference: string; profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } };
}
interface FResponse { data: Financement[]; meta: { total: number } }

const STATUT_STYLE: Record<string, string> = {
  ACTIF:      "bg-emerald-50 text-emerald-700",
  EN_ATTENTE: "bg-slate-50 text-slate-600",
  TERMINE:    "bg-blue-50 text-blue-700",
  EN_RETARD:  "bg-rose-50 text-rose-700",
  REJETE:     "bg-red-50 text-red-700",
};

export default function InvestissementsPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<FResponse>(`/api/admin/ria/financements?limit=50&_r=${refresh}`);

  if (type !== "finance") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Finance.</div>
  );

  const items = data?.data ?? [];
  const toNum = (v: unknown) => Number(v ?? 0);
  const total  = items.reduce((s, f) => s + toNum(f.montantFinance), 0);
  const rembourse = items.reduce((s, f) => s + toNum(f.montantRembourse), 0);
  const retard = items.filter(f => f.statut === "EN_RETARD").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contrôle des Investissements</h1>
          <p className="text-sm text-slate-500">Suivi des financements et taux de recouvrement</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{data?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Financements total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(total)}</p>
          <p className="text-xs text-slate-500">Montant total financé</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(rembourse)}</p>
          <p className="text-xs text-slate-500">Montant recouvré</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${retard > 0 ? "text-rose-600" : "text-emerald-600"}`}>{retard}</p>
          <p className="text-xs text-slate-500">En retard</p>
        </div>
      </div>

      {retard > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700 font-medium">{retard} financement(s) en retard — action de recouvrement recommandée.</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Détail des financements</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-right">Remboursé</th>
                  <th className="px-4 py-3 text-right">Taux</th>
                  <th className="px-4 py-3 text-right">Avancement</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(f => {
                  const montant = toNum(f.montantFinance);
                  const remb    = toNum(f.montantRembourse);
                  const pct     = montant > 0 ? (remb / montant * 100) : 0;
                  const echs    = `${f.echeancesPayees ?? 0}/${f.nombreEcheances ?? 0}`;
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{f.reference}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {f.client.prenom} {f.client.nom}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {f.portefeuille.reference}
                        <span className="block text-slate-400">
                          {f.portefeuille.profilRIA.gestionnaire.member.prenom} {f.portefeuille.profilRIA.gestionnaire.member.nom}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(montant)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(remb)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{toNum(f.taux).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{echs} échéances</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[f.statut] ?? "bg-slate-50 text-slate-600"}`}>
                          {f.statut}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Résumé recouvrement */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Taux de recouvrement global</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${total > 0 ? Math.min(100, rembourse / total * 100) : 0}%` }} />
          </div>
          <span className="text-xl font-bold text-emerald-700">
            {total > 0 ? (rembourse / total * 100).toFixed(1) : 0}%
          </span>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>{formatCurrency(rembourse)} récupéré</span>
          <span>{formatCurrency(total - rembourse)} restant</span>
        </div>
      </div>
    </div>
  );
}

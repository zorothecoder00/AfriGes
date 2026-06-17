"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, AlertTriangle, Shield, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Affectation {
  id: number; actif: boolean; classeRisque: string;
  client: { nom: string; prenom: string; commune: string | null };
  portefeuille: { reference: string; profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } };
  financements: { montant: number; statut: string; montantRembourse: number }[];
}
interface AffResponse { data: Affectation[] }

const RISQUE_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  FAIBLE: { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  MOYEN:  { color: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-400"  },
  ELEVE:  { color: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-400" },
  TRES_ELEVE: { color: "text-rose-700", bg: "bg-rose-50",   dot: "bg-rose-500"   },
};

export default function RisquesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<AffResponse>(`/api/admin/ria/affectations?limit=100&_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const items = data?.data ?? [];

  const byRisque = ["FAIBLE", "MOYEN", "ELEVE", "TRES_ELEVE"].map(k => ({
    key: k,
    items: items.filter(a => a.classeRisque === k),
  }));

  const enRetard = items.filter(a =>
    a.financements.some(f => f.statut === "EN_RETARD")
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des Risques Terrain</h1>
          <p className="text-sm text-slate-500">Classification des clients par niveau de risque</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Résumé par classe */}
      <div className="grid grid-cols-4 gap-4">
        {byRisque.map(({ key, items: grp }) => {
          const cfg = RISQUE_CONFIG[key] ?? RISQUE_CONFIG.MOYEN;
          const montant = grp.flatMap(a => a.financements).reduce((s, f) => s + toNum(f.montant), 0);
          return (
            <div key={key} className={`${cfg.bg} border border-slate-200 rounded-xl p-4 text-center`}>
              <div className={`w-3 h-3 rounded-full ${cfg.dot} mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${cfg.color}`}>{grp.length}</p>
              <p className="text-xs text-slate-600 mt-0.5">{key.replace("_", " ")}</p>
              <p className="text-xs text-slate-500">{formatCurrency(montant)}</p>
            </div>
          );
        })}
      </div>

      {/* Alerte clients en retard */}
      {enRetard.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h2 className="font-semibold text-rose-700">{enRetard.length} client(s) avec financement(s) en retard</h2>
          </div>
          <div className="space-y-2">
            {enRetard.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{a.client.prenom} {a.client.nom}</span>
                <span className="text-xs text-slate-500">{a.client.commune ?? ""}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${RISQUE_CONFIG[a.classeRisque]?.bg} ${RISQUE_CONFIG[a.classeRisque]?.color}`}>
                  {a.classeRisque}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table par niveau de risque */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        byRisque.filter(({ items: grp }) => grp.length > 0).map(({ key, items: grp }) => {
          const cfg = RISQUE_CONFIG[key] ?? RISQUE_CONFIG.MOYEN;
          return (
            <div key={key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className={`px-5 py-3 border-b border-slate-100 ${cfg.bg} flex items-center gap-2`}>
                <Activity className={`w-4 h-4 ${cfg.color}`} />
                <h2 className={`font-semibold ${cfg.color}`}>Risque {key.replace("_", " ")} ({grp.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Client</th>
                      <th className="px-4 py-3 text-left">Commune</th>
                      <th className="px-4 py-3 text-left">Portefeuille</th>
                      <th className="px-4 py-3 text-right">Montant financé</th>
                      <th className="px-4 py-3 text-right">Recouvré</th>
                      <th className="px-4 py-3 text-center">Statut fin.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grp.map(a => {
                      const montant  = a.financements.reduce((s, f) => s + toNum(f.montant), 0);
                      const recouvre = a.financements.reduce((s, f) => s + toNum(f.montantRembourse), 0);
                      const statuts  = [...new Set(a.financements.map(f => f.statut))];
                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {a.client.prenom} {a.client.nom}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{a.client.commune ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {a.portefeuille.reference}
                            <span className="block">{a.portefeuille.profilRIA.gestionnaire.member.prenom} {a.portefeuille.profilRIA.gestionnaire.member.nom}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(montant)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(recouvre)}</td>
                          <td className="px-4 py-3 text-center">
                            {statuts.map(s => (
                              <span key={s} className={`text-xs px-1.5 py-0.5 rounded mr-0.5 ${s === "EN_RETARD" ? "bg-rose-50 text-rose-700" : s === "ACTIF" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {s}
                              </span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Shield className="w-8 h-8 text-slate-300" />
          <p className="text-slate-500 text-sm">Aucune donnée de risque disponible</p>
        </div>
      )}
    </div>
  );
}

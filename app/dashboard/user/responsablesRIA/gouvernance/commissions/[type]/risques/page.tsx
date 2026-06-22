"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, AlertTriangle, Shield, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Row {
  id: number; actif: boolean; classeRisque: string;
  clientNom: string; clientPrenom: string; commune: string | null;
  portefeuilleRef: string; investisseur: string;
  montant: number; recouvre: number; statuts: string[]; enRetard: boolean;
}
interface TerrainStats {
  byRisque: { key: string; count: number; montant: number; recouvre: number }[];
  enRetard: { count: number; items: { id: number; nom: string; commune: string | null; classeRisque: string }[] };
  rows: Row[];
}
interface StatsResponse { data: TerrainStats }

// Classes de risque RIA : A (meilleur) → E (pire).
const RISQUE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  A: { label: "A — Très faible", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  B: { label: "B — Faible",      color: "text-lime-700",    bg: "bg-lime-50",    dot: "bg-lime-400"    },
  C: { label: "C — Moyen",       color: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-400"   },
  D: { label: "D — Élevé",       color: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-400"  },
  E: { label: "E — Très élevé",  color: "text-rose-700",    bg: "bg-rose-50",    dot: "bg-rose-500"    },
};
const cfgOf = (k: string) => RISQUE_CONFIG[k] ?? RISQUE_CONFIG.C;

export default function RisquesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<StatsResponse>(`/api/admin/ria/gouvernance/terrain-stats?_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const stats   = data?.data;
  const byRisque = stats?.byRisque ?? [];
  const enRetard = stats?.enRetard;
  const rows     = stats?.rows ?? [];

  // Lignes de détail groupées par classe (depuis l'échantillon borné renvoyé par l'API).
  const rowsByClasse = ["A", "B", "C", "D", "E"].map(key => ({
    key,
    items: rows.filter(r => r.classeRisque === key),
  }));

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {byRisque.map(({ key, count, montant }) => {
          const cfg = cfgOf(key);
          return (
            <div key={key} className={`${cfg.bg} border border-slate-200 rounded-xl p-4 text-center`}>
              <div className={`w-3 h-3 rounded-full ${cfg.dot} mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-slate-600 mt-0.5">{cfg.label}</p>
              <p className="text-xs text-slate-500">{formatCurrency(montant)}</p>
            </div>
          );
        })}
      </div>

      {/* Alerte clients en retard */}
      {enRetard && enRetard.count > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h2 className="font-semibold text-rose-700">{enRetard.count} client(s) avec financement(s) en retard</h2>
          </div>
          <div className="space-y-2">
            {enRetard.items.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{a.nom}</span>
                <span className="text-xs text-slate-500">{a.commune ?? ""}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${cfgOf(a.classeRisque).bg} ${cfgOf(a.classeRisque).color}`}>
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
        rowsByClasse.filter(({ items }) => items.length > 0).map(({ key, items }) => {
          const cfg = cfgOf(key);
          return (
            <div key={key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className={`px-5 py-3 border-b border-slate-100 ${cfg.bg} flex items-center gap-2`}>
                <Activity className={`w-4 h-4 ${cfg.color}`} />
                <h2 className={`font-semibold ${cfg.color}`}>Risque {cfg.label} ({items.length})</h2>
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
                    {items.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {a.clientPrenom} {a.clientNom}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{a.commune ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {a.portefeuilleRef}
                          <span className="block">{a.investisseur}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(a.montant)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(a.recouvre)}</td>
                        <td className="px-4 py-3 text-center">
                          {a.statuts.map(s => (
                            <span key={s} className={`text-xs px-1.5 py-0.5 rounded mr-0.5 ${s === "EN_RETARD" ? "bg-rose-50 text-rose-700" : s === "ACTIF" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {s}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <Shield className="w-8 h-8 text-slate-300" />
          <p className="text-slate-500 text-sm">Aucune donnée de risque disponible</p>
        </div>
      )}
    </div>
  );
}

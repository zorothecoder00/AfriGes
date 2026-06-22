"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, MapPin, Users, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Row {
  id: number; actif: boolean; classeRisque: string;
  clientNom: string; clientPrenom: string; commune: string | null; secteur: string | null;
  investisseur: string; montant: number; nbFinancements: number;
}
interface TerrainStats {
  total: number; actifs: number;
  byCommune: { label: string; count: number; montant: number }[];
  rows: Row[];
}
interface StatsResponse { data: TerrainStats }

export default function ActivitesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<StatsResponse>(`/api/admin/ria/gouvernance/terrain-stats?_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const stats = data?.data;
  const items = stats?.rows ?? [];
  const byCommune = stats?.byCommune ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Activités Terrain</h1>
          <p className="text-sm text-slate-500">Suivi des affectations clients par zone géographique</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500">Affectations totales</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats?.actifs ?? 0}</p>
          <p className="text-xs text-slate-500">Actives</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{byCommune.length}</p>
          <p className="text-xs text-slate-500">Communes couvertes</p>
        </div>
      </div>

      {/* Par commune */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Répartition par commune</h2>
        </div>
        {byCommune.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucune donnée commune disponible</p>
        ) : (
          <div className="space-y-3">
            {byCommune.slice(0, 15).map(c => {
              const max = byCommune[0]?.count ?? 1;
              return (
                <div key={c.label} className="flex items-center gap-4">
                  <p className="text-sm text-slate-700 w-32 truncate">{c.label}</p>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <p className="text-sm font-medium text-slate-800 w-8">{c.count}</p>
                  <p className="text-xs text-slate-400 w-28 text-right">{formatCurrency(c.montant)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table affectations */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Affectations clients</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Commune</th>
                  <th className="px-4 py-3 text-left">Secteur</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-right">Financements</th>
                  <th className="px-4 py-3 text-center">Risque</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {a.clientPrenom} {a.clientNom}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.commune ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{a.secteur ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {a.investisseur}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.nbFinancements > 0 && (
                        <span className="text-xs text-slate-700">{a.nbFinancements} ({formatCurrency(a.montant)})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Activity className={`w-3.5 h-3.5 mx-auto ${a.classeRisque <= "B" ? "text-emerald-500" : a.classeRisque === "C" ? "text-amber-500" : "text-rose-500"}`} />
                      <span className="text-xs text-slate-500 block">{a.classeRisque}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {a.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

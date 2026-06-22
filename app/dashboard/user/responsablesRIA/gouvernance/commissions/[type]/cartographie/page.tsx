"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Map as MapIcon, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface TerrainStats {
  byRegion: { label: string; count: number; actifs: number; montant: number }[];
  byCommune: { label: string; count: number; montant: number }[];
  bySecteur: { label: string; count: number }[];
}
interface StatsResponse { data: TerrainStats }

export default function CartographiePage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<StatsResponse>(`/api/admin/ria/gouvernance/terrain-stats?_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const stats = data?.data;
  const byRegion  = stats?.byRegion ?? [];
  const byCommune = stats?.byCommune ?? [];
  const bySecteur = stats?.bySecteur ?? [];

  const maxCommune = byCommune[0]?.count ?? 1;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cartographie des Portefeuilles</h1>
          <p className="text-sm text-slate-500">Répartition géographique des clients et financements</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Régions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapIcon className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Par région</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byRegion.map(r => (
              <div key={r.label} className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-slate-800">{r.label}</p>
                  <span className="text-xs text-slate-500">{r.actifs}/{r.count} actifs</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${byRegion[0] ? (r.count / byRegion[0].count) * 100 : 0}%` }} />
                </div>
                <p className="text-xs text-slate-500">{r.count} client(s) · {formatCurrency(r.montant)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top communes */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Top communes (20 premières)</h2>
        </div>
        <div className="space-y-2">
          {byCommune.slice(0, 20).map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <p className="text-sm text-slate-700 w-36 truncate">{c.label}</p>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(c.count / maxCommune) * 100}%` }} />
              </div>
              <span className="text-sm font-medium text-slate-800 w-6">{c.count}</span>
              <span className="text-xs text-slate-400 w-28 text-right">{formatCurrency(c.montant)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Secteurs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Par secteur d&apos;activité</h2>
        <div className="flex flex-wrap gap-2">
          {bySecteur.map(s => (
            <span key={s.label}
              className="bg-slate-100 text-slate-700 text-xs px-3 py-1.5 rounded-full">
              {s.label} <strong>({s.count})</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

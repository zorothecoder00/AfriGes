"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Rocket, FileText } from "lucide-react";

interface PlanAction {
  id: number; titre: string; description: string | null; statut: string;
  priorite: string; dateEcheance: string | null; progression: number;
  responsable: { nom: string; prenom: string } | null;
}
interface PlanResponse { data: PlanAction[]; meta: { total: number } }

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE:   "bg-slate-50 text-slate-600",
  EN_COURS:     "bg-blue-50 text-blue-700",
  TERMINE:      "bg-emerald-50 text-emerald-700",
  EN_RETARD:    "bg-rose-50 text-rose-700",
  ABANDONNE:    "bg-red-50 text-red-700",
};

export default function InnovationsPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<PlanResponse>(
    `/api/admin/ria/commissions/gouvernance/plans-actions?typeCommission=OPTIMISATION&priorite=HAUTE&limit=20&_r=${refresh}`
  );

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  const items = data?.data ?? [];
  const toNum = (v: unknown) => Number(v ?? 0);
  const terminees = items.filter(p => p.statut === "TERMINE").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des Innovations</h1>
          <p className="text-sm text-slate-500">Plans d&apos;action prioritaires et initiatives innovantes RIA</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{data?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Initiatives totales</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{items.filter(p => p.statut === "EN_COURS").length}</p>
          <p className="text-xs text-slate-500">En cours</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{terminees}</p>
          <p className="text-xs text-slate-500">Finalisées</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-violet-500" />
          <h2 className="font-semibold text-slate-800">Initiatives & innovations (priorité haute)</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <FileText className="w-8 h-8 text-slate-300" />
            <p className="text-slate-500 text-sm">Aucune initiative enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(p => {
              const pct = Math.min(100, Math.max(0, toNum(p.progression)));
              return (
                <div key={p.id} className="px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-800">{p.titre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUT_STYLE[p.statut] ?? "bg-slate-50 text-slate-600"}`}>
                          {p.statut}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-sm text-slate-500 mb-2 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                      {(p.responsable || p.dateEcheance) && (
                        <div className="flex items-center gap-3 mt-1.5">
                          {p.responsable && (
                            <span className="text-xs text-slate-400">Resp. : {p.responsable.prenom} {p.responsable.nom}</span>
                          )}
                          {p.dateEcheance && (
                            <span className="text-xs text-slate-400">Échéance : {new Date(p.dateEcheance).toLocaleDateString("fr")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

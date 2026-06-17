"use client";

import { useApi } from "@/hooks/useApi";
import { ListChecks, AlertTriangle, Gavel } from "lucide-react";

interface Plan {
  id: number;
  typeCommission: string;
  titre: string;
  description: string | null;
  statut: string;
  priorite: string;
  progression: number;
  dateEcheance: string | null;
  enRetard?: boolean;
  resolution: { id: number; numero: string; titre: string } | null;
}

interface Data { plans: Plan[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  A_FAIRE:     { label: "À faire",      color: "bg-slate-100 text-slate-600" },
  NON_DEMARRE: { label: "Non démarré",  color: "bg-slate-100 text-slate-600" },
  EN_COURS:    { label: "En cours",     color: "bg-blue-100 text-blue-700" },
  EN_RETARD:   { label: "En retard",    color: "bg-rose-100 text-rose-700" },
  TERMINE:     { label: "Terminé",      color: "bg-emerald-100 text-emerald-700" },
  REALISE:     { label: "Réalisé",      color: "bg-emerald-100 text-emerald-700" },
  ABANDONNE:   { label: "Abandonné",    color: "bg-slate-100 text-slate-400" },
};

const PRIORITES: Record<string, string> = {
  CRITIQUE: "text-rose-600 font-semibold",
  HAUTE:    "text-amber-600 font-medium",
  MOYENNE:  "text-slate-500",
  BASSE:    "text-slate-400",
};

export default function MesPlansActionsPage() {
  const { data, loading } = useApi<Data>("/api/membreCommission/plans-actions");
  const plans = data?.plans ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-teal-600" /> Mes plans d&apos;action
        </h1>
        <p className="text-sm text-slate-500">Plans d&apos;action dont je suis responsable</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun plan d&apos;action assigné</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-5 ${p.enRetard ? "border-rose-200 bg-rose-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[p.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[p.statut]?.label || p.statut}
                    </span>
                    <span className={`text-xs ${PRIORITES[p.priorite] || "text-slate-400"}`}>{p.priorite}</span>
                    {p.enRetard && (
                      <span className="text-xs text-rose-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> En retard
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{p.titre}</h3>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>}
                  {p.resolution && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Gavel className="w-3 h-3" /> {p.resolution.numero} — {p.resolution.titre}
                    </p>
                  )}
                </div>
                {p.dateEcheance && (
                  <p className={`text-xs shrink-0 ${p.enRetard ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                    Échéance {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.progression >= 100 ? "bg-emerald-500" : p.progression >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                    style={{ width: `${p.progression}%` }} />
                </div>
                <span className="text-xs text-slate-500 shrink-0">{p.progression}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
